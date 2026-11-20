// Arayüz: formu okur, motoru çağırır, sonucu ekrana yazar. Hesaplama mantığı engine.js'tedir.
import { RULES, findRule } from './rules.js';
import { calculate } from './engine.js';
import * as store from './store.js';

const $ = (id) => document.getElementById(id);
const form = $('form');
const select = $('islem');
let last = null;
let lastInput = null;

// İşlem listesi (gruplu)
const groups = [...new Set(RULES.map((r) => r.group))];
for (const g of groups) {
  const og = document.createElement('optgroup');
  og.label = g;
  for (const r of RULES.filter((x) => x.group === g)) {
    const o = document.createElement('option');
    o.value = r.code;
    o.textContent = `${r.name} (${r.versions[r.versions.length - 1].law.replace(/ \(.*\)/, '')})`;
    og.appendChild(o);
  }
  select.appendChild(og);
}

// Süreler ızgarası: tıklayınca formda seçer
const unitTR = { day: 'gün', week: 'hafta', month: 'ay' };
for (const r of RULES) {
  const v = r.versions[r.versions.length - 1];
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = `<b></b><span></span>`;
  b.querySelector('b').textContent = r.name;
  b.querySelector('span').textContent = `${r.group} · ${v.amount} ${unitTR[v.unit]}`;
  b.addEventListener('click', () => { select.value = r.code; onRuleChange(); location.hash = r.code; $('hesapla').scrollIntoView({ behavior: 'smooth' }); select.focus(); });
  $('rule-grid').appendChild(b);
}

// Bağlantıdan işlem seçimi: index.html#HMK-IST
if (location.hash && RULES.some((r) => r.code === location.hash.slice(1))) select.value = location.hash.slice(1);

const labels = {
  e: ['e-Tebligatın adresinize ulaştığı tarih', 'Belgeyi açtığınız tarih değil, adresinize ulaştığı tarih. Tebliğ, ulaşmayı izleyen 5. günün sonunda yapılmış sayılır.'],
  fiziki: ['Tebliğ tarihi', 'Tebligatı teslim aldığınız (tebellüğ) tarih.'],
  tefhim: ['Kararın açıklandığı (tefhim) tarih', 'Kararın yüzünüze karşı açıklandığı duruşma tarihi.'],
};
function onTypeChange() {
  const t = form.teblig.value;
  $('tarih-label').textContent = labels[t][0];
  $('tarih-hint').textContent = labels[t][1];
}
function onRuleChange() {
  $('karar-field').hidden = !findRule(select.value).needsDecisionDate;
}
form.addEventListener('change', (e) => {
  if (e.target.name === 'teblig') onTypeChange();
  if (e.target.id === 'islem') onRuleChange();
});
onTypeChange();
onRuleChange();

function showError(msg) {
  $('error').textContent = msg;
  $('error').hidden = !msg;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  showError('');
  const input = {
    ruleCode: select.value,
    serviceType: form.teblig.value,
    eventDate: $('tarih').value,
    decisionDate: $('karar-field').hidden ? undefined : $('karar').value || undefined,
    recessExempt: $('muaf').checked,
  };
  if (!input.eventDate) { showError('Lütfen tarihi girin.'); $('tarih').focus(); return; }
  try {
    last = calculate(input);
    lastInput = input;
    render(last);
  } catch (err) {
    showError(err.message);
  }
});

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function render(r) {
  $('empty').hidden = true;
  $('output').hidden = false;
  $('r-label').textContent = `SON GÜN · ${r.rule.name.toLocaleUpperCase('tr-TR')}`;
  $('r-date').textContent = r.lastDayText;
  $('r-sub').textContent = `${r.lastDayWeekday} · mesai bitimine kadar`;

  const alerts = $('r-alerts');
  alerts.replaceChildren();
  if (r.alternatives.length) {
    const a = el('div', 'alert warn');
    a.append(el('strong', null, 'Uygulamada yorum farkı var. '), 'Temkinli olmak için en erken tarih gösterildi.');
    const ul = el('ul');
    for (const alt of r.alternatives) ul.append(el('li', null, `${alt.reason}: ${alt.text}.`));
    a.append(ul);
    alerts.append(a);
  }
  for (const w of r.warnings) {
    alerts.append(el('div', w.level === 'data' ? 'alert info' : 'alert warn', w.text));
  }

  const ol = $('r-steps');
  ol.replaceChildren();
  for (const s of r.trace) {
    const li = el('li');
    const box = el('div');
    if (s.dateText) box.append(el('strong', null, s.dateText));
    box.append(el('span', 't', s.text));
    if (s.basis) box.append(el('span', 'b', s.basis));
    li.append(box);
    ol.append(li);
  }
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Hesabı panoya kopyala
$('copy').addEventListener('click', async () => {
  if (!last) return;
  const lines = [
    `${last.rule.name} — son gün: ${last.lastDayText} ${last.lastDayWeekday}`,
    ...last.alternatives.map((a) => `Not: ${a.reason}: ${a.text}`),
    '',
    ...last.trace.map((s, i) => `${i + 1}. ${s.dateText ? s.dateText + ' — ' : ''}${s.text}${s.basis ? ' (' + s.basis + ')' : ''}`),
    '',
    'Mühlet Süre ile hesaplandı. Yardımcı araçtır; son kontrol avukattadır.',
  ];
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    $('copied').hidden = false;
    setTimeout(() => { $('copied').hidden = true; }, 2000);
  } catch {
    showError('Kopyalanamadı. Tarayıcınız panoya erişime izin vermiyor olabilir.');
  }
});

