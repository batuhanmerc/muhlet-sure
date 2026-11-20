// "Evrakı bırak, süre gelsin" arayüzü. Önerir, karar vermez: kullanıcı onaylayınca formu doldurur.
import { analyze } from './classify.js';
import { readDocument } from './docreader.js';
import { findRule } from './rules.js';
import { parse, formatTR } from './engine.js';

const $ = (id) => document.getElementById(id);
const zone = $('dropzone');
const out = $('evrak-result');

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const human = (iso) => formatTR(parse(iso));

async function handleFile(file) {
  out.replaceChildren(el('p', 'loading', `${file.name} okunuyor…`));
  try {
    const { kind, text } = await readDocument(file);
    show(analyze(text), `${kind} dosyası`);
  } catch (err) {
    showError(err.message);
  }
}

function showError(msg) {
  const box = el('div', 'found none');
  box.append(el('p', null, msg));
  out.replaceChildren(box);
}

function useRule(code, dates, btn) {
  const rule = findRule(code);
  const form = $('form');
  const sel = $('islem');
  sel.value = code;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  if (rule.needsDecisionDate && dates.karar) $('karar').value = dates.karar;

  // Görünür geri bildirim: formun en üstüne bilgi kutusu, seçim kutusunu vurgula
  form.querySelector('.aktarildi')?.remove();
  const note = el('div', 'aktarildi');
  note.setAttribute('role', 'status');
  note.append(el('strong', null, `✓ ${rule.group} · ${rule.name} seçildi.`));
  note.append(el('span', null, $('tarih').value
    ? ' Son gün hesaplandı, sonuca bakın.'
    : ' Şimdi aşağıya tebligatın size ulaştığı tarihi girin ve “Son günü hesapla”ya basın.'));
  form.prepend(note);
  sel.classList.remove('flash'); void sel.offsetWidth; sel.classList.add('flash');

  if (btn) { btn.textContent = '✓ Forma aktarıldı'; btn.classList.add('done'); }

  if ($('tarih').value) {
    form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => $('tarih').focus({ preventScroll: true }), 500);
  }
}

function show(r, source) {
  const box = el('div', 'found');
  if (r.tooShort) {
    box.classList.add('none');
    box.append(el('p', null, 'Evrakta yeterli metin bulunamadı. Taranmış bir görüntüyse metni kutuya yapıştırmayı deneyin.'));
    out.replaceChildren(box);
    return;
  }
  if (!r.suggestions.length) {
    box.classList.add('none');
    box.append(el('p', null, 'Bu evrakın türünü tanıyamadım. İşlemi aşağıdaki formdan kendiniz seçin.'));
    out.replaceChildren(box);
    return;
  }
  const p = el('p');
  p.append(`${source} okundu. Bunu `, el('strong', null, r.label), ` olarak tanıdım.`);
  box.append(p);
  if (r.alternatives?.length) box.append(el('p', 'muted', `Başka bir ihtimal: ${r.alternatives.join(', ')}.`));
  if (r.dates.karar) box.append(el('p', 'muted', `Karar tarihi gibi görünen tarih: ${human(r.dates.karar)}.`));

  const sugs = el('div', 'sugs');
  r.suggestions.forEach((s, i) => {
    const rule = findRule(s.ruleCode);
    const b = el('button', i === 0 ? 'btn primary' : 'btn ghost', `${s.why}: forma aktar`);
    b.type = 'button';
    b.title = `${rule.group} · ${rule.name}`;
    b.addEventListener('click', () => useRule(s.ruleCode, r.dates, b));
    sugs.append(b);
  });
  box.append(sugs);
  box.append(el('p', 'muted', 'Bu bir tahmindir. Belge türünü ve önerilen süreyi kontrol edin; yanlışsa işlemi formdan kendiniz seçin.'));
  out.replaceChildren(box);
}

// Dosya seçme ve sürükle-bırak
$('evrak-file').addEventListener('change', (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleFile(f); });
['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('over'); }));
zone.addEventListener('drop', (e) => { const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); });

// Metin yapıştırma
$('evrak-analyze').addEventListener('click', () => show(analyze($('evrak-text').value), 'Metin'));
