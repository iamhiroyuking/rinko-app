-- ---------------------------------------------------------------------------
-- 教材を作り、そのidを返す
--
-- なぜ関数にするのか。
--
-- アプリは作った教材のidを知る必要があるため、通常なら
-- `insert into books (...) returning id` を使いたい。しかしこれは失敗する。
--
-- 教材の閲覧は「参加していること」を条件にしていて、作成者を参加者にするのは
-- handle_new_book という AFTER INSERT トリガーである。PostgreSQL では
-- AFTER 行トリガーは文の終わりに実行されるのに対し、RETURNING の値は
-- 行を処理する時点で作られる。つまり RETURNING が評価される瞬間には
-- まだ参加情報が無く、閲覧のポリシーに弾かれる。
--
-- security definer 関数にすると関数の中では行レベルセキュリティが働かないため、
-- この順序の問題を避けられる。ログインしているかどうかは自分で確かめる。
-- ---------------------------------------------------------------------------

create or replace function public.create_book (
  book_title           text,
  book_cover_image_url text default null,
  book_goal            text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_book_id uuid;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  if coalesce(btrim(book_title), '') = '' then
    raise exception '書名を入力してください';
  end if;

  insert into public.books (title, cover_image_url, goal, created_by)
  values (
    btrim(book_title),
    nullif(btrim(coalesce(book_cover_image_url, '')), ''),
    nullif(btrim(coalesce(book_goal, '')), ''),
    auth.uid()
  )
  returning id into new_book_id;

  return new_book_id;
end;
$$;
