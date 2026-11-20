// Mühlet Süre — süre hesaplama motoru (saf JavaScript, tarayıcıya ve Node'a bağımlı değil).
// Tarihler 'YYYY-MM-DD' metni olarak girer ve çıkar; içeride UTC gün aritmetiği kullanılır (saat dilimi sorunu olmaz).
// İlke: Belirsiz durumlarda en erken (temkinli) tarih son gün olarak gösterilir, diğer yorum "alternatif" olarak verilir.

import { findRule } from './rules.js';
import { HOLIDAYS, SUPPORTED_YEARS } from './holidays.js';

const DAY = 86400000;
const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// ---- tarih yardımcıları ----
export function parse(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) throw new Error('Tarih YYYY-AA-GG biçiminde olmalı.');
  const [y, m, d] = iso.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) throw new Error(`Geçersiz tarih: ${iso}`);
  return t;
}
export const iso = (t) => new Date(t).toISOString().slice(0, 10);
export const addDays = (t, n) => t + n * DAY;
export function addMonths(t, n) {
  const d = new Date(t);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(day, last)); // karşılık gelen gün yoksa ayın son günü
}
export const weekday = (t) => WEEKDAYS[new Date(t).getUTCDay()];
export function formatTR(t) {
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
const fmt = (t) => `${formatTR(t)} ${weekday(t)}`;

const isWeekend = (t) => { const w = new Date(t).getUTCDay(); return w === 0 || w === 6; };
const holiday = (t) => HOLIDAYS.get(iso(t));
const isFullHoliday = (t) => holiday(t)?.type === 'full';
export const isBusinessDay = (t) => !isWeekend(t) && !isFullHoliday(t);

function inRecess(t) {
  const d = new Date(t); const y = d.getUTCFullYear();
  return t >= Date.UTC(y, 6, 20) && t <= Date.UTC(y, 7, 31); // 20 Temmuz – 31 Ağustos
}
const recessEnd = (t) => Date.UTC(new Date(t).getUTCFullYear(), 7, 31);

// Adli tatil uzatma politikaları. early = temkinli hesap, alt = uygulamadaki diğer yorum (varsa).
export const RECESS_POLICIES = {
  HMK: { early: 7, alt: 8, law: 'HMK m.104', text: 'Süre, adli tatilin bittiği günden itibaren 1 hafta uzamış sayılır.',
    altText: 'Yargıtay HGK (2017) uzatmayı 1 Eylül\'den sayıyor; bu yoruma göre son gün' },
  IYUK: { early: 7, alt: 8, law: 'İYUK m.8/3', text: 'Süre, ara vermenin sona ermesinden itibaren 7 gün uzamış sayılır.',
    altText: '"Ara vermenin sona erdiği günü izleyen tarihten itibaren" ifadesini 1 Eylül\'den sayan yoruma göre son gün' },
  CMK: { early: 3, alt: null, law: 'CMK m.331/4', text: 'Adli tatile rastlayan süreler işlemez; tatilin bittiği günden itibaren 3 gün uzamış sayılır.' },
  IIK: null, // icra dairesi işlemlerinde adli tatil uzatması uygulanmaz (AVUKATA SOR)
};

function versionFor(rule, decisionDate) {
  if (rule.versions.length === 1) return rule.versions[0];
  if (!decisionDate) throw new Error('Bu işlem için karar tarihi gerekli (hangi kuralın uygulanacağını belirler).');
  const v = rule.versions.find((x) => (!x.validFrom || decisionDate >= x.validFrom) && (!x.validTo || decisionDate <= x.validTo));
  if (!v) throw new Error('Karar tarihine uygun kural sürümü bulunamadı.');
  return v;
}

// Hafta sonu ve tam gün resmî tatilleri atlar; atlanan günleri hesap izine yazar.
const ROLL_BASIS = { HMK: 'HMK m.93', IYUK: 'İYUK m.8/2', CMK: 'CMK m.39/3', IIK: 'İİK m.19' };
function rollForward(t, trace, court) {
  const start = t;
  const reasons = [];
  while (!isBusinessDay(t)) {
    reasons.push(isWeekend(t) && !isFullHoliday(t) ? `${formatTR(t)} hafta sonu` : `${formatTR(t)} ${holiday(t).name}`);
    t = addDays(t, 1);
  }
  if (t !== start) trace.push({ date: iso(t), text: `İş günü değil (${reasons.join(', ')}). Süre izleyen ilk iş günü sona erer.`, basis: ROLL_BASIS[court] });
  return t;
}

/**
 * Tek bir hesap. opts.etebShift: e-tebligatın 5. günü tatilse ilk iş gününe kaydır. opts.recessAlt: alternatif tatil yorumu.
 */
function run(input, opts) {
  const rule = findRule(input.ruleCode);
  const v = versionFor(rule, input.decisionDate);
  const event = parse(input.eventDate);
  const trace = [];
  const warnings = [];
  const years = new Set();

  // 1) Tebliğ (başlangıç) tarihi
  let start;
  if (input.serviceType === 'e') {
    trace.push({ date: iso(event), text: 'e-Tebligat elektronik adrese ulaştı.' });
    start = addDays(event, 5);
    let txt = 'Ulaştığı günü izleyen 5. günün sonunda tebliğ edilmiş sayılır (belgenin erken açılması bu tarihi değiştirmez).';
    if (opts.etebShift && !isBusinessDay(start)) {
      const shifted = rollForward(start, []);
      txt += ` 5. gün (${formatTR(start)}) iş günü olmadığından izleyen ilk iş günü esas alındı.`;
      start = shifted;
    }
    trace.push({ date: iso(start), text: `Tebliğ tarihi. ${txt}`, basis: 'Tebligat K. m.7/a' });
  } else if (input.serviceType === 'fiziki') {
    start = event;
    trace.push({ date: iso(start), text: 'Tebliğ tarihi (tebellüğ).', basis: 'Tebligat Kanunu' });
  } else if (input.serviceType === 'tefhim') {
    start = event;
    trace.push({ date: iso(start), text: 'Karar yüze karşı açıklandı (tefhim).' });
  } else {
    throw new Error('Tebligat türü seçilmeli.');
  }
  years.add(new Date(start).getUTCFullYear());

  // 2) Süreyi ekle (başlangıç günü sayılmaz)
  let end;
  const unitTxt = { day: 'gün', week: 'hafta', month: 'ay' }[v.unit];
  if (v.unit === 'day') end = addDays(start, v.amount);
  else if (v.unit === 'week') end = addDays(start, 7 * v.amount);
  else if (v.unit === 'month') end = addMonths(start, v.amount);
  else throw new Error('Bilinmeyen süre birimi.');
  const versionNote = rule.versions.length > 1 ? ` Karar tarihine göre uygulanan sürüm: ${v.law}.` : '';
  trace.push({ date: iso(end), text: `${rule.name} süresi ${v.amount} ${unitTxt}. Başlangıç günü sayılmaz.${versionNote}`, basis: v.law });

  // 3) Hafta sonu / resmî tatil, ardından adli tatil (gerekirse tekrar)
  const policy = RECESS_POLICIES[rule.court];
  let recessApplied = false;
  const rawInRecess = inRecess(end);
  let rolledIntoRecess = false;
  for (let i = 0; i < 3; i++) {
    end = rollForward(end, trace, rule.court);
    years.add(new Date(end).getUTCFullYear());
    if (!recessApplied && inRecess(end) && !rawInRecess && policy && !input.recessExempt && !opts.extendRolled) {
      // Süre adli tatilden önce bitiyor ama hafta sonu/tatil kaydırmasıyla tatile giriyor: temkinli olarak uzatma yapma
      rolledIntoRecess = true;
      warnings.push({ level: 'ask', text: 'Süre adli tatilden hemen önce bitiyor; hafta sonu/tatil kaydırmasıyla son gün adli tatilin ilk gününe denk geliyor. Temkinli olarak uzatma uygulanmadı. Avukata doğrulatın.' });
      break;
    }
    if (!recessApplied && inRecess(end)) {
      if (!policy) {
        trace.push({ text: 'Son gün adli tatile denk geliyor; bu işlem türünde adli tatil uzatması uygulanmaz.', basis: 'İİK' });
        warnings.push({ level: 'ask', text: 'İcra dairesi işlemlerinde adli tatil uzatması uygulanmadığı varsayıldı. Avukata doğrulatın.' });
        break;
      }
      if (input.recessExempt) {
        trace.push({ text: 'Son gün adli tatile denk geliyor, ancak dosya adli tatilde görülen işlerden olduğu için süre uzamaz.', basis: rule.court === 'CMK' ? 'CMK m.331/3' : 'HMK m.103' });
        break;
      }
      const plus = opts.recessAlt && policy.alt ? policy.alt : policy.early;
      trace.push({ text: `Son gün adli tatile (20 Temmuz – 31 Ağustos) denk geliyor.`, basis: rule.court === 'IYUK' ? 'İYUK m.61' : rule.court === 'CMK' ? 'CMK m.331/1' : 'HMK m.102' });
      end = addDays(recessEnd(end), plus);
      trace.push({ date: iso(end), text: policy.text, basis: policy.law });
      recessApplied = true;
      continue;
    }
    break;
  }

  // CMK: tebliğ adli tatil içindeyse süre tatilde hiç işlemeyebilir
  if (rule.court === 'CMK' && !input.recessExempt && inRecess(start) && !recessApplied) {
    warnings.push({ level: 'ask', text: 'Tebliğ adli tatil içinde. CMK m.331/4 uyarınca sürenin tatilde hiç işlemeyeceği yorumu da var; bu durumda son gün daha geç olabilir. Gösterilen tarih temkinli olandır. Avukata doğrulatın.' });
  }

  // Arife uyarısı
  if (holiday(end)?.type === 'half') {
    warnings.push({ level: 'ask', text: `Son gün ${holiday(end).name} (yarım gün). Resmî tatil 13.00'te başlar; işlemi öğleden önce yapın ve uygulamayı avukata doğrulatın.` });
  }
  // Tatil verisi kapsamı
  for (const y of years) {
    if (!SUPPORTED_YEARS.includes(y)) warnings.push({ level: 'data', text: `${y} yılı için tatil verisi yok; resmî tatiller hesaba katılmadı.` });
  }

  return { rule, version: v, start: iso(start), lastDay: iso(end), trace, warnings, recessApplied, rolledIntoRecess, policy };
}

/**
 * Ana fonksiyon. input: { ruleCode, serviceType: 'e'|'fiziki'|'tefhim', eventDate, decisionDate?, recessExempt? }
 * Döner: { lastDay, lastDayText, rule, trace, warnings, alternatives: [{lastDay, text, reason}] }
 */
export function calculate(input) {
  const primary = run(input, { etebShift: false, recessAlt: false });
  const alternatives = [];

  if (primary.recessApplied && primary.policy?.alt) {
    const alt = run(input, { etebShift: false, recessAlt: true });
    if (alt.lastDay !== primary.lastDay) {
      alternatives.push({ lastDay: alt.lastDay, text: `${formatTR(parse(alt.lastDay))} ${weekday(parse(alt.lastDay))}`, reason: primary.policy.altText });
    }
  }
  if (primary.rolledIntoRecess) {
    const alt = run(input, { etebShift: false, recessAlt: false, extendRolled: true });
    if (alt.lastDay !== primary.lastDay) {
      alternatives.push({ lastDay: alt.lastDay, text: `${formatTR(parse(alt.lastDay))} ${weekday(parse(alt.lastDay))}`,
        reason: 'Kaydırılan son günün adli tatile rastladığını kabul edip uzatma uygulayan yoruma göre son gün' });
    }
  }
  if (input.serviceType === 'e' && !isBusinessDay(addDays(parse(input.eventDate), 5))) {
    const alt = run(input, { etebShift: true, recessAlt: false });
    if (alt.lastDay !== primary.lastDay && !alternatives.some((a) => a.lastDay === alt.lastDay)) {
      alternatives.push({ lastDay: alt.lastDay, text: `${formatTR(parse(alt.lastDay))} ${weekday(parse(alt.lastDay))}`,
        reason: 'e-Tebligatın 5. günü iş günü olmadığında tebliğin izleyen ilk iş gününe kaydığını kabul eden yoruma göre son gün' });
    }
  }
  alternatives.sort((a, b) => (a.lastDay < b.lastDay ? -1 : 1));

  return {
    lastDay: primary.lastDay,
    lastDayText: formatTR(parse(primary.lastDay)),
    lastDayWeekday: weekday(parse(primary.lastDay)),
    rule: primary.rule,
    version: primary.version,
    trace: primary.trace.map((s) => ({ ...s, dateText: s.date ? fmt(parse(s.date)) : null })),
    warnings: primary.warnings,
    alternatives,
  };
}
