-- Vogelhaus-Tracker: Datenbank-Setup für Supabase
--
-- Anleitung:
-- 1. Supabase-Projekt anlegen auf https://supabase.com
-- 2. Im Dashboard unter "SQL Editor" -> "New query" dieses komplette Skript einfügen und ausführen.
-- 3. Projekt-URL und "anon public" Key aus "Project Settings" -> "API" in die .env.local eintragen.
--
-- Hinweis zur Sicherheit: Die Policies unten erlauben offenen Zugriff ohne Login
-- (lesen/schreiben/löschen für jeden mit dem anon key), passend für eine kleine
-- private oder Team-Nutzung. Für einen größeren/öffentlichen Einsatz sollte
-- zusätzlich Supabase Auth eingerichtet und die Policies entsprechend verschärft werden.

create extension if not exists pgcrypto;

create table if not exists public.birdhouses (
  id           uuid primary key default gen_random_uuid(),
  name         text,
  lat          double precision not null,
  lng          double precision not null,
  status       text not null default 'leer' check (status in ('leer', 'voll')),
  has_defect   boolean not null default false,
  defect_note  text,
  note         text,
  photo_url    text,
  checked_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.birdhouses enable row level security;

drop policy if exists "Öffentlich lesen" on public.birdhouses;
create policy "Öffentlich lesen" on public.birdhouses
  for select using (true);

drop policy if exists "Öffentlich einfügen" on public.birdhouses;
create policy "Öffentlich einfügen" on public.birdhouses
  for insert with check (true);

drop policy if exists "Öffentlich aktualisieren" on public.birdhouses;
create policy "Öffentlich aktualisieren" on public.birdhouses
  for update using (true);

drop policy if exists "Öffentlich löschen" on public.birdhouses;
create policy "Öffentlich löschen" on public.birdhouses
  for delete using (true);

-- updated_at automatisch pflegen
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_birdhouses_updated_at on public.birdhouses;
create trigger trg_birdhouses_updated_at
  before update on public.birdhouses
  for each row execute function public.set_updated_at();

-- Realtime-Updates aktivieren (damit alle Geräte Änderungen live sehen)
alter publication supabase_realtime add table public.birdhouses;

-- Storage-Bucket für Fotos (öffentlich lesbar, damit Bilder direkt angezeigt werden können)
insert into storage.buckets (id, name, public)
values ('vogelhaus-fotos', 'vogelhaus-fotos', true)
on conflict (id) do nothing;

drop policy if exists "Vogelhaus-Fotos öffentlich lesbar" on storage.objects;
create policy "Vogelhaus-Fotos öffentlich lesbar"
  on storage.objects for select
  using (bucket_id = 'vogelhaus-fotos');

drop policy if exists "Vogelhaus-Fotos öffentlich hochladen" on storage.objects;
create policy "Vogelhaus-Fotos öffentlich hochladen"
  on storage.objects for insert
  with check (bucket_id = 'vogelhaus-fotos');

drop policy if exists "Vogelhaus-Fotos öffentlich löschen" on storage.objects;
create policy "Vogelhaus-Fotos öffentlich löschen"
  on storage.objects for delete
  using (bucket_id = 'vogelhaus-fotos');
