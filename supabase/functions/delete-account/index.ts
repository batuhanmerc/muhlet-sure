// Mühlet Süre — kullanıcının hesabını ve tüm kayıtlarını kalıcı olarak siler (KVKK m.7: silme hakkı).
// Site, giriş yapmış kullanıcının oturum anahtarıyla çağırır. Kayıtlar veritabanında
// "on delete cascade" ile kullanıcıyla birlikte silinir.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function handler(req) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Yalnızca POST', { status: 405, headers: CORS });
  const url = Deno.env.get('SUPABASE_URL');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return new Response('Giriş gerekli', { status: 401, headers: CORS });

  // Oturum anahtarı kime ait?
  const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: service, Authorization: `Bearer ${token}` } });
  if (!who.ok) return new Response('Oturum geçersiz', { status: 401, headers: CORS });
  const user = await who.json();
  if (!user?.id) return new Response('Oturum geçersiz', { status: 401, headers: CORS });

  const del = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
    method: 'DELETE', headers: { apikey: service, Authorization: `Bearer ${service}` },
  });
  if (!del.ok) return new Response('Silinemedi', { status: 500, headers: CORS });
  return new Response(JSON.stringify({ deleted: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
}

if (typeof Deno !== 'undefined') Deno.serve(handler);
