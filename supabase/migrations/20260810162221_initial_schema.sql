-- ---------------------------------------------------------------------------
-- 輪講アプリの初期スキーマ
--
-- docs/requirements.md のデータモデルに対応する。
-- 利用者(User)は Supabase Auth の auth.users をそのまま使い、
-- 表示名などのアプリ固有の情報だけ profiles テーブルに持たせる。
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- テーブル
-- ---------------------------------------------------------------------------

-- 利用者のプロフィール。auth.users と1対1で対応する
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null,
  created_at   timestamptz not null default now()
);

-- 教材。ホーム画面の本棚に並ぶオブジェクト
-- 共有相手にも影響する情報だけを持たせる
create table public.books (
  id              uuid primary key default gen_random_uuid(),
  title           text        not null,
  cover_image_url text,
  goal            text,
  created_by      uuid        not null references public.profiles (id),
  created_at      timestamptz not null default now()
);

-- 参加。誰がどの教材に、どの権限で参加しているか
--
-- 本棚まわりの状態は「その人の本棚がどう見えるか」の話なので、教材ではなくここに持つ。
-- 教材側に置くと、誰かが「学習済み」にした瞬間に共有相手全員のホームから消えてしまう。
-- 削除フラグと並び順も同じ理由でここにある。
create table public.memberships (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid        not null references public.books (id) on delete cascade,
  user_id       uuid        not null references public.profiles (id) on delete cascade,
  role          text        not null default 'editor'
                  check (role in ('editor', 'viewer')),
  shelf_status  text        not null default 'reading'
                  check (shelf_status in ('planned', 'reading', 'finished')),
  display_order integer     not null default 0,
  deleted_at    timestamptz,
  joined_at     timestamptz not null default now(),
  unique (book_id, user_id)
);