// Takvim dosyası (.ics): son gün + 3 gün önce hatırlatma. Müvekkil bilgisi içermez.
$('ics').addEventListener('click', () => {
  if (!last) return;
  const d = last.lastDay.replace(/-/g, '');
  const next = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8) + 1)).toISOString().slice(0, 10).replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s) => s.replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Muhlet Sure//TR', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${d}-${last.rule.code}-${Math.random().toString(36).slice(2)}@muhlet-sure`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${esc('Süre sonu · ' + last.rule.name)}`,
    `DESCRIPTION:${esc('Mühlet Süre ile hesaplandı. Son kontrol avukattadır.')}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc('3 gün kaldı: ' + last.rule.name)}`, 'TRIGGER:-P3D', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc('Son gün: ' + last.rule.name)}`, 'TRIGGER:-PT15H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  a.download = `sure-sonu-${last.lastDay}.ics`;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
});

// ------------------------------------------------------------------
// Sürelerim (tarayıcıda saklanır)
// ------------------------------------------------------------------
const storage = (() => { try { const t = '__t'; localStorage.setItem(t, t); localStorage.removeItem(t); return localStorage; } catch { return null; } })();
const mem = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };
const st = storage || mem;
let items = store.load(st);
let tab = 'open';

if (!storage) {
  $('storage-note').innerHTML = '<strong>Bu tarayıcıda kayıt yapılamıyor</strong> (gizli sekme ya da depolama kapalı olabilir). Kaydettikleriniz sayfa kapanınca kaybolur.';
}

function persist() {
  if (!store.save(st, items)) listMsg('Kaydedilemedi: tarayıcı depolaması dolu ya da kapalı.');
  renderList();
}

function listMsg(text) {
  const m = $('list-msg');
  m.textContent = text;
  m.hidden = false;
  clearTimeout(listMsg.t);
  listMsg.t = setTimeout(() => { m.hidden = true; }, 3500);
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// Kaydet formu
const saveForm = $('save-form');
$('open-save').addEventListener('click', () => {
  saveForm.hidden = !saveForm.hidden;
  $('open-save').setAttribute('aria-expanded', String(!saveForm.hidden));
  if (!saveForm.hidden) $('kod').focus();
});
$('cancel-save').addEventListener('click', () => { saveForm.hidden = true; $('open-save').setAttribute('aria-expanded', 'false'); });
saveForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const err = $('save-error');
  err.hidden = true;
  if (!last) return;
  try {
    const entry = store.makeEntry(lastInput, last, $('kod').value, $('not').value);
    items.push(entry);
    persist();
    saveForm.reset();
    saveForm.hidden = true;
    $('open-save').setAttribute('aria-expanded', 'false');
    tab = 'open';
    renderList();
    $('surelerim').scrollIntoView({ behavior: 'smooth' });
    listMsg(`Kaydedildi: ${entry.code}`);
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  }
});

// Sekmeler
function setTab(t) {
  tab = t;
  $('tab-open').setAttribute('aria-selected', String(t === 'open'));
  $('tab-done').setAttribute('aria-selected', String(t === 'done'));
  renderList();
}
$('tab-open').addEventListener('click', () => setTab('open'));
$('tab-done').addEventListener('click', () => setTab('done'));

function renderList() {
  const today = store.todayISO();
  const open = items.filter((x) => !x.done);
  const done = items.filter((x) => x.done);
  $('cnt-open').textContent = open.length;
  $('cnt-done').textContent = done.length;
  const urgent = open.filter((x) => store.daysLeft(x.lastDay, today) <= 3).length;
  $('nav-count').textContent = urgent;
  $('nav-count').hidden = urgent === 0;

  const list = $('list');
  list.replaceChildren();
  const shown = store.sortItems(tab === 'open' ? open : done);
  $('list-empty').hidden = shown.length > 0;
  $('list-empty').innerHTML = tab === 'open'
    ? 'Henüz açık süre yok. Bir süre hesaplayıp <strong>Sürelerime kaydet</strong>\'e basın.'
    : 'Tamamlanan süre yok.';

  for (const x of shown) {
    const s = store.status(x, today);
    const li = el('li', `item k-${s.kind}`);
    const left = el('div');
    const top = el('div', 'top');
    top.append(el('span', 'code', x.code), el('span', `pill ${s.kind}`, s.label));
    left.append(top, el('div', 'meta', `${x.ruleName} · ${x.law}`));
    if (x.note) left.append(el('div', 'note', x.note));
    const when = el('div', 'when');
    when.append(el('b', null, store.dateText(x.lastDay).split(' ').slice(0, 3).join(' ')), el('span', 'meta', store.dateText(x.lastDay).split(' ').slice(3).join(' ')));
    li.append(left, when);

    const changed = store.recheck(x);
    if (changed) {
      const c = el('div', 'changed');
      c.append(el('strong', null, 'Kurallar güncellendi. '), `Bu süre yeniden hesaplandığında son gün ${store.dateText(changed)} çıkıyor. Kontrol edip güncelleyin.`);
      const up = el('button', null, 'Yeni tarihi kullan');
      up.type = 'button';
      up.style.marginLeft = '8px';
      up.addEventListener('click', () => { x.lastDay = changed; persist(); });
      c.append(up);
      li.append(c);
    }

    const acts = el('div', 'acts');
    const b = (label, fn, cls) => { const n = el('button', cls, label); n.type = 'button'; n.addEventListener('click', fn); acts.append(n); };
    if (!x.done) b('İşlem yapıldı', () => { x.done = true; x.doneAt = new Date().toISOString(); persist(); listMsg(`${x.code} tamamlandı olarak işaretlendi.`); });
    else b('Geri al', () => { x.done = false; x.doneAt = null; persist(); });
    b('Takvime ekle', () => download(`sure-${x.lastDay}.ics`, store.buildICS([x]), 'text/calendar;charset=utf-8'));
    b('Sil', () => {
      if (acts.dataset.confirm !== '1') { acts.dataset.confirm = '1'; acts.lastChild.textContent = 'Silmek için tekrar bas'; return; }
      items = items.filter((y) => y.id !== x.id); persist(); listMsg(`${x.code} silindi.`);
    }, 'danger');
    li.append(acts);
    list.append(li);
  }
}

$('ics-all').addEventListener('click', () => {
  const open = items.filter((x) => !x.done);
  if (!open.length) { listMsg('Takvime aktarılacak açık süre yok.'); return; }
  download(`surelerim-${store.todayISO()}.ics`, store.buildICS(store.sortItems(open)), 'text/calendar;charset=utf-8');
});

$('backup').addEventListener('click', () => {
  if (!items.length) { listMsg('Yedeklenecek kayıt yok.'); return; }
  download(`muhlet-sure-yedek-${store.todayISO()}.json`, store.exportJSON(items), 'application/json');
  listMsg('Yedek dosyası indirildi. Güvenli bir yerde saklayın.');
});

$('restore').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  try {
    const r = store.importJSON(await f.text(), items);
    items = r.items;
    persist();
    listMsg(`${r.added} kayıt geri yüklendi${r.skipped ? `, ${r.skipped} kayıt zaten vardı` : ''}.`);
  } catch (ex) {
    listMsg(ex.message);
  }
});

renderList();
