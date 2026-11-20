import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../js/engine.js';
import { load, save, makeEntry, status, daysLeft, sortItems, recheck, exportJSON, importJSON, buildICS, KEY } from '../js/store.js';

class MemStorage { constructor() { this.m = new Map(); } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } }
const input = { ruleCode: 'HMK-IST', serviceType: 'e', eventDate: '2026-07-09', recessExempt: false };
const entry = (code = 'A-1', now = new Date('2026-07-10T09:00:00')) => makeEntry(input, calculate(input), code, 'not', now);

test('kayıt oluşturma: son gün, kural ve alternatif saklanır', () => {
  const e = entry();
  assert.equal(e.lastDay, '2026-09-07');
  assert.equal(e.law, 'HMK m.345');
  assert.deepEqual(e.alternatives, ['2026-09-08']);
  assert.equal(e.done, false);
});

test('kısa kod zorunlu ve uzunluk sınırları', () => {
  const r = calculate(input);
  assert.throws(() => makeEntry(input, r, '  ', ''), /Kısa dosya kodu/);
  assert.throws(() => makeEntry(input, r, 'x'.repeat(61), ''), /60/);
  assert.throws(() => makeEntry(input, r, 'A', 'x'.repeat(141)), /140/);
});

test('kaydet / yükle', () => {
  const s = new MemStorage();
  assert.deepEqual(load(s), []);
  save(s, [entry()]);
  assert.equal(load(s).length, 1);
  s.setItem(KEY, '{bozuk');
  assert.deepEqual(load(s), []);
});

test('durum etiketleri', () => {
  const e = entry();
  assert.equal(daysLeft(e.lastDay, '2026-09-01'), 6);
  assert.equal(status(e, '2026-09-01').kind, 'week');
  assert.equal(status(e, '2026-09-05').kind, 'soon');
  assert.equal(status(e, '2026-09-07').kind, 'today');
  assert.equal(status(e, '2026-09-09').label, '2 gün geçti');
  assert.equal(status({ ...e, done: true }, '2026-09-09').kind, 'done');
});

test('sıralama: açık olanlar önce, son güne göre', () => {
  const a = { ...entry('A'), lastDay: '2026-10-01' };
  const b = { ...entry('B'), lastDay: '2026-09-01' };
  const c = { ...entry('C'), lastDay: '2026-08-01', done: true };
  assert.deepEqual(sortItems([a, c, b]).map((x) => x.code), ['B', 'A', 'C']);
});

test('yeniden kontrol: kural değişmediyse fark yok, değiştiyse yeni tarih', () => {
  const e = entry();
  assert.equal(recheck(e), null);
  assert.equal(recheck({ ...e, lastDay: '2026-09-01' }), '2026-09-07');
});

test('yedek al / geri yükle; aynı kayıt iki kez eklenmez', () => {
  const items = [entry('A'), entry('B')];
  const json = exportJSON(items);
  const r1 = importJSON(json, []);
  assert.equal(r1.added, 2);
  const r2 = importJSON(json, r1.items);
  assert.equal(r2.added, 0);
  assert.throws(() => importJSON('{"x":1}', []), /yedeği değil/);
});

test('takvim dosyası: her süre için etkinlik, not alanı yok', () => {
  const e = entry('2026/145 Kadıköy');
  const ics = buildICS([e]);
  assert.match(ics, /DTSTART;VALUE=DATE:20260907/);
  assert.match(ics, /TRIGGER:-P7D/);
  assert.ok(!ics.includes('not'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
});
