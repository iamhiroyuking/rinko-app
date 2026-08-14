-- ---------------------------------------------------------------------------
-- ログに添付する画像の保存先
--
-- attachments テーブルは最初のスキーマから存在していたが、実体を置く場所が
-- 無かった。非公開バケットを作り、テーブルと同じ「参加者は読める・編集者は
-- 書ける」をストレージ側にも敷く。
--
-- ストレージのアクセス制御はテーブルと別物で、行ではなく**パス**に対して
-- 書く。そのため保存先を <book_id>/<log_id>/<uuid>.<ext> の形にして、
-- パスの先頭から教材idを取り出して判定できるようにしている。
--
-- 公開バケットにすると、URLを知っている人は誰でも読めてしまう。
-- 研究内容が載るので非公開にし、読むときは期限付きURLを発行する
-- （docs/open-questions.md の Q3。ここで決着）。
-- ---------------------------------------------------------------------------

-- 上限と種類はバケット自体に持たせる。画面側の検査だけだと、APIを直接
-- 叩かれたときに素通りしてしまう
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'log-images',
  'log-images',
  false,
  5242880, -- 5MB。縮小したあとの画像は300KB程度なので十分な余裕がある
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- パスから権限を見る関数
--
-- is_member / can_edit は教材idを uuid で受け取るが、こちらは text のまま
-- 比べている。パスは利用者が作った文字列にもなりうるので、uuid に
-- 変換すると壊れた値でエラーになり、問い合わせ全体が落ちる。
-- 落とすのではなく「権限なし」に倒したい。
-- ---------------------------------------------------------------------------

create or replace function public.is_member_of_storage_path (object_path text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.memberships
     where book_id::text = (storage.foldername(object_path))[1]
       and user_id = auth.uid()
       and deleted_at is null
  );
$$;

create or replace function public.can_edit_storage_path (object_path text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.memberships
     where book_id::text = (storage.foldername(object_path))[1]
       and user_id = auth.uid()
       and role = 'editor'
       and deleted_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- ストレージのポリシー
-- ---------------------------------------------------------------------------

create policy "members can read log images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'log-images'
    and public.is_member_of_storage_path (name)
  );

create policy "editors can upload log images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'log-images'
    and public.can_edit_storage_path (name)
  );

create policy "editors can delete log images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'log-images'
    and public.can_edit_storage_path (name)
  );

-- ---------------------------------------------------------------------------
-- 列の名前を実態に合わせる
--
-- file_url という名前だが、入れるのは公開URLではなくバケット内のパス。
-- 非公開バケットなので、読むたびに期限付きURLを作り直す必要があり、
-- URLそのものを保存しておくことはできない。
-- 使う前に直しておく（この表はまだ1行も無い）。
-- ---------------------------------------------------------------------------

alter table public.attachments rename column file_url to storage_path;
