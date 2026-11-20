// Hesap bölümü: e-posta koduyla giriş, bulut eşitleme, hatırlatma tercihi, hesap silme.
// config.js boşsa hiçbir şey yapmaz ve bölüm gizli kalır.
import { CLOUD, cloudEnabled } from './config.js';
import { createCloud } from './cloud.js';

const $ = (id) => document.getElementById(id);

if (cloudEnabled()) init();

function init() {
  const storage = (() => { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } catch { return null; } })();
  const box = $('account');
  box.hidden = false;
  if (!storage) {
    $('acc-email-form').hidden = true;
    showError('Bu tarayıcıda giriş yapılamıyor (gizli sekme ya da depolama kapalı olabilir).');
    return;
  }

  const cloud = createCloud({ url: CLOUD.url, anonKey: CLOUD.anonKey, storage });
  let email = '';
  let busy = false;
  let pushTimer = null;

  const getItems = () => { const d = { items: [] }; document.dispatchEvent(new CustomEvent('muhlet:get', { detail: d })); return d.items; };
  const setItems = (items) => document.dispatchEvent(new CustomEvent('muhlet:replace', { detail: { items } }));

  function showError(msg) { $('acc-error').textContent = msg; $('acc-error').hidden = !msg; }
  function status(msg) { $('acc-status').textContent = msg; }
  const time = () => new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  async function run(btn, fn) {
    if (busy) return;
    busy = true;
    showError('');
    const label = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Lütfen bekleyin…'; }
    try { await fn(); } catch (e) {
      showError(e.message || 'Bir hata oluştu.');
      if (e.status === 401 && !cloud.user) view();
    } finally {
      busy = false;
      if (btn) { btn.disabled = false; btn.textContent = label; }
    }
  }

  function view() {
    const inside = !!cloud.user;
    $('acc-in').hidden = !inside;
    $('acc-email-form').hidden = inside || !!email;
    $('acc-code-form').hidden = inside || !email;
    $('acc-lead').hidden = inside;
    if (inside) $('acc-who').textContent = `Giriş yapıldı: ${cloud.user.email}`;
    const note = $('storage-note');
    if (note) note.innerHTML = inside
      ? '<strong>Kayıtlarınız bu tarayıcıda ve hesabınızda saklanır.</strong> Diğer cihazlarınızda aynı e-postayla giriş yaparak görebilirsiniz. Notlar yalnızca bu cihazda kalır.'
      : '<strong>Kayıtlarınız sadece bu tarayıcıda durur.</strong> Sunucuya gönderilmez, başka cihazda görünmez. Tarayıcı verilerini silerseniz kaybolur, bu yüzden düzenli olarak yedek alın.';
  }

  async function syncNow() {
    const merged = await cloud.sync(getItems());
    setItems(merged);
    status(`Eşitlendi · ${time()}`);
  }

  async function loadProfile() {
    const p = await cloud.profile();
    $('acc-reminders').checked = p ? p.reminders_on : true;
    if (p && !p.consent_at) await cloud.updateProfile({ consent_at: new Date().toISOString() });
  }

  // 1) E-posta → kod gönder
  $('acc-email-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('acc-email').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { showError('Geçerli bir e-posta adresi girin.'); return; }
    if (!$('acc-consent').checked) { showError('Devam etmek için gizlilik metnini ve kullanım koşullarını onaylayın.'); return; }
    run(e.submitter, async () => {
      await cloud.sendCode(v);
      email = v;
      $('acc-code-info').textContent = `${v} adresine bir giriş kodu gönderdik. Birkaç dakika içinde gelmezse gereksiz (spam) klasörüne bakın.`;
      view();
      $('acc-code').focus();
    });
  });

  // 2) Kod → giriş
  $('acc-code-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('acc-code').value.replace(/\D/g, '');
    if (code.length < 6) { showError('E-postadaki kodu eksiksiz girin.'); return; }
    run(e.submitter, async () => {
      await cloud.verifyCode(email, code);
      email = '';
      $('acc-code').value = '';
      view();
      await loadProfile();
      await syncNow();
    });
  });
  $('acc-back').addEventListener('click', () => { email = ''; showError(''); view(); });

  // Hesap içi işlemler
  $('acc-reminders').addEventListener('change', (e) => {
    const on = e.target.checked;
    run(null, async () => {
      try { await cloud.updateProfile({ reminders_on: on }); status(on ? 'Hatırlatmalar açıldı.' : 'Hatırlatmalar kapatıldı.'); }
      catch (err) { e.target.checked = !on; throw err; }
    });
  });
  $('acc-sync').addEventListener('click', (e) => run(e.currentTarget, syncNow));
  $('acc-out').addEventListener('click', (e) => run(e.currentTarget, async () => {
    await cloud.signOut();
    status('Çıkış yapıldı. Kayıtlarınız bu tarayıcıda kalmaya devam ediyor.');
    view();
  }));
  const del = $('acc-delete');
  del.addEventListener('click', () => {
    if (del.dataset.confirm !== '1') {
      del.dataset.confirm = '1';
      del.textContent = 'Emin misiniz? Silmek için tekrar basın';
      setTimeout(() => { del.dataset.confirm = ''; del.textContent = 'Hesabımı sil'; }, 5000);
      return;
    }
    del.dataset.confirm = '';
    run(del, async () => {
      await cloud.deleteAccount();
      view();
      status('Hesabınız ve sunucudaki tüm kayıtlarınız silindi. Bu tarayıcıdaki kayıtlar duruyor.');
    });
    del.textContent = 'Hesabımı sil';
  });

  // Listede değişiklik olunca buluta gönder (kısa gecikmeyle, art arda değişiklikleri tek seferde)
  document.addEventListener('muhlet:changed', (e) => {
    if (!cloud.user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      try { await cloud.flushDeletes(); await cloud.push(e.detail.items); status(`Eşitlendi · ${time()}`); }
      catch (err) { status(''); showError(`Buluta kaydedilemedi: ${err.message} Kayıt bu tarayıcıda duruyor; sonra "Şimdi eşitle"ye basın.`); }
    }, 600);
  });
  document.addEventListener('muhlet:deleted', (e) => { if (cloud.user) cloud.markDeleted(e.detail.id); });

  view();
  if (cloud.user) run(null, async () => { await loadProfile(); await syncNow(); });
}
