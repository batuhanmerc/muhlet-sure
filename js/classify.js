// "Evrakı bırak, süre gelsin": evrak metninden belge türünü ve önerilecek süreyi tahmin eder.
// Saf JavaScript: tarayıcıda ve Node'da (testlerde) çalışır. Hiçbir veri dışarı gönderilmez.
// İLKE: Bu bir ÖNERİDİR. Kullanıcı onaylamadan hiçbir süre hesaplanmaz ya da kaydedilmez.

// Türkçe büyük/küçük harf ve aksan farklarını yok sayan sadeleştirme
export function normalize(text) {
  return (text || '')
    .replace(/İ/g, 'i').replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^\S\n]+/g, ' ');
}

const has = (t, ...words) => words.some((w) => t.includes(w));
// Kısa sözcükler için tam kelime eşleşmesi (ör. 'çek' kelimesi 'gerçek' içinde eşleşmesin)
const word = (t, ...words) => words.some((w) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(t));

// Kurallar yukarıdan aşağıya denenir; ilk eşleşen en güçlü kabul edilir. Anahtar sözcükler normalize edilmiş haldedir.
const DOC_RULES = [
  {
    type: 'bilirkisi', label: 'Bilirkişi raporu',
    test: (t) => has(t, 'bilirkisi raporu', 'bilirkisi heyeti raporu', 'bilirkisi incelemesi raporu'),
    suggest: () => [{ ruleCode: 'HMK-BLR', why: 'Bilirkişi raporuna itiraz süresi' }],
  },
  {
    type: 'odeme-emri-kambiyo', label: 'Ödeme emri (kambiyo senedi)',
    test: (t) => has(t, 'odeme emri') && (has(t, 'kambiyo', 'ornek 10', 'ornek no: 10', 'ornek no 10') || word(t, 'cek', 'bono', 'police')),
    suggest: () => [{ ruleCode: 'IIK-KMB', why: 'Kambiyo senedine dayalı takipte itiraz süresi' }],
  },
  {
    type: 'odeme-emri', label: 'Ödeme emri (genel haciz)',
    test: (t) => has(t, 'odeme emri'),
    suggest: () => [{ ruleCode: 'IIK-ITR', why: 'Ödeme emrine itiraz süresi' }],
  },
  {
    type: 'ihbarname', label: 'Vergi / ceza ihbarnamesi',
    test: (t) => has(t, 'ihbarname') && has(t, 'vergi'),
    suggest: () => [{ ruleCode: 'IYUK-VRG', why: 'Vergi mahkemesinde dava açma süresi' }],
  },
  {
    type: 'cevap-dilekcesi', label: 'Cevap dilekçesi',
    test: (t) => has(t, 'cevap dilekcesi', 'cevaplarimizdir', 'cevap dilekcemizdir'),
    suggest: () => [{ ruleCode: 'HMK-REP', why: 'Cevaba cevap dilekçesi süresi' }],
  },
  {
    type: 'dava-dilekcesi', label: 'Dava dilekçesi',
    test: (t) => has(t, 'dava dilekcesi') || (has(t, 'davaci') && has(t, 'davali') && has(t, 'sonuc ve istem', 'netice ve talep', 'talep sonucu') && !has(t, 'hukum', 'gerekceli karar')),
    suggest: () => [{ ruleCode: 'HMK-CVP', why: 'Cevap dilekçesi süresi' }],
  },
  {
    type: 'bam-hukuk', label: 'Bölge adliye mahkemesi kararı (hukuk)',
    test: (t) => has(t, 'bolge adliye mahkemesi') && has(t, 'hukuk dairesi'),
    suggest: () => [{ ruleCode: 'HMK-TMZ', why: 'Bölge adliye kararına karşı temyiz süresi' }],
  },
  {
    type: 'bam-ceza', label: 'Bölge adliye mahkemesi kararı (ceza)',
    test: (t) => has(t, 'bolge adliye mahkemesi') && has(t, 'ceza dairesi'),
    suggest: () => [{ ruleCode: 'CMK-TMZ', why: 'Bölge adliye kararına karşı temyiz süresi' }],
  },
  {
    type: 'karar-idari', label: 'İdare / vergi mahkemesi kararı',
    test: (t) => has(t, 'idare mahkemesi', 'vergi mahkemesi') && has(t, 'karar'),
    suggest: () => [{ ruleCode: 'IYUK-IST', why: 'İdari yargıda istinaf / temyiz süresi' }],
  },
  {
    type: 'karar-ceza', label: 'Ceza mahkemesi kararı',
    test: (t) => has(t, 'asliye ceza', 'agir ceza', 'sulh ceza', 'cocuk mahkemesi') || (has(t, 'sanik') && has(t, 'hukum', 'karar')),
    suggest: () => [{ ruleCode: 'CMK-IST', why: 'Ceza kararına karşı istinaf süresi' }],
  },
  {
    type: 'karar-hukuk', label: 'Hukuk mahkemesi kararı',
    test: (t) => (has(t, 'gerekceli karar', 'hukum', 'karar') && has(t, 'asliye hukuk', 'asliye ticaret', 'is mahkemesi', 'sulh hukuk', 'aile mahkemesi', 'tuketici mahkemesi', 'kadastro mahkemesi', 'icra hukuk', 'davaci')),
    suggest: () => [{ ruleCode: 'HMK-IST', why: 'Hukuk kararına karşı istinaf süresi' }],
  },
];