-- 招待リンク。発行時に付与する権限を選ぶ
create table public.invite_links (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid        not null references public.books (id) on delete cascade,
  token      text        not null unique,
  role       text        not null default 'editor'
               check (role in ('editor', 'viewer')),
  created_by uuid        not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- 回
create table public.units (
  id             uuid primary key default gen_random_uuid(),
  book_id        uuid        not null references public.books (id) on delete cascade,
  "order"        integer     not null,
  title          text        not null,
  objective      text,
  presenter_id   uuid        references public.profiles (id),
  scheduled_date date,
  status         text        not null default 'not_started'
                   check (status in ('not_started', 'in_progress', 'done')),
  deleted_at     timestamptz,
  created_at     timestamptz not null default now()
);

-- ログ（発言・記録）。parent_log_id が入っていれば返信
create table public.logs (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid        not null references public.units (id) on delete cascade,
  author_id     uuid        not null references public.profiles (id),
  parent_log_id uuid        references public.logs (id) on delete cascade,
  type          text        not null default 'none'
                  check (type in ('none', 'preview', 'question', 'review')),
  title         text,
  body          text        not null,
  page_start    integer,
  page_end      integer,
  is_marked     boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ハッシュタグ。サジェストは教材ごとに出すので book_id を持つ
create table public.tags (
  id      uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  name    text not null,
  unique (book_id, name)
);

-- ログとハッシュタグの対応
create table public.log_tags (
  log_id uuid not null references public.logs (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (log_id, tag_id)
);

-- 添付ファイル
create table public.attachments (
  id         uuid primary key default gen_random_uuid(),
  log_id     uuid        not null references public.logs (id) on delete cascade,
  file_url   text        not null,
  file_name  text        not null,
  mime_type  text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- インデックス
--   外部キーで絞り込む問い合わせが中心なので、その列に張る
-- ---------------------------------------------------------------------------

create index memberships_user_id_idx  on public.memberships (user_id);
create index memberships_book_id_idx  on public.memberships (book_id);
create index invite_links_book_id_idx on public.invite_links (book_id);
create index units_book_id_idx        on public.units (book_id);
create index logs_unit_id_idx         on public.logs (unit_id);
create index logs_parent_log_id_idx   on public.logs (parent_log_id);
create index tags_book_id_idx         on public.tags (book_id);
create index log_tags_tag_id_idx      on public.log_tags (tag_id);
create index attachments_log_id_idx   on public.attachments (log_id);

-- ---------------------------------------------------------------------------
-- 権限チェック用の関数
--
-- Row Level Security の条件から memberships を直接参照すると、
-- memberships 自身のポリシーが再帰的に評価されて無限ループになる。
-- security definer にした関数を経由することでこれを避ける。
-- ---------------------------------------------------------------------------

-- ログイン中の利用者がその教材に参加しているか
create or replace function public.is_member (target_book_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.memberships
     where book_id = target_book_id
       and user_id = auth.uid()
       and deleted_at is null
  );
$$;

-- ログイン中の利用者がその教材を編集できるか
create or replace function public.can_edit (target_book_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.memberships
     where book_id = target_book_id
       and user_id = auth.uid()
       and role = 'editor'
       and deleted_at is null
  );
$$;

-- その回が属する教材のid
create or replace function public.book_id_of_unit (target_unit_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select book_id from public.units where id = target_unit_id;
$$;

-- そのログが属する教材のid
create or replace function public.book_id_of_log (target_log_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select u.book_id
    from public.logs l
    join public.units u on u.id = l.unit_id
   where l.id = target_log_id;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- 全テーブルで有効にする。有効にしたうえでポリシーを書かないと
-- 誰も読み書きできない状態になるため、必要な分だけ許可を足していく。
-- これにより「未ログインでは中身が一切見えない」が成立する。
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.books        enable row level security;
alter table public.memberships  enable row level security;
alter table public.invite_links enable row level security;
alter table public.units        enable row level security;
alter table public.logs         enable row level security;
alter table public.tags         enable row level security;
alter table public.log_tags     enable row level security;
alter table public.attachments  enable row level security;

-- profiles: 自分のものは読み書きできる。他人のものは読むだけ
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

-- books: 参加している教材のみ
create policy "members can read their books"
  on public.books for select
  to authenticated
  using (public.is_member (id));

create policy "authenticated users can create books"
  on public.books for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "editors can update their books"
  on public.books for update
  to authenticated
  using (public.can_edit (id));

-- memberships: 自分の参加情報と、同じ教材の他の参加者
create policy "members can read memberships of their books"
  on public.memberships for select
  to authenticated
  using (user_id = auth.uid() or public.is_member (book_id));

create policy "users can join a book themselves"
  on public.memberships for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can update their own membership"
  on public.memberships for update
  to authenticated
  using (user_id = auth.uid());

create policy "users can delete their own membership"
  on public.memberships for delete
  to authenticated
  using (user_id = auth.uid());

-- invite_links: 参加者は読める。発行は編集者のみ
create policy "members can read invite links"
  on public.invite_links for select
  to authenticated
  using (public.is_member (book_id));

create policy "editors can create invite links"
  on public.invite_links for insert
  to authenticated
  with check (public.can_edit (book_id) and created_by = auth.uid());

create policy "editors can delete invite links"
  on public.invite_links for delete
  to authenticated
  using (public.can_edit (book_id));

-- units: 参加者は読める。作成・更新・削除は編集者のみ
create policy "members can read units"
  on public.units for select
  to authenticated
  using (public.is_member (book_id));

create policy "editors can create units"
  on public.units for insert
  to authenticated
  with check (public.can_edit (book_id));

create policy "editors can update units"
  on public.units for update
  to authenticated
  using (public.can_edit (book_id));

create policy "editors can delete units"
  on public.units for delete
  to authenticated
  using (public.can_edit (book_id));

-- logs: 参加者は読める。投稿は編集者、編集と削除は本人のみ
create policy "members can read logs"
  on public.logs for select
  to authenticated
  using (public.is_member (public.book_id_of_unit (unit_id)));

create policy "editors can post logs"
  on public.logs for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.can_edit (public.book_id_of_unit (unit_id))
  );

create policy "authors can update their own logs"
  on public.logs for update
  to authenticated
  using (author_id = auth.uid());

create policy "authors can delete their own logs"
  on public.logs for delete
  to authenticated
  using (author_id = auth.uid());

-- tags
create policy "members can read tags"
  on public.tags for select
  to authenticated
  using (public.is_member (book_id));

create policy "editors can create tags"
  on public.tags for insert
  to authenticated
  with check (public.can_edit (book_id));

-- log_tags
create policy "members can read log tags"
  on public.log_tags for select
  to authenticated
  using (public.is_member (public.book_id_of_log (log_id)));

create policy "editors can attach tags to logs"
  on public.log_tags for insert
  to authenticated
  with check (public.can_edit (public.book_id_of_log (log_id)));

create policy "editors can detach tags from logs"
  on public.log_tags for delete
  to authenticated
  using (public.can_edit (public.book_id_of_log (log_id)));

-- attachments
create policy "members can read attachments"
  on public.attachments for select
  to authenticated
  using (public.is_member (public.book_id_of_log (log_id)));

create policy "editors can add attachments"
  on public.attachments for insert
  to authenticated
  with check (public.can_edit (public.book_id_of_log (log_id)));

create policy "editors can delete attachments"
  on public.attachments for delete
  to authenticated
  using (public.can_edit (public.book_id_of_log (log_id)));

-- ---------------------------------------------------------------------------
-- サインアップ時に profiles を自動で作る
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- display_name は not null なので、必ず値が入るよう段階的に候補を用意する
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'ユーザー'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user ();
