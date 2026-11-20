// Arayüz: formu okur, motoru çağırır, sonucu ekrana yazar. Hesaplama mantığı engine.js'tedir.
import { RULES, findRule } from './rules.js';
import { calculate } from './engine.js';

const $ = (id) => document.getElementById(id);
const form = $('form');
const select = $('islem');
let last = null;

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