const DATE_RE = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g;

function toISO(d, m, y) {
  const dd = +d, mm = +m, yy = +y;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 2000 || yy > 2100) return null;
  const t = new Date(Date.UTC(yy, mm - 1, dd));
  if (t.getUTCMonth() !== mm - 1) return null;
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

// Metindeki tarihleri ve "karar tarihi" gibi etiketlere yakın olanları bulur
export function findDates(rawText) {
  const t = normalize(rawText);
  const all = [];
  let m;
  DATE_RE.lastIndex = 0;
  while ((m = DATE_RE.exec(t))) {
    const iso = toISO(m[1], m[2], m[3]);
    if (iso) {
      // Etiket aramasını önceki tarihe, satır sonuna ya da virgüle kadar sınırla
      const win = t.slice(Math.max(0, m.index - 40), m.index);
      const before = win.split(/[,;\n]|\d{1,2}[./-]\d{1,2}[./-]\d{4}/).pop();
      all.push({ iso, index: m.index, before });
    }
  }
  const near = (...labels) => all.find((d) => labels.some((l) => d.before.includes(l)))?.iso || null;
  return {
    all: [...new Set(all.map((d) => d.iso))],
    karar: near('karar tarihi', 'hukum tarihi', 'karar t.'),
    teblig: near('teblig tarihi', 'teblig edildi', 'tebligat tarihi'),
  };
}

const unique = (arr) => [...new Map(arr.map((x) => [x.ruleCode, x])).values()];

/**
 * analyze(text) → { docType, label, confidence: 'yüksek'|'orta'|'düşük'|null, suggestions: [{ruleCode, why}], dates, tooShort }
 */
export function analyze(rawText) {
  const t = normalize(rawText);
  const dates = findDates(rawText);
  if (t.replace(/\s/g, '').length < 40) {
    return { docType: null, label: null, confidence: null, suggestions: [], dates, tooShort: true };
  }
  const hits = DOC_RULES.filter((r) => r.test(t));
  if (!hits.length) {
    return { docType: null, label: null, confidence: null, suggestions: [], dates, tooShort: false };
  }
  const first = hits[0];
  const suggestions = unique(hits.flatMap((h) => h.suggest()));
  const confidence = hits.length === 1 ? 'yüksek' : suggestions.length === 1 ? 'yüksek' : 'orta';
  return { docType: first.type, label: first.label, confidence, suggestions, dates, tooShort: false, alternatives: hits.slice(1).map((h) => h.label) };
}
