-- ---------------------------------------------------------------------------
-- 教材の作成者を書き換えられないようにする
--
-- books の更新ポリシーは using (can_edit(id)) だけで、WITH CHECK を
-- 書いていない。id は書き換えようとしても新しい行の判定で弾かれるが、
-- created_by は判定に使われていないため、編集者なら誰でも
-- 「この教材を作ったのは別の人」に付け替えられる。
--
-- 今のところ books.created_by はポリシーにもトリガーにも使われていない
-- ので実害は無い。しかし units では created_by が「削除できるのは
-- 作成者だけ」の根拠になっており、books でも同じように使いたくなった
-- 瞬間に権限の穴になる。値の意味が壊れる前に固定しておく。
--
-- ログ（#55）と回（#56）でも同じ形の穴を塞いでいる。更新ポリシーに
-- WITH CHECK を書かないと USING がそのまま新しい行の判定に使われる、
-- という同じ原因から出ている。
-- ---------------------------------------------------------------------------

create or replace function public.protect_book_creator ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception '教材の作成者は変更できません';
  end if;
  return new;
end;
$$;

create trigger before_book_update_creator
  before update on public.books
  for each row
  execute function public.protect_book_creator ();
