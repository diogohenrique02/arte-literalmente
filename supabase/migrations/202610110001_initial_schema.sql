-- Arte Literalmente: esquema inicial. Execute no SQL Editor do Supabase.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  author text not null check (length(trim(author)) > 0),
  description text,
  cover_path text,
  file_path text,
  format text not null check (format in ('epub','pdf','txt')),
  genre text,
  tags text[] not null default '{}',
  publication_year integer check (publication_year is null or publication_year between 0 and 2100),
  language text,
  publisher text,
  source_url text not null check (source_url ~ '^https?://'),
  rights_status text not null check (rights_status in ('public_domain_verified','open_license','permission_documented','pending_review')),
  published boolean not null default false,
  allow_download boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_books_have_rights check (not published or rights_status <> 'pending_review'),
  constraint published_books_have_file check (not published or file_path is not null)
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table if not exists public.reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  format text not null check (format in ('epub','pdf','txt')),
  position double precision not null default 0 check (position >= 0),
  cfi text,
  page integer check (page is null or page > 0),
  font_size integer not null default 18 check (font_size between 12 and 32),
  theme text not null default 'light' check (theme in ('light','dark')),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create index if not exists books_published_created_idx on public.books (published, created_at desc);
create index if not exists books_genre_idx on public.books (genre) where published = true;
create index if not exists books_format_idx on public.books (format) where published = true;
create index if not exists books_title_idx on public.books using gin (to_tsvector('simple', title || ' ' || author));
create index if not exists reading_progress_user_updated_idx on public.reading_progress (user_id, updated_at desc);

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.favorites enable row level security;
alter table public.reading_progress enable row level security;

create policy "profiles read own or admin" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
-- Perfis comuns não podem atualizar role; dados de perfil podem ser alterados por função RPC dedicada futuramente.
create policy "admin manages profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "published books public read" on public.books for select to anon, authenticated using (published = true or public.is_admin());
create policy "admins insert books" on public.books for insert to authenticated with check (public.is_admin());
create policy "admins update books" on public.books for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete books" on public.books for delete to authenticated using (public.is_admin());

create policy "users read own favorites" on public.favorites for select to authenticated using (user_id = auth.uid());
create policy "users add own favorites" on public.favorites for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.books b where b.id = book_id and b.published = true));
create policy "users remove own favorites" on public.favorites for delete to authenticated using (user_id = auth.uid());

create policy "users read own progress" on public.reading_progress for select to authenticated using (user_id = auth.uid());
create policy "users insert own progress" on public.reading_progress for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.books b where b.id = book_id and b.published = true));
create policy "users update own progress" on public.reading_progress for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.books b where b.id = book_id and b.published = true));
create policy "users delete own progress" on public.reading_progress for delete to authenticated using (user_id = auth.uid());

-- Storage: capas públicas; arquivos de leitura privados e acessíveis apenas para livros publicados.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-files', 'book-files', false, 52428800, array['application/epub+zip','application/pdf','text/plain','application/octet-stream'])
on conflict (id) do update set public = false;

create policy "public reads covers" on storage.objects for select to anon, authenticated
using (bucket_id = 'book-covers');
create policy "admins upload covers" on storage.objects for insert to authenticated
with check (bucket_id = 'book-covers' and public.is_admin());
create policy "admins update covers" on storage.objects for update to authenticated
using (bucket_id = 'book-covers' and public.is_admin()) with check (bucket_id = 'book-covers' and public.is_admin());
create policy "admins delete covers" on storage.objects for delete to authenticated
using (bucket_id = 'book-covers' and public.is_admin());
create policy "admins upload book files" on storage.objects for insert to authenticated
with check (bucket_id = 'book-files' and public.is_admin());
create policy "admins update book files" on storage.objects for update to authenticated
using (bucket_id = 'book-files' and public.is_admin()) with check (bucket_id = 'book-files' and public.is_admin());
create policy "admins delete book files" on storage.objects for delete to authenticated
using (bucket_id = 'book-files' and public.is_admin());


-- Permite que visitantes gerem URLs assinadas somente para arquivos vinculados a livros publicados.
create policy "read published book files" on storage.objects for select to anon, authenticated
using (
  bucket_id = 'book-files'
  and (
    public.is_admin()
    or exists (select 1 from public.books b where b.file_path = storage.objects.name and b.published = true)
  )
);
