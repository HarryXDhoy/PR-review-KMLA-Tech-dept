-- Educational public-photo MVP. Apply to a NEW, dedicated Supabase project.
-- Deliberately fails on existing tables/bucket instead of replacing their policies.
-- This migration is not executed by the app. Apply before creating app accounts.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,40}$'),
  constraint profiles_reserved_username check (username !~ '^user_[0-9a-f]{32}$' or username = 'user_' || replace(id::text, '-', '')),
  full_name text not null default '' check (char_length(full_name) <= 80),
  avatar_url text check (avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url ~ '^https?://')),
  bio text not null default '' check (char_length(bio) <= 150),
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null check (char_length(image_url) <= 2048 and image_url ~ '^https?://'),
  caption text not null default '' check (char_length(caption) <= 2200),
  location text not null default '' check (char_length(location) <= 100),
  created_at timestamptz not null default now()
);

create table public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index posts_feed_idx on public.posts (created_at desc, id desc);
create index posts_user_idx on public.posts (user_id, created_at desc);
create index likes_user_idx on public.likes (user_id, post_id);
create index comments_post_idx on public.comments (post_id, created_at desc);
create index comments_user_idx on public.comments (user_id);
create index follows_target_idx on public.follows (following_id, follower_id);
create index follows_recent_idx on public.follows (follower_id, created_at desc);
create index saves_user_idx on public.saves (user_id, created_at desc);

-- Only this auth trigger creates profiles. UUID-derived usernames avoid untrusted
-- metadata collisions. No metadata value controls ownership or authorization.
create function public.handle_new_photo_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    'user_' || replace(new.id::text, '-', ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80)
  );
  return new;
end;
$$;
revoke all on function public.handle_new_photo_user() from public, anon, authenticated;
create trigger on_auth_user_created_photo_profile
  after insert on auth.users
  for each row execute function public.handle_new_photo_user();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.saves enable row level security;

-- Remove default Supabase grants on these NEW tables, then grant minimum rights.
-- Column grants prevent rewriting IDs, timestamps, ownership, and attachment URLs.
revoke all on public.profiles, public.posts, public.likes, public.comments,
  public.follows, public.saves from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.posts, public.likes, public.comments, public.follows to anon, authenticated;
grant select on public.saves to authenticated;
grant update (username, full_name, avatar_url, bio) on public.profiles to authenticated;
grant insert (user_id, image_url, caption, location) on public.posts to authenticated;
grant update (caption, location) on public.posts to authenticated;
grant delete on public.posts to authenticated;
grant insert (post_id, user_id) on public.likes, public.saves to authenticated;
grant delete on public.likes, public.saves to authenticated;
grant insert (post_id, user_id, body) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;
grant delete on public.comments to authenticated;
grant insert (follower_id, following_id) on public.follows to authenticated;
grant delete on public.follows to authenticated;

create policy profiles_public_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_owner_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy posts_public_read on public.posts for select to anon, authenticated using (true);
create policy posts_owner_insert on public.posts for insert to authenticated with check (user_id = (select auth.uid()));
create policy posts_owner_update on public.posts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy posts_owner_delete on public.posts for delete to authenticated using (user_id = (select auth.uid()));

create policy likes_public_read on public.likes for select to anon, authenticated using (true);
create policy likes_owner_insert on public.likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy likes_owner_delete on public.likes for delete to authenticated using (user_id = (select auth.uid()));

create policy comments_public_read on public.comments for select to anon, authenticated using (true);
create policy comments_owner_insert on public.comments for insert to authenticated with check (user_id = (select auth.uid()));
create policy comments_owner_update on public.comments for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy comments_owner_delete on public.comments for delete to authenticated using (user_id = (select auth.uid()));

create policy follows_public_read on public.follows for select to anon, authenticated using (true);
create policy follows_owner_insert on public.follows for insert to authenticated with check (follower_id = (select auth.uid()));
create policy follows_owner_delete on public.follows for delete to authenticated using (follower_id = (select auth.uid()));

create policy saves_owner_read on public.saves for select to authenticated using (user_id = (select auth.uid()));
create policy saves_owner_insert on public.saves for insert to authenticated with check (user_id = (select auth.uid()));
create policy saves_owner_delete on public.saves for delete to authenticated using (user_id = (select auth.uid()));

-- A public bucket means anyone with an image URL can fetch it, even when signed out.
-- No overwrite/update policy: uploads use fresh random object names.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

create policy photo_images_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'post-images');
create policy photo_images_owner_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
    and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$'
  );
create policy photo_images_owner_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and owner_id = (select auth.uid())::text
  );

commit;
