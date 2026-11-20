import { test } from 'node:test';
import assert from 'node:assert/strict';
import { istanbulToday, addDaysISO, dueOffset, planReminders, buildEmail, trDate } from '../supabase/functions/send-reminders/index.ts';

const P = new Map([
  ['u1', { email: 'a@x.com', reminders_on: true }],
  ['u2', { email: 'b@x.com', reminders_on: false }],
]);
const row = (id, last_day, sent = [], user_id = 'u1') => ({ id, user_id, code: `K-${id}`, rule_name: 'İstinaf başvurusu', law: 'HMK m.345', last_day, sent });

test('İstanbul tarihi: UTC 22.30 Türkiye’de ertesi gündür', () => {
  assert.equal(istanbulToday(new Date('2026-11-20T22:30:00Z')), '2026-11-21');
  assert.equal(istanbulToday(new Date('2026-11-20T05:00:00Z')), '2026-11-20');
});

test('tarih toplama ay ve yıl sınırını geçer', () => {
  assert.equal(addDaysISO('2026-12-28', 7), '2027-01-04');
});

test('hatırlatma aralıkları', () => {
  assert.deepEqual([-1, 0, 1, 3, 4, 7, 8].map(dueOffset), [null, 0, 3, 3, 7, 7, null]);
});

test('7, 3 ve son gün hatırlatmaları doğru günde gelir', () => {
  const t = '2026-11-20';
  const g = planReminders([row('a', '2026-11-27'), row('b', '2026-11-23'), row('c', '2026-11-20'), row('d', '2026-11-28')], P, t);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].items.map((i) => [i.id, i.offset]), [['c', 0], ['b', 3], ['a', 7]]);
});

test('gönderilmiş hatırlatma tekrar gitmez, sıradaki gider', () => {
  const t = '2026-11-20';
  assert.equal(planReminders([row('a', '2026-11-25', [7])], P, t).length, 0);        // 5 gün: 7'lik gitti
  assert.equal(planReminders([row('a', '2026-11-22', [7])], P, t)[0].items[0].offset, 3); // 2 gün: 3'lük sırası
  assert.equal(planReminders([row('a', '2026-11-22', [3])], P, t).length, 0);
  assert.equal(planReminders([row('a', '2026-11-20', [7, 3])], P, t)[0].items[0].offset, 0);
  assert.equal(planReminders([row('a', '2026-11-20', [0])], P, t).length, 0);
});

test('zamanlayıcı bir gün kaçırırsa hatırlatma ertesi gün yine gider', () => {
  // 7 gün kala (19 Kasım) çalışmadı; 20 Kasım'da 6 gün kaldı, 7'lik hâlâ gönderilir
  assert.equal(planReminders([row('a', '2026-11-26')], P, '2026-11-20')[0].items[0].offset, 7);
});

test('hatırlatmayı kapatan kullanıcıya e-posta gitmez; profili olmayan atlanır', () => {
  assert.equal(planReminders([row('a', '2026-11-20', [], 'u2'), row('b', '2026-11-20', [], 'u9')], P, '2026-11-20').length, 0);
});

test('e-posta: konu, tarih ve kaçış', () => {
  const g = planReminders([row('<b>', '2026-11-20'), row('x', '2026-11-27')], P, '2026-11-20')[0];
  const m = buildEmail(g, 'https://site/');
  assert.match(m.subject, /Bugün son gün: 1 süre/);
  assert.ok(m.html.includes('K-&lt;b&gt;'));
  assert.ok(!m.html.includes('K-<b>'));
  assert.ok(m.text.includes('20 Kasım 2026 Cuma'));
  assert.ok(m.text.includes('SON GÜN BUGÜN'));
  assert.equal(trDate('2026-09-07'), '7 Eylül 2026 Pazartesi');
});
