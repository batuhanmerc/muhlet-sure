// Örnek metinler uydurmadır; gerçek kişi ya da dosya bilgisi içermez.
// Gerçek (anonimleştirilmiş) UYAP evraklarıyla yeni testler eklenmelidir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, findDates, normalize } from '../js/classify.js';
import { xmlToText } from '../js/docreader.js';

const doc = (s) => s + '\n'.repeat(2) + 'Bu metin test için uydurulmuştur ve gerçek bir dosyaya ait değildir.';

test('normalize: Türkçe karakterler', () => {
  assert.equal(normalize('GEREKÇELİ KARAR – İSTANBUL'), 'gerekceli karar – istanbul');
});

test('Hukuk gerekçeli karar → HMK istinaf, karar tarihi bulunur', () => {
  const r = analyze(doc(`T.C. İSTANBUL 12. ASLİYE TİCARET MAHKEMESİ
GEREKÇELİ KARAR
ESAS NO: 2025/111  KARAR NO: 2026/222
DAVACI: X A.Ş.   DAVALI: Y Ltd. Şti.
KARAR TARİHİ: 02/07/2026
HÜKÜM: Davanın kabulüne ...`));
  assert.equal(r.docType, 'karar-hukuk');
  assert.deepEqual(r.suggestions.map((s) => s.ruleCode), ['HMK-IST']);
  assert.equal(r.dates.karar, '2026-07-02');
});

test('Ceza kararı → CMK istinaf, karar tarihi', () => {
  const r = analyze(doc(`T.C. ANKARA 5. ASLİYE CEZA MAHKEMESİ
GEREKÇELİ KARAR
SANIK: ...  SUÇ: ...
KARAR TARİHİ : 15.07.2026
HÜKÜM: Sanığın ...`));
  assert.equal(r.docType, 'karar-ceza');
  assert.deepEqual(r.suggestions.map((s) => s.ruleCode), ['CMK-IST']);
  assert.equal(r.dates.karar, '2026-07-15');
});

test('Bölge adliye hukuk dairesi kararı → HMK temyiz (istinaf değil)', () => {
  const r = analyze(doc(`T.C. İSTANBUL BÖLGE ADLİYE MAHKEMESİ 14. HUKUK DAİRESİ
KARAR TARİHİ: 01.10.2026
DAVACI ... DAVALI ... HÜKÜM: İstinaf başvurusunun esastan reddine`));
  assert.equal(r.docType, 'bam-hukuk');
  assert.equal(r.suggestions[0].ruleCode, 'HMK-TMZ');
});

test('Bilirkişi raporu → rapora itiraz', () => {
  const r = analyze(doc(`İSTANBUL 3. İŞ MAHKEMESİ SAYIN HAKİMLİĞİNE
BİLİRKİŞİ RAPORU
Dosya: 2026/45 Esas. Davacı ... davalı ... hesaplama yapılmıştır.`));
  assert.equal(r.docType, 'bilirkisi');
  assert.equal(r.suggestions[0].ruleCode, 'HMK-BLR');
});

test('Ödeme emri: genel haciz ve kambiyo ayrımı', () => {
  const genel = analyze(doc('İSTANBUL 9. İCRA DAİRESİ\nÖRNEK NO: 7\nÖDEME EMRİ\nBorçlu ... alacak miktarı ...'));
  assert.equal(genel.suggestions[0].ruleCode, 'IIK-ITR');
  const kambiyo = analyze(doc('İSTANBUL 9. İCRA DAİRESİ\nÖRNEK NO: 10\nKAMBİYO SENETLERİNE MAHSUS HACİZ YOLUYLA TAKİPTE ÖDEME EMRİ\nBono ...'));
  assert.equal(kambiyo.suggestions[0].ruleCode, 'IIK-KMB');
});

test('Dava dilekçesi → cevap dilekçesi süresi', () => {
  const r = analyze(doc('İSTANBUL ( ) ASLİYE HUKUK MAHKEMESİNE\nDAVACI: ...\nDAVALI: ...\nKONU: ...\nAÇIKLAMALAR: ...\nSONUÇ VE İSTEM: Davanın kabulüne karar verilmesini ...'));
  assert.equal(r.docType, 'dava-dilekcesi');
  assert.equal(r.suggestions[0].ruleCode, 'HMK-CVP');
});

test('İdare mahkemesi kararı → İYUK istinaf', () => {
  const r = analyze(doc('T.C. ANKARA 2. İDARE MAHKEMESİ\nKARAR\nDAVACI ... DAVALI: ... Bakanlığı\nKARAR TARİHİ: 03.03.2026'));
  assert.equal(r.docType, 'karar-idari');
  assert.equal(r.suggestions[0].ruleCode, 'IYUK-IST');
});

test('Tanınmayan metin → öneri yok', () => {
  const r = analyze('Bu bir alışveriş listesidir: elma, armut, ekmek, süt, peynir, zeytin, domates.');
  assert.equal(r.docType, null);
  assert.equal(r.suggestions.length, 0);
});

test('Çok kısa metin', () => {
  assert.equal(analyze('kısa').tooShort, true);
});

test('Tarih bulma: geçersiz tarihler atlanır', () => {
  const d = findDates('Karar tarihi: 31.02.2026, tebliğ tarihi 05/03/2026, diğer 1.1.2027');
  assert.equal(d.karar, null);
  assert.equal(d.teblig, '2026-03-05');
  assert.deepEqual(d.all, ['2026-03-05', '2027-01-01']);
});

test('UDF XML: CDATA içindeki metin çıkarılır', () => {
  const xml = '<?xml version="1.0"?><template><content><![CDATA[GEREKÇELİ KARAR\nKARAR TARİHİ: 02.07.2026]]></content><properties/></template>';
  assert.match(xmlToText(xml), /GEREKÇELİ KARAR/);
});
