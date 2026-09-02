-- 教材の作成者を退会者へ付け替えられるようにする（#145の実装漏れ）
--
-- delete_my_account() が books.created_by を退会者センチネル
-- （00000000-0000-0000-0000-000000000000）へ付け替えようとすると、
-- protect_book_creator() トリガーに「教材の作成者は変更できません」で
-- 拒まれていた。実際にアカウント削除を検証して発覚した
-- （使い捨てアカウントで教材・回・記録を作ってから delete_my_account()
-- を呼び、400エラーで気づいた）。
--
-- books.created_by は表示以外の用途が無い（ポリシーにもトリガーにも
-- 使われていない、と元のマイグレーション 20260816100000 のコメントに
-- 明記されている）ので、退会者IDへの付け替えだけを例外にしても
-- 実害は無い。それ以外の書き換えは引き続き拒む。
create or replace function public.protect_book_creator ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  retired uuid := '00000000-0000-0000-0000-000000000000';
begin
  if new.created_by is distinct from old.created_by
     and new.created_by is distinct from retired
  then
    raise exception '教材の作成者は変更できません';
  end if;
  return new;
end;
$$;
