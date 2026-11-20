// Sürelerim: kayıtlar yalnızca kullanıcının kendi tarayıcısında (localStorage) tutulur. Sunucuya hiçbir şey gitmez.
// Müvekkil bilgisi tutulmaz: sadece avukatın verdiği kısa kod ve kısa bir not.
import { calculate, parse, formatTR, weekday } from './engine.js';

export const KEY = 'muhlet-sure:v1';
export const CODE_MAX = 60;
export const NOTE_MAX = 140;

export function load(storage) {
  try {
    const raw = storage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function save(storage, items) {
  try {
    storage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false; // gizli mod ya da depolama kapalı
  }
}

export function makeEntry(input, result, shortCode, note, now = new Date()) {
  const code = (shortCode || '').trim();
  const n = (note || '').trim();
  if (!code) throw new Error('Kısa dosya kodu girin (ör. 2026/145 Kadıköy 3. İş).');
  if (code.length > CODE_MAX) throw new Error(`Kısa kod en fazla ${CODE_MAX} karakter olabilir.`);
  if (n.length > NOTE_MAX) throw new Error(`Not en fazla ${NOTE_MAX} karakter olabilir.`);
  return {
    id: `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    code,
    note: n,
    input,
    ruleName: result.rule.name,
    law: result.version.law,
    lastDay: result.lastDay,
    alternatives: result.alternatives.map((a) => a.lastDay),
    createdAt: now.toISOString(),
    done: false,
    doneAt: null,
  };
}

// Bugünün tarihi (kullanıcının yerel saatine göre) YYYY-MM-DD
export function todayISO(now = new Date()) {
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysLeft(lastDay, today) {
  return Math.round((parse(lastDay) - parse(today)) / 86400000);
}

export function status(entry, today) {
  if (entry.done) return { kind: 'done', label: 'İşlem yapıldı' };
  const d = daysLeft(entry.lastDay, today);
  if (d < 0) return { kind: 'late', label: `${-d} gün geçti` };
  if (d === 0) return { kind: 'today', label: 'Son gün bugün' };
  if (d <= 3) return { kind: 'soon', label: `${d} gün kaldı` };
  if (d <= 7) return { kind: 'week', label: `${d} gün kaldı` };
  return { kind: 'later', label: `${d} gün kaldı` };
}

export function sortItems(items) {
  return [...items].sort((a, b) => (a.done - b.done) || (a.lastDay < b.lastDay ? -1 : a.lastDay > b.lastDay ? 1 : 0));
}

export function dateText(iso) {
  const t = parse(iso);
  return `${formatTR(t)} ${weekday(t)}`;
}

// Kurallar ya da tatil verisi güncellendiyse kayıtlı süreyi yeniden hesaplar. Tarihi kendiliğinden DEĞİŞTİRMEZ, farkı bildirir.
export function recheck(entry) {
  if (entry.done) return null;
  try {
    const r = calculate(entry.input);
    return r.lastDay !== entry.lastDay ? r.lastDay : null;
  } catch {
    return null;
  }
}

// Yedek dosyası
export function exportJSON(items, now = new Date()) {
  return JSON.stringify({ app: 'muhlet-sure', version: 1, exportedAt: now.toISOString(), items }, null, 2);
}

export function importJSON(text, existing) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Dosya okunamadı: geçerli bir Mühlet Süre yedeği değil.'); }
  if (!data || data.app !== 'muhlet-sure' || !Array.isArray(data.items)) throw new Error('Bu dosya bir Mühlet Süre yedeği değil.');
  const valid = data.items.filter((x) => x && typeof x.id === 'string' && typeof x.code === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.lastDay) && x.input);
  const ids = new Set(existing.map((x) => x.id));
  const added = valid.filter((x) => !ids.has(x.id)).map((x) => ({ ...x, code: x.code.slice(0, CODE_MAX), note: (x.note || '').slice(0, NOTE_MAX) }));
  return { items: [...existing, ...added], added: added.length, skipped: data.items.length - added.length };
}

// Birden çok süreyi içeren takvim dosyası
export function buildICS(entries, now = new Date()) {
  const esc = (s) => String(s).replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Muhlet Sure//TR', 'CALSCALE:GREGORIAN'];
  for (const e of entries) {
    const d = e.lastDay.replace(/-/g, '');
    const t = parse(e.lastDay) + 86400000;
    const next = new Date(t).toISOString().slice(0, 10).replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@muhlet-sure`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${esc(`Süre sonu · ${e.code} · ${e.ruleName}`)}`,
      `DESCRIPTION:${esc(`${e.law}. Mühlet Süre ile hesaplandı; son kontrol avukattadır.`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`7 gün kaldı: ${e.code}`)}`, 'TRIGGER:-P7D', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`3 gün kaldı: ${e.code}`)}`, 'TRIGGER:-P3D', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`Son gün: ${e.code}`)}`, 'TRIGGER:-PT15H', 'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
