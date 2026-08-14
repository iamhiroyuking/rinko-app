-- ---------------------------------------------------------------------------
-- ログの更新時に、置き先の回まで見る
--
-- これまでのポリシーは using (author_id = auth.uid()) だけだった。
-- WITH CHECK を書かないと USING がそのまま新しい行の判定にも使われるので、
-- 投稿者を他人に付け替えることはできない。そこは守られている。
--
-- 守られていないのは unit_id。判定が author_id しか見ていないため、
-- 自分のログを「参加していない教材の回」に移せてしまう。回のidを
-- 知っていれば、他人の輪講に発言を差し込めることになる。
--
-- ログを編集できるようにするのに合わせて塞ぐ。編集後の行についても
-- 「その回の教材を編集できること」を求める。
-- ---------------------------------------------------------------------------

drop policy "authors can update their own logs" on public.logs;

create policy "authors can update their own logs"
  on public.logs for update
  to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and public.can_edit (public.book_id_of_unit (unit_id))
  );
