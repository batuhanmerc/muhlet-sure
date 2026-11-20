-- Mühlet Süre: e-posta hatırlatma (beta) için veritabanı şeması.
-- Supabase panelinde: SQL Editor → New query → bu dosyanın tamamını yapıştır → Run.
--
-- Gizlilik ilkesi: sunucuda müvekkil bilgisi tutulmaz. Sadece avukatın verdiği kısa dosya kodu,
-- işlem türü ve tarihler saklanır. Notlar sunucuya hiç gönderilmez (yalnızca cihazda kalır).

-- 1) Kullanıcı profili: e-posta ve hatırlatma tercihi
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  reminders_on boolean not null default true,
  consent_at   timestamptz,                 -- gizlilik metni / koşulların kabul edildiği an
  created_at   timestamptz not null default now()
);

-- 2) Kaydedilen süreler
create table if not exists public.deadlines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_id    text not null,                -- tarayıcıdaki kaydın kimliği (cihazlar arası eşleştirme)
  code        text not null check (char_length(code) between 1 and 60),
  rule_code   text not null check (char_length(rule_code) <= 20),
  rule_name   text not null check (char_length(rule_name) <= 120),
  law         text not null check (char_length(law) <= 80),
  last_day    date not null,
  input       jsonb not null default '{}'::jsonb check (pg_column_size(input) < 2000),
  alternatives date[] not null default '{}',
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, local_id)
);
create index if not exists deadlines_due_idx on public.deadlines (last_day) where not done;

-- 3) Gönderilmiş hatırlatmalar (aynı hatırlatma iki kez gitmesin)
create table if not exists public.reminders_sent (
  deadline_id uuid not null references public.deadlines (id) on delete cascade,
  offset_days int  not null check (offset_days in (7, 3, 0)),
  sent_at     timestamptz not null default now(),
  primary key (deadline_id, offset_days)
);

-- updated_at'i kendiliğinden güncelle
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists deadlines_touch on public.deadlines;
create trigger deadlines_touch before update on public.deadlines
  for each row execute function public.touch_updated_at();

-- Yeni kullanıcı kaydolunca profilini oluştur
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email) values (new.id, new.email)
  on conflict (user_id) do update set email = excluded.email;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users
  for each row execute function public.handle_new_user();

-- Kişi başı kayıt sınırı (kötüye kullanıma karşı)
create or replace function public.limit_deadlines() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.deadlines where user_id = new.user_id) >= 2000 then
    raise exception 'Kayıt sınırına ulaşıldı (2000).';
  end if;
  return new;
end $$;
drop trigger if exists deadlines_limit on public.deadlines;
create trigger deadlines_limit before insert on public.deadlines
  for each row execute function public.limit_deadlines();

-- 4) Satır düzeyi güvenlik: herkes yalnızca kendi kayıtlarını görür ve değiştirir
alter table public.profiles       enable row level security;
alter table public.deadlines      enable row level security;
alter table public.reminders_sent enable row level security;   -- politika yok: sadece sunucu fonksiyonu erişir

drop policy if exists "profil okuma" on public.profiles;
create policy "profil okuma" on public.profiles for select using (auth.uid() = user_id);
drop policy if exists "profil güncelleme" on public.profiles;
create policy "profil güncelleme" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "süre okuma" on public.deadlines;
create policy "süre okuma" on public.deadlines for select using (auth.uid() = user_id);
drop policy if exists "süre ekleme" on public.deadlines;
create policy "süre ekleme" on public.deadlines for insert with check (auth.uid() = user_id);
drop policy if exists "süre güncelleme" on public.deadlines;
create policy "süre güncelleme" on public.deadlines for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "süre silme" on public.deadlines;
create policy "süre silme" on public.deadlines for delete using (auth.uid() = user_id);

-- Kullanıcı e-posta adresini profilden değiştiremesin (sadece hatırlatma tercihi ve onay)
revoke update on public.profiles from authenticated, anon;
grant update (reminders_on, consent_at) on public.profiles to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.deadlines to authenticated;
revoke all on public.deadlines, public.profiles, public.reminders_sent from anon;
