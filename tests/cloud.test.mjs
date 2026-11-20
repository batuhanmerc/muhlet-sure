import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCloud, merge, toRow, fromRow } from '../js/cloud.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
// Sahte sunucu: istekleri kaydeder, sıradaki cevabı döner
function fakeFetch(responses) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, ...opts, json: opts.body ? JSON.parse(opts.body) : undefined });
    const r = responses.shift() || { status: 200, body: null };
    return { ok: r.status < 400, status: r.status, text: async () => (r.body == null ? '' : JSON.stringify(r.body)) };
  };
  fn.calls = calls;
  return fn;
}
const entry = (id, extra = {}) => ({ id, code: `K${id}`, note: 'gizli not', input: { ruleCode: 'HMK-IST', serviceType: 'e', eventDate: '2026-07-09' }, ruleName: 'İstinaf başvurusu', law: 'HMK m.345', lastDay: '2026-09-07', alternatives: ['2026-09-08'], createdAt: '2026-11-01T10:00:00Z', done: false, doneAt: null, ...extra });
const login = { status: 200, body: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: 'U1', email: 'a@x.com' } } };

test('kod gönderme ve giriş; oturum saklanır', async () => {
  const f = fakeFetch([{ status: 200, body: {} }, login]);
  const st = memStorage();
  const c = createCloud({ url: 'https://p.supabase.co/', anonKey: 'ANON', storage: st, fetchFn: f });
  await c.sendCode('a@x.com');
  assert.equal(f.calls[0].url, 'https://p.supabase.co/auth/v1/otp');
  assert.deepEqual(f.calls[0].json, { email: 'a@x.com', create_user: true });
  const u = await c.verifyCode('a@x.com', '123456');
  assert.equal(u.email, 'a@x.com');
  assert.deepEqual(f.calls[1].json, { type: 'email', email: 'a@x.com', token: '123456' });
  // Yeni sayfa yüklemesinde oturum hatırlanır
  const c2 = createCloud({ url: 'https://p.supabase.co', anonKey: 'ANON', storage: st, fetchFn: f });
  assert.equal(c2.user.id, 'U1');
});

test('buluta giden kayıtta not YOKTUR', async () => {
  const f = fakeFetch([login, { status: 201, body: null }]);
  const c = createCloud({ url: 'https://p', anonKey: 'ANON', storage: memStorage(), fetchFn: f });
  await c.verifyCode('a@x.com', '123456');
  await c.push([entry('1')]);
  const call = f.calls[1];
  assert.match(call.url, /\/rest\/v1\/deadlines\?on_conflict=user_id,local_id$/);
  assert.equal(call.headers.Authorization, 'Bearer AT');
  assert.match(call.headers.Prefer, /merge-duplicates/);
  assert.ok(!JSON.stringify(call.json).includes('gizli not'));
  assert.equal(call.json[0].local_id, '1');
  assert.equal(call.json[0].rule_code, 'HMK-IST');
});

test('süresi dolan oturum kendiliğinden yenilenir', async () => {
  let t = 0;
  const f = fakeFetch([{ ...login, body: { ...login.body, expires_in: 100 } }, { ...login, body: { ...login.body, access_token: 'AT2' } }, { status: 200, body: [] }]);
  const c = createCloud({ url: 'https://p', anonKey: 'ANON', storage: memStorage(), fetchFn: f, now: () => t });
  await c.verifyCode('a@x.com', '123456');
  t = 50_000; // 50 sn sonra: bitmesine 50 sn kaldı → yenile
  await c.pull();
  assert.match(f.calls[1].url, /grant_type=refresh_token/);
  assert.equal(f.calls[2].headers.Authorization, 'Bearer AT2');
});

test('hatalar Türkçe ve anlaşılır', async () => {
  const f = fakeFetch([{ status: 429, body: { msg: 'Email rate limit exceeded' } }, { status: 403, body: { msg: 'Token has expired or is invalid' } }]);
  const c = createCloud({ url: 'https://p', anonKey: 'ANON', storage: memStorage(), fetchFn: f });
  await assert.rejects(c.sendCode('a@x.com'), /Çok sık denediniz/);
  await assert.rejects(c.verifyCode('a@x.com', '000000'), /Kod hatalı/);
  await assert.rejects(c.pull(), /Giriş yapmadınız/);
});

test('çevrimdışı silme: işaret kalır, sunucuya ulaşınca silinir', async () => {
  const f = fakeFetch([login, { status: 204 }]);
  const st = memStorage();
  const c = createCloud({ url: 'https://p', anonKey: 'ANON', storage: st, fetchFn: f });
  await c.verifyCode('a@x.com', '123456');
  c.markDeleted('a"b'); c.markDeleted('x-1');
  assert.deepEqual(c.pendingDeletes(), ['a"b', 'x-1']);
  await c.flushDeletes();
  assert.equal(f.calls[1].method, 'DELETE');
  assert.equal(decodeURIComponent(f.calls[1].url.split('local_id=in.')[1]), '("ab","x-1")');
  assert.deepEqual(c.pendingDeletes(), []);
});

test('birleştirme: yeni olan kazanır, not yerelden gelir, silinen geri gelmez', () => {
  const local = [entry('1'), entry('2', { updatedAt: '2026-11-10T00:00:00Z' })];
  const remote = [
    { ...entry('1', { note: '', done: true, updatedAt: '2026-11-05T00:00:00Z' }) },   // sunucuda daha yeni
    { ...entry('2', { note: '', done: true, updatedAt: '2026-11-02T00:00:00Z' }) },   // yerel daha yeni
    { ...entry('3', { note: '' }) },                                                  // sadece sunucuda
    { ...entry('4', { note: '' }) },                                                  // silinmek üzere
  ];
  const m = merge(local, remote, ['4']);
  const by = Object.fromEntries(m.map((x) => [x.id, x]));
  assert.equal(by['1'].done, true);
  assert.equal(by['1'].note, 'gizli not');
  assert.equal(by['2'].done, false);
  assert.ok(by['3']);
  assert.ok(!by['4']);
});

test('satır ↔ kayıt dönüşümü tarihleri korur', () => {
  const e = entry('9');
  const back = fromRow({ ...toRow(e, 'U1'), created_at: e.createdAt, updated_at: null });
  assert.equal(back.id, '9');
  assert.equal(back.lastDay, '2026-09-07');
  assert.deepEqual(back.input, e.input);
  assert.equal(back.note, '');
});

test('başka cihazda silinen kayıt bu cihazda da silinir, yeni yerel kayıt korunur', () => {
  const local = [entry('1'), entry('2'), entry('5')];
  const remote = [{ ...entry('2', { note: '' }) }];
  const m = merge(local, remote, [], ['1', '2']); // 1 ve 2 daha önce eşitlenmişti; 5 yeni
  assert.deepEqual(m.map((x) => x.id).sort(), ['2', '5']);
});
