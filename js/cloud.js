// Supabase ile konuşan küçük, bağımlılıksız istemci: e-posta koduyla giriş, sürelerin buluta kaydı.
// Sunucuya giden: dosya kodu, işlem türü, kanun dayanağı, tarihler. GİTMEYEN: notlar (yalnızca cihazda kalır).

const SESSION_KEY = 'muhlet-sure:session';
const TOMBSTONE_KEY = 'muhlet-sure:silinecek';
const SYNCED_KEY = 'muhlet-sure:esitlenen'; // son eşitlemede sunucuda olan kayıtlar

export class CloudError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

// Supabase hata mesajlarını Türkçeye çevir
function trError(status, body) {
  const msg = (body && (body.msg || body.message || body.error_description || body.error)) || '';
  if (status === 429 || /rate limit|too many/i.test(msg)) return 'Çok sık denediniz. Bir dakika bekleyip tekrar deneyin.';
  if (/expired|invalid|otp/i.test(msg) && status >= 400 && status < 500) return 'Kod hatalı ya da süresi dolmuş. Yeni kod isteyin.';
  if (/email/i.test(msg) && /valid/i.test(msg)) return 'Geçerli bir e-posta adresi girin.';
  if (/sınır/i.test(msg)) return msg;
  if (status === 401 || status === 403) return 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.';
  return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
}

// ---------- Kayıt dönüşümleri (testlenebilir saf fonksiyonlar) ----------

export function toRow(entry, userId) {
  return {
    user_id: userId,
    local_id: entry.id,
    code: entry.code,
    rule_code: entry.input?.ruleCode || '',
    rule_name: entry.ruleName,
    law: entry.law,
    last_day: entry.lastDay,
    input: entry.input || {},
    alternatives: entry.alternatives || [],
    done: !!entry.done,
    done_at: entry.doneAt || null,
  };
}

export function fromRow(row) {
  return {
    id: row.local_id,
    code: row.code,
    note: '',
    input: row.input,
    ruleName: row.rule_name,
    law: row.law,
    lastDay: row.last_day,
    alternatives: row.alternatives || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    done: row.done,
    doneAt: row.done_at,
  };
}

const stamp = (x) => x.updatedAt || x.doneAt || x.createdAt || '';

// Yerel ve sunucudaki listeleri birleştirir. Aynı kayıt iki tarafta varsa en son değişen kazanır;
// not her zaman yerelden alınır (sunucuda not yoktur). Silinmek üzere işaretlenenler geri gelmez.
// syncedIds: önceki eşitlemede sunucuda olan kayıtlar. Bunlardan biri artık sunucuda yoksa
// başka bir cihazda silinmiştir; burada da silinir (yeniden yüklenip "dirilmez").
export function merge(local, remote, deletedIds = [], syncedIds = []) {
  const gone = new Set(deletedIds);
  const onServer = new Set(remote.map((r) => r.id));
  const wasSynced = new Set(syncedIds);
  const map = new Map(local.filter((x) => onServer.has(x.id) || !wasSynced.has(x.id)).map((x) => [x.id, x]));
  for (const r of remote) {
    if (gone.has(r.id)) continue;
    const l = map.get(r.id);
    if (!l) map.set(r.id, r);
    else if (stamp(r) > stamp(l)) map.set(r.id, { ...r, note: l.note });
  }
  return [...map.values()];
}

// ---------- İstemci ----------

export function createCloud({ url, anonKey, storage, fetchFn = globalThis.fetch.bind(globalThis), now = () => Date.now() }) {
  const base = url.replace(/\/+$/, '');
  const read = (k, d) => { try { return JSON.parse(storage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => { try { v == null ? storage.removeItem(k) : storage.setItem(k, JSON.stringify(v)); } catch { /* depolama kapalı */ } };

  let session = read(SESSION_KEY, null);

  async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
    let res;
    try {
      res = await fetchFn(base + path, {
        method,
        headers: { apikey: anonKey, Authorization: `Bearer ${token || anonKey}`, 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new CloudError('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.', 0);
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new CloudError(trError(res.status, data), res.status);
    return data;
  }

  function keep(data) {
    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at ? data.expires_at * 1000 : now() + (data.expires_in || 3600) * 1000,
      user: { id: data.user?.id, email: data.user?.email },
    };
    write(SESSION_KEY, session);
    return session;
  }

  async function token() {
    if (!session) throw new CloudError('Giriş yapmadınız.', 401);
    if (session.expires_at - now() < 60_000) {
      try {
        keep(await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } }));
      } catch (e) {
        if (e.status >= 400 && e.status < 500) { session = null; write(SESSION_KEY, null); }
        throw e;
      }
    }
    return session.access_token;
  }

  const rest = async (path, opts = {}) => call('/rest/v1' + path, { ...opts, token: await token() });

  return {
    get user() { return session?.user || null; },

    async sendCode(email) {
      await call('/auth/v1/otp', { method: 'POST', body: { email, create_user: true } });
    },

    async verifyCode(email, code) {
      return keep(await call('/auth/v1/verify', { method: 'POST', body: { type: 'email', email, token: code } })).user;
    },

    async signOut() {
      try { if (session) await call('/auth/v1/logout', { method: 'POST', token: session.access_token }); } catch { /* yine de çık */ }
      session = null;
      write(SESSION_KEY, null);
      write(SYNCED_KEY, null);
    },

    async profile() {
      const rows = await rest(`/profiles?select=email,reminders_on,consent_at&user_id=eq.${session.user.id}`);
      return rows?.[0] || null;
    },

    async updateProfile(fields) {
      await rest(`/profiles?user_id=eq.${session.user.id}`, { method: 'PATCH', body: fields, headers: { Prefer: 'return=minimal' } });
    },

    async pull() {
      const rows = await rest('/deadlines?select=*&order=last_day.asc');
      return rows.map(fromRow);
    },

    async push(items) {
      if (!items.length) return;
      await rest('/deadlines?on_conflict=user_id,local_id', {
        method: 'POST',
        body: items.map((x) => toRow(x, session.user.id)),
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      });
      write(SYNCED_KEY, [...new Set([...read(SYNCED_KEY, []), ...items.map((x) => x.id)])]);
    },

    // Silinen kayıtlar önce yerel listeye yazılır; sunucuya ulaşınca listeden düşer (çevrimdışı silme güvenli).
    markDeleted(id) { write(TOMBSTONE_KEY, [...new Set([...read(TOMBSTONE_KEY, []), id])]); },
    pendingDeletes() { return read(TOMBSTONE_KEY, []); },
    async flushDeletes() {
      const ids = read(TOMBSTONE_KEY, []);
      if (!ids.length) return;
      const list = ids.map((x) => `"${String(x).replace(/["\\]/g, '')}"`).join(',');
      await rest(`/deadlines?local_id=in.(${encodeURIComponent(list)})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      write(TOMBSTONE_KEY, []);
    },

    // Tam eşitleme: bekleyen silmeleri gönder, sunucudakini çek, birleştir, hepsini geri yükle.
    async sync(localItems) {
      await this.flushDeletes();
      const merged = merge(localItems, await this.pull(), this.pendingDeletes(), read(SYNCED_KEY, []));
      await this.push(merged);
      write(SYNCED_KEY, merged.map((x) => x.id));
      return merged;
    },

    async deleteAccount() {
      await call('/functions/v1/delete-account', { method: 'POST', token: await token(), body: {} });
      session = null;
      write(SESSION_KEY, null);
      write(TOMBSTONE_KEY, null);
      write(SYNCED_KEY, null);
    },
  };
}
