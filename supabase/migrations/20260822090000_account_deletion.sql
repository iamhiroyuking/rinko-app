-- アカウントを自分で削除できるようにする（#145）。
--
-- App Storeのガイドライン 5.1.1(v) が、アカウントを作れるアプリに
-- アプリ内からの削除手段を義務付けている。今は logs.author_id が
-- profiles を参照しているため消せなかった。
--
-- ■ 考え方
--
-- 記録は共有されている。**書いた人が抜けても、他の参加者にとっては
-- 残ってほしい。** 一方で「自分の情報を消したい」も満たす必要がある。
-- この2つは両立する。消すべきは**個人を指す情報**であって、
-- 書かれた中身ではない。
--
-- そこで profiles の参照を3通りに分ける。
--
--   1. 付け替える … 中身が残るべきもの（logs, units, books, invite_links）
--   2. 消す       … その人だけのもの（memberships, log_marks）
--   3. 空にする   … 役割の割り当て（units.presenter_id）

-- ■ 番人の行を入れる
--
-- profiles.id は auth.users を参照しているため、対応するアカウントが
-- 無い行はそのままでは入らない。**順番が要る。**
--
--   1. 外部キーを外す
--   2. 番人の行を入れる
--   3. 外部キーを not valid で付け直す
--
-- not valid は「既にある行を検査し直さない」という意味で、
-- **これから入る行はこれまで通り検査される。** 番人だけが例外になる。
alter table public.profiles
  drop constraint if exists profiles_id_fkey;

-- id を固定値にしているのは、アプリ側から「この人は退会者」と
-- 判定できるようにするため。auth.users には対応する行が無いので、
-- このアカウントでログインすることはできない。
insert into public.profiles (id, display_name)
values ('00000000-0000-0000-0000-000000000000', '退会したユーザー')
on conflict (id) do nothing;

alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade
  not valid;

comment on table public.profiles is
  'id が 00000000-... の行は退会した人を表す番人。auth.users には対応が無い';

/*
  自分のアカウントを消す。

  security definer で動かすのは、他人の記録の author_id を
  付け替える必要があるため。**引数を取らない**ようにしてあるのが要点で、
  常に auth.uid() の分だけを消す。idを渡せる形にすると、
  他人のアカウントを消せる関数になってしまう。
*/
create or replace function public.delete_my_account ()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me      uuid := auth.uid();
  retired uuid := '00000000-0000-0000-0000-000000000000';
begin
  if me is null then
    raise exception 'ログインが必要です';
  end if;

  if me = retired then
    raise exception 'この操作はできません';
  end if;

  -- 1. 中身が残るべきものは、退会者へ付け替える
  update public.logs         set author_id  = retired where author_id  = me;
  update public.units        set created_by = retired where created_by = me;
  update public.books        set created_by = retired where created_by = me;
  update public.invite_links set created_by = retired where created_by = me;

  -- 2. 役割の割り当ては空に戻す。担当が退会者のまま残ると、
  --    次の担当を決めるまで「退会したユーザーが担当」と出てしまう
  update public.units set presenter_id = null where presenter_id = me;

  -- 3. その人だけのものは消す。
  --    memberships と log_marks は profiles を on delete cascade で
  --    参照しているので、下の delete で自動的に消える

  delete from public.profiles where id = me;
  delete from auth.users where id = me;
end;
$$;

comment on function public.delete_my_account is
  '自分のアカウントを削除する。記録は残り、投稿者は退会したユーザーになる';

revoke all on function public.delete_my_account () from public;
grant execute on function public.delete_my_account () to authenticated;
