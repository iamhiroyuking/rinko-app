-- ---------------------------------------------------------------------------
-- 招待リンクを二度開いても壊れないようにする
--
-- これまでは「参加情報があるか調べる → 無ければ入れる」の2段だった。
-- 調べてから入れるまでの間に同じ人がもう一度参加すると、どちらも
-- 「まだ参加していない」と判断して二重に挿入し、片方が
-- duplicate key value violates unique constraint で落ちる。
--
-- 実際に起きた。開発時は React の StrictMode が副作用を2回実行するため
-- 参加処理が同時に2回走る。画面側の cancelled フラグは結果の扱いを
-- 止めるだけで、送った問い合わせは止まらない。
-- 本番でもリンクを二度押しすれば同じ形になる。
--
-- 調べてから入れるのをやめ、一度の挿入で済ませる。既に行があれば
-- ゴミ箱から戻すだけにする（元の分岐と同じ意味）。
--
-- 権限（role）は上書きしない。編集者として参加している人が閲覧の
-- リンクを開いても降格しない。そもそも protect_membership_fields が
-- role の変更を拒否するので、上書きしようとすると失敗する。
-- ---------------------------------------------------------------------------

create or replace function public.join_book_with_token (invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  link public.invite_links;
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です';
  end if;

  select * into link
    from public.invite_links
   where token = invite_token;

  if not found then
    raise exception '招待リンクが見つかりません';
  end if;

  insert into public.memberships (book_id, user_id, role, display_order)
  values (
    link.book_id,
    auth.uid(),
    link.role,
    coalesce(
      (select max(display_order) + 1
         from public.memberships
        where user_id = auth.uid()),
      0
    )
  )
  on conflict (book_id, user_id) do update
    set deleted_at = null;

  return link.book_id;
end;
$$;
