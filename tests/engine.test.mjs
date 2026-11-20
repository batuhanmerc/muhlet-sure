// Çalıştırma: npm test  (Node 18+)
// Bu testler motorun kendi mantığını doğrular. Avukatın hazırlayacağı "altın veri seti" örnekleri ayrıca buraya eklenmelidir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, addMonths, parse, iso, isBusinessDay } from '../js/engine.js';

const calc = (o) => calculate({ recessExempt: false, ...o });

test('e-tebligat + HMK istinaf, son gün adli tatilde → 7 Eylül, alternatif 8 Eylül', () => {
  const r = calc({ ruleCode: 'HMK-IST', serviceType: 'e', eventDate: '2026-07-09' });
  assert.equal(r.lastDay, '2026-09-07');
  assert.equal(r.lastDayWeekday, 'Pazartesi');
  assert.deepEqual(r.alternatives.map((a) => a.lastDay), ['2026-09-08']);
  assert.ok(r.trace.some((s) => s.date === '2026-07-14' && s.basis === 'Tebligat K. m.7/a'));
  assert.ok(r.trace.some((s) => s.date === '2026-07-28'));
});

test('Adli tatilde görülen iş (ör. iş davası): uzatma yok', () => {
  const r = calc({ ruleCode: 'HMK-IST', serviceType: 'e', eventDate: '2026-07-09', recessExempt: true });
  assert.equal(r.lastDay, '2026-07-28');
  assert.equal(r.alternatives.length, 0);
});

test('Son gün adli tatilden sonra ise uzatma yok', () => {
  const r = calc({ ruleCode: 'HMK-CVP', serviceType: 'fiziki', eventDate: '2026-08-25' });
  assert.equal(r.lastDay, '2026-09-08'); // 25 Ağu + 2 hafta = 8 Eylül Salı
  assert.equal(r.alternatives.length, 0);
});

test('CMK istinaf v2 (7499 sonrası), son gün tatilde → 3 Eylül', () => {
  const r = calc({ ruleCode: 'CMK-IST', serviceType: 'fiziki', eventDate: '2026-08-01', decisionDate: '2026-07-15' });
  assert.equal(r.version.law, 'CMK m.273 (7499 sonrası)');
  assert.equal(r.lastDay, '2026-09-03'); // 1 Ağu + 14 = 15 Ağu (tatil) → 31 Ağu + 3
  assert.ok(r.warnings.length === 0 || r.warnings.every((w) => w.level !== 'data'));
});

test('CMK istinaf v1 (7499 öncesi karar) → 7 gün', () => {
  const r = calc({ ruleCode: 'CMK-IST', serviceType: 'tefhim', eventDate: '2025-02-03', decisionDate: '2024-05-20' });
  assert.equal(r.version.law, 'CMK m.273 (7499 öncesi)');
  assert.equal(r.lastDay, '2025-02-10');
});

test('CMK karar tarihi verilmezse hata', () => {
  assert.throws(() => calc({ ruleCode: 'CMK-TMZ', serviceType: 'fiziki', eventDate: '2026-02-02' }), /karar tarihi/);
});

test('İYUK 60 gün, son gün tatilde → 7 Eylül, alternatif 8 Eylül', () => {
  const r = calc({ ruleCode: 'IYUK-IDR', serviceType: 'fiziki', eventDate: '2026-06-10' });
  assert.equal(r.lastDay, '2026-09-07');
  assert.deepEqual(r.alternatives.map((a) => a.lastDay), ['2026-09-08']);
});

test('İYUK 60 gün, son gün tatilden sonra → uzatma yok', () => {
  const r = calc({ ruleCode: 'IYUK-IDR', serviceType: 'fiziki', eventDate: '2026-07-10' });
  assert.equal(r.lastDay, '2026-09-08');
});

test('İİK: son gün adli tatilde → uzatma yok, sadece uyarı', () => {
  const r = calc({ ruleCode: 'IIK-ITR', serviceType: 'fiziki', eventDate: '2026-07-28' });
  assert.equal(r.lastDay, '2026-08-04');
  assert.ok(r.warnings.some((w) => w.level === 'ask'));
});

test('Bayram + hafta sonu kaydırması: 20 Mart 2026 → 23 Mart Pazartesi', () => {
  const r = calc({ ruleCode: 'IIK-ITR', serviceType: 'fiziki', eventDate: '2026-03-13' });
  assert.equal(r.lastDay, '2026-03-23');
});

test('15 Temmuz resmî tatil kaydırması', () => {
  const r = calc({ ruleCode: 'IIK-ITR', serviceType: 'fiziki', eventDate: '2026-07-08' });
  assert.equal(r.lastDay, '2026-07-16');
});

test('Arife (yarım gün) iş günü sayılır ama uyarı verilir', () => {
  const r = calc({ ruleCode: 'IIK-ITR', serviceType: 'fiziki', eventDate: '2026-03-12' });
  assert.equal(r.lastDay, '2026-03-19');
  assert.ok(r.warnings.some((w) => /arifesi/.test(w.text)));
});

test('e-tebligatın 5. günü hafta sonu: temkinli tarih + alternatif', () => {
  const r = calc({ ruleCode: 'IIK-KMB', serviceType: 'e', eventDate: '2026-11-16' });
  assert.equal(r.lastDay, '2026-11-26'); // tebliğ 21 Kas (Cmt) + 5 = 26 Kas Perşembe
  assert.deepEqual(r.alternatives.map((a) => a.lastDay), ['2026-11-30']);
});

test('Hafta sonu kaydırmasıyla tatile giren son gün: temkinli 20 Temmuz, alternatif 7 Eylül', () => {
  // 4 Tem 2026 Cmt + 2 hafta = 18 Tem Cmt → 20 Tem Pzt (adli tatilin ilk günü)
  const r = calc({ ruleCode: 'HMK-CVP', serviceType: 'fiziki', eventDate: '2026-07-04' });
  assert.equal(r.lastDay, '2026-07-20');
  assert.deepEqual(r.alternatives.map((a) => a.lastDay), ['2026-09-07']);
  assert.ok(r.warnings.some((w) => /kaydırmasıyla/.test(w.text)));
});

test('Desteklenmeyen yıl için veri uyarısı', () => {
  const r = calc({ ruleCode: 'IIK-ITR', serviceType: 'fiziki', eventDate: '2028-03-01' });
  assert.ok(r.warnings.some((w) => w.level === 'data'));
});

test('Ay ekleme: karşılık gelen gün yoksa ayın son günü', () => {
  assert.equal(iso(addMonths(parse('2026-01-31'), 1)), '2026-02-28');
  assert.equal(iso(addMonths(parse('2028-01-31'), 1)), '2028-02-29');
});

test('Geçersiz tarih reddedilir', () => {
  assert.throws(() => calc({ ruleCode: 'IIK-ITR', serviceType: 'fiziki', eventDate: '2026-02-30' }), /Geçersiz/);
});

test('İş günü: 29 Ekim tatil, 28 Ekim (arife) iş günü', () => {
  assert.equal(isBusinessDay(parse('2026-10-29')), false);
  assert.equal(isBusinessDay(parse('2026-10-28')), true);
});
