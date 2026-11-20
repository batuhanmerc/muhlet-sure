// @ts-nocheck  (sade JavaScript; tip denetimi gerekmiyor)
// Mühlet Süre — günlük hatırlatma e-postaları (Supabase Edge Function).
// Her sabah zamanlayıcı (pg_cron) tarafından çağrılır. Son günü 7 gün, 3 gün içinde olan
// ve bugün biten açık süreler için kullanıcıya TEK bir özet e-posta gönderir.
//
// Gerekli gizli değerler (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY  Resend e-posta servisinin anahtarı
//   MAIL_FROM       Gönderen, ör. "Mühlet Süre <hatirlatma@muhletsure.com>"
//   CRON_SECRET     Zamanlayıcının gönderdiği gizli parola (rastgele uzun bir metin)
//   SITE_URL        Sitenin adresi, ör. https://batuhanmerc.github.io/muhlet-sure/
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından kendiliğinden sağlanır.

const TZ = 'Europe/Istanbul';
const WINDOW = 7;

// ---------- Saf mantık (testlerde Node ile de çalışır) ----------

export function istanbulToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function daysBetween(fromISO, toISO) {
  const a = Date.parse(fromISO + 'T00:00:00Z'), b = Date.parse(toISO + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

// Kalan güne göre hangi hatırlatmanın sırası: 0 = son gün, 3 = 1–3 gün kala, 7 = 4–7 gün kala.
// Zamanlayıcı bir gün çalışmazsa ertesi gün kaçan hatırlatma yine gönderilir.
export function dueOffset(daysLeft) {
  if (daysLeft < 0 || daysLeft > WINDOW) return null;
  if (daysLeft === 0) return 0;
  if (daysLeft <= 3) return 3;
  return 7;
}

// rows: [{ id, user_id, code, rule_name, law, last_day, sent: [7,3,...] }]
// profiles: Map(user_id → { email, reminders_on })
// Dönen değer: kullanıcı başına bir grup [{ user_id, email, items: [{ id, offset, daysLeft, ... }] }]
export function planReminders(rows, profiles, today) {
  const groups = new Map();
  for (const r of rows) {
    const p = profiles.get(r.user_id);
    if (!p || !p.reminders_on || !p.email) continue;
    const left = daysBetween(today, r.last_day);
    const offset = dueOffset(left);
    if (offset === null) continue;
    const sent = new Set(r.sent || []);
    // Daha yakın bir hatırlatma zaten gittiyse (ör. 3 gün), daha uzağı (7 gün) artık gönderme
    if ([...sent].some((s) => s <= offset)) continue;
    if (!groups.has(r.user_id)) groups.set(r.user_id, { user_id: r.user_id, email: p.email, items: [] });
    groups.get(r.user_id).items.push({ id: r.id, offset, daysLeft: left, code: r.code, rule_name: r.rule_name, law: r.law, last_day: r.last_day });
  }
  for (const g of groups.values()) g.items.sort((a, b) => a.daysLeft - b.daysLeft || a.code.localeCompare(b.code, 'tr'));
  return [...groups.values()];
}

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
export function trDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${d} ${AYLAR[m - 1]} ${y} ${GUNLER[wd]}`;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const leftText = (n) => (n === 0 ? 'SON GÜN BUGÜN' : `${n} gün kaldı`);

export function buildEmail(group, siteUrl) {
  const today = group.items.filter((i) => i.daysLeft === 0).length;
  const subject = today
    ? `Bugün son gün: ${today} süre — Mühlet Süre`
    : `Yaklaşan ${group.items.length} süre — Mühlet Süre`;
  const rows = group.items.map((i) => `
    <tr>
      <td style="padding:12px 14px;border-bottom:1px solid #dde3ec">
        <div style="font-weight:700;color:#13213a">${esc(i.code)}</div>
        <div style="color:#46536b;font-size:14px">${esc(i.rule_name)} · ${esc(i.law)}</div>
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid #dde3ec;text-align:right;white-space:nowrap">
        <div style="font-weight:700;color:${i.daysLeft === 0 ? '#8f1d14' : '#13213a'}">${esc(trDate(i.last_day))}</div>
        <div style="font-size:13px;color:${i.daysLeft <= 3 ? '#8f1d14' : '#5b6b82'}">${leftText(i.daysLeft)}</div>
      </td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html lang="tr"><body style="margin:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="font-weight:700;font-size:18px;color:#1f3a5f;margin-bottom:16px">Mühlet Süre</div>
    <div style="background:#fff;border:1px solid #dde3ec;border-radius:12px;overflow:hidden">
      <div style="padding:16px 14px;background:#13213a;color:#fff;font-size:16px">${today ? 'Bugün son günü olan süreleriniz var.' : 'Yaklaşan süreleriniz:'}</div>
      <table style="width:100%;border-collapse:collapse;font-size:15px">${rows}</table>
    </div>
    <p style="font-size:14px;color:#46536b;margin:18px 0"><a href="${esc(siteUrl)}#surelerim" style="color:#1f3a5f;font-weight:700">Sürelerimi aç</a> · İşlemi yaptıysanız siteden "İşlem yapıldı" olarak işaretleyin, hatırlatmalar durur.</p>
    <p style="font-size:12px;color:#8a97ab;margin:0">Bu hatırlatma yardımcı bir araçtır; süre kontrolü ve sorumluluk avukattadır. Hatırlatmaları sitedeki Hesap bölümünden kapatabilirsiniz.</p>
  </div></body></html>`;
  const text = [
    today ? 'Bugün son günü olan süreleriniz var.' : 'Yaklaşan süreleriniz:',
    '',
    ...group.items.map((i) => `- ${i.code} | ${i.rule_name} (${i.law}) | Son gün: ${trDate(i.last_day)} | ${leftText(i.daysLeft)}`),
    '',
    `Sürelerim: ${siteUrl}#surelerim`,
    'Hatırlatmaları sitedeki Hesap bölümünden kapatabilirsiniz.',
  ].join('\n');
  return { subject, html, text };
}

