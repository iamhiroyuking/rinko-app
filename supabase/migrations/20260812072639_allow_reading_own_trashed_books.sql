-- ---------------------------------------------------------------------------
-- ゴミ箱に入れた教材でも、自分なら書名を読めるようにする
--
-- これまでの books の閲覧ポリシーは is_member() を使っていた。この関数は
-- 「deleted_at が null の参加情報があるか」を見るため、自分の教材を
-- ゴミ箱に入れた（自分の参加情報の deleted_at を立てた）瞬間、
-- is_member() が false になり、その教材の書名すら読めなくなる。
--
-- これではTrashViewに何も表示できない。ゴミ箱に「何を消したか」が
-- 見えないと、復元するかどうか判断のしようがない。
--
-- is_member() 自体は変えない。回・ログ・タグなど中身への閲覧権限は
-- 「今も参加していること」を条件のままにしたい。書名という表紙の情報だけ、
-- 「参加情報が（ゴミ箱に入っていても）存在すること」まで緩める。
-- ---------------------------------------------------------------------------

create or replace function public.has_any_membership (target_book_id uuid)
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
  );
$$;

drop policy "members can read their books" on public.books;

create policy "members can read their books, including trashed"
  on public.books for select
  to authenticated
  using (public.has_any_membership (id));
