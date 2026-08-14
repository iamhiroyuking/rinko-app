-- ---------------------------------------------------------------------------
-- ゴミ箱に入れた教材でも、自分の画像を消せるようにする
--
-- 完全削除はゴミ箱から行う。しかしゴミ箱に入れた時点で自分の参加情報の
-- deleted_at が立っているため、deleted_at is null を条件にしていた
-- ストレージのポリシーが通らなくなる。
--
-- その結果、教材を完全に削除しても画像だけがストレージに残り、
-- しかも参加情報の行が消えたあとは誰の権限も及ばなくなって、
-- 本人にも消せないファイルが容量を食い続ける。実際に検証で発生した。
--
-- books の閲覧で同じ形の問題に当たったとき（20260812072639）と同じく、
-- 「今も参加していること」ではなく「参加情報が存在すること」まで緩める。
--
-- 緩めるのは読み取りと削除だけ。追加は「今も編集できること」のままにする。
-- ゴミ箱に入れた教材に新しく画像を置ける必要はない。
-- ---------------------------------------------------------------------------

-- ゴミ箱に入れていても、参加情報があれば読める
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
  );
$$;

-- 削除は編集者だけ。ただしゴミ箱に入れた状態でも通す。
-- 閲覧者しか残っていない教材を完全削除すると画像が残るが、
-- 閲覧者に他人の画像を消させるよりは良いと判断している。
create or replace function public.can_delete_storage_path (object_path text)
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
  );
$$;

drop policy "editors can delete log images" on storage.objects;

create policy "editors can delete log images, including trashed"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'log-images'
    and public.can_delete_storage_path (name)
  );