// ---------- Sunucu (yalnızca Supabase/Deno ortamında çalışır) ----------

async function handler(req) {
  const env = (k) => Deno.env.get(k) ?? '';
  if (!env('CRON_SECRET') || req.headers.get('x-cron-secret') !== env('CRON_SECRET')) {
    return new Response('Yetkisiz', { status: 401 });
  }
  const base = env('SUPABASE_URL') + '/rest/v1';
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const today = istanbulToday();
  const until = addDaysISO(today, WINDOW);
  const dryRun = new URL(req.url).searchParams.get('dry') === '1';

  const dl = await fetch(`${base}/deadlines?select=id,user_id,code,rule_name,law,last_day,reminders_sent(offset_days)&done=eq.false&last_day=gte.${today}&last_day=lte.${until}`, { headers: h });
  if (!dl.ok) return new Response(`Süreler okunamadı: ${await dl.text()}`, { status: 500 });
  const rows = (await dl.json()).map((r) => ({ ...r, sent: (r.reminders_sent || []).map((s) => s.offset_days) }));
  if (!rows.length) return Response.json({ today, sent: 0 });

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const pr = await fetch(`${base}/profiles?select=user_id,email,reminders_on&user_id=in.(${ids.join(',')})`, { headers: h });
  if (!pr.ok) return new Response(`Profiller okunamadı: ${await pr.text()}`, { status: 500 });
  const profiles = new Map((await pr.json()).map((p) => [p.user_id, p]));

  const groups = planReminders(rows, profiles, today);
  if (dryRun) return Response.json({ today, groups: groups.map((g) => ({ user_id: g.user_id, items: g.items.length })) });

  let sent = 0;
  const errors = [];
  for (const g of groups) {
    const mail = buildEmail(g, env('SITE_URL'));
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env('MAIL_FROM'), to: [g.email], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!res.ok) { errors.push({ user_id: g.user_id, status: res.status }); continue; }
    // Gönderildi olarak işaretle (aynı hatırlatma tekrar gitmesin)
    await fetch(`${base}/reminders_sent`, {
      method: 'POST',
      headers: { ...h, Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify(g.items.map((i) => ({ deadline_id: i.id, offset_days: i.offset }))),
    });
    sent++;
  }
  return Response.json({ today, sent, errors });
}

if (typeof Deno !== 'undefined') Deno.serve(handler);
