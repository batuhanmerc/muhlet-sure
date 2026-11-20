-- Mühlet Süre: zamanlayıcı anahtarını elle yazmaya gerek bırakmayan kurulum.
-- Veritabanı rastgele bir anahtar üretir; zamanlayıcı bu anahtarı gönderir, sunucu fonksiyonu
-- veritabanına sorarak doğrular. Anahtarı kimse görmez, yazmaz, kopyalamaz.
-- Bu dosyayı olduğu gibi SQL Editor'de çalıştırın (değiştirilecek bir şey yok).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.cron_key (
  id  int primary key default 1 check (id = 1),
  key text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
insert into private.cron_key (id) values (1) on conflict (id) do nothing;

-- Sunucu fonksiyonu anahtarı bu fonksiyonla doğrular (yalnızca yönetici rolü çağırabilir)
create or replace function public.check_cron_key(k text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.cron_key where key = k);
$$;
revoke all on function public.check_cron_key(text) from public, anon, authenticated;
grant execute on function public.check_cron_key(text) to service_role;

-- Her sabah 08.00 (Türkiye) = 05.00 UTC
select cron.unschedule('muhlet-hatirlatma') where exists (select 1 from cron.job where jobname = 'muhlet-hatirlatma');
select cron.schedule('muhlet-hatirlatma', '0 5 * * *', $job$
  select net.http_post(
    url     := 'https://ibdsnrxacctnhctznzbe.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        'sb_publishable_z0PG6XvE86gbUKJMWBb_Dg_NXpqXx2Q',
      'x-cron-secret', (select key from private.cron_key where id = 1)
    ),
    body    := '{}'::jsonb
  );
$job$);
