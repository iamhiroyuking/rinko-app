-- ---------------------------------------------------------------------------
-- プロフィールの閲覧範囲を、関わりのある人だけに絞る
--
-- これまでの設定は「ログイン済みなら誰でも全員のプロフィールを読める」だった。
-- 担当者名やログの投稿者名を表示するために必要だったのだが、範囲が広すぎる。
-- このままでは、利用者が誰でも全利用者の表示名を一覧できてしまう。
--
-- 必要なのは「自分と同じ教材に関わっている人の名前が読めること」だけなので、
-- そこまで絞る。
-- ---------------------------------------------------------------------------

-- 自分と関わりのある相手かどうか
--
-- 判定を2通り用意している理由。
--
-- 1. 同じ教材の参加者
--    相手側の deleted_at は見ていない。教材を自分の本棚から消した人でも、
--    その人が過去に書いたログは残る仕様なので、名前が読めなくなると
--    残ったログの投稿者が「不明」になってしまう。
--
-- 2. 自分が参加している教材にログを残した人
--    参加情報を完全に削除して抜けた人が該当する。1だけでは拾えないが、
--    ログは残っているので名前は必要になる。
create or replace function public.shares_book_with (target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1
        from public.memberships mine
        join public.memberships theirs on theirs.book_id = mine.book_id
       where mine.user_id = auth.uid()
         and mine.deleted_at is null
         and theirs.user_id = target_user_id
    )
    or exists (
      select 1
        from public.logs l
        join public.units u on u.id = l.unit_id
        join public.memberships mine on mine.book_id = u.book_id
       where l.author_id = target_user_id
         and mine.user_id = auth.uid()
         and mine.deleted_at is null
    );
$$;

drop policy "profiles are readable by authenticated users" on public.profiles;

create policy "profiles are readable by people you share a book with"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.shares_book_with (id));
