-- Mühlet Süre: her sabah 08.00'de (Türkiye saati) hatırlatma fonksiyonunu çalıştıran zamanlayıcı.
-- ÖNCE: Supabase → Database → Extensions bölümünden "pg_cron" ve "pg_net" eklentilerini açın.
-- SONRA: aşağıdaki 3 yeri kendi değerlerinizle değiştirip SQL Editor'de çalıştırın:
--   PROJE-KODU   Supabase proje adresinizdeki kod (https://PROJE-KODU.supabase.co)
--   ANON-ANAHTAR Project Settings → API Keys → publishable anahtarı (sb_publishable_...)
--   CRON-SIFRESI send-reminders için Secrets'a yazdığınız CRON_SECRET ile AYNI metin

select cron.unschedule('muhlet-hatirlatma') where exists (select 1 from cron.job where jobname = 'muhlet-hatirlatma');

select cron.schedule(
  'muhlet-hatirlatma',
  '0 5 * * *',   -- 05.00 UTC = 08.00 Türkiye
  $$
  select net.http_post(
    url     := 'https://PROJE-KODU.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        'ANON-ANAHTAR',
      'x-cron-secret', 'CRON-SIFRESI'
    ),
    body    := '{}'::jsonb
  );
  $$
);
