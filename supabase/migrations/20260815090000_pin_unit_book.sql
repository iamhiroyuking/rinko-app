-- ---------------------------------------------------------------------------
-- 回を別の教材へ移せないようにする
--
-- units の更新ポリシーは using (can_edit(book_id)) だけで、WITH CHECK を
-- 書いていない。その場合 USING がそのまま新しい行の判定にも使われるので、
-- 「自分が編集できる教材どうし」であれば book_id を書き換えられる。
--
-- これは「回を完全に削除できるのは作成者だけ」を迂回する経路になる。
-- 共有している教材の回を自分だけの教材へ移せば、他の参加者の画面からは
-- 消え、そこに付いたログも一緒に持ち出せてしまう。
--
-- RLSのポリシーからは変更前の行（OLD）を参照できないため、
-- 「値が変わっていないこと」はポリシーでは書けない。
-- protect_unit_deletion と同じくトリガーで拒否する。
-- ---------------------------------------------------------------------------

create or replace function public.protect_unit_book ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.book_id is distinct from old.book_id then
    raise exception '回を別の教材へ移すことはできません';
  end if;
  return new;
end;
$$;

create trigger before_unit_update_book
  before update on public.units
  for each row
  execute function public.protect_unit_book ();
