-- ---------------------------------------------------------------------------
-- 招待を経ずに教材へ割り込めた穴を閉じる
--
-- これまでの参加情報の作成ポリシーは、user_id が自分であることだけを見ていた。
--
--   with check (user_id = auth.uid())
--
-- つまり book_id を自由に指定できたため、教材のUUIDを知っている人は誰でも
-- 参加情報を直接作り、editor として教材の中身を全て読み書きできた。
-- 教材のUUIDはURL（/books/<uuid>）に出るので、画面を見せただけで漏れる。
-- 実際に招待していない利用者から侵入できることを確認済み。
--
-- 参加情報を作る経路は次の2つだけであり、どちらも security definer 関数なので
-- 行レベルセキュリティを通らない。したがって作成ポリシーは不要である。
--
--   handle_new_book()        教材を作った人を参加者にする
--   join_book_with_token()   招待リンクで参加する
-- ---------------------------------------------------------------------------

drop policy "users can join a book themselves" on public.memberships;

-- ---------------------------------------------------------------------------
-- 参加情報の更新で、変えてよい列を制限する
--
-- 更新ポリシーは user_id が自分であることだけを見ており、どの列が変わったかは
-- 区別できない。そのため自分の role を editor に書き換えられてしまう。
-- 今は全員 editor なので実害が無いが、閲覧のみの権限を入れた時点で
-- 「閲覧のみの人が自分で編集権限に昇格できる」穴になる。
--
-- 本棚の見え方（shelf_status / display_order / last_seen_at / deleted_at）は
-- 本人が自由に変えてよい。役割と結び付け先は変えられてはならない。
-- ---------------------------------------------------------------------------

create or replace function public.protect_membership_fields ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    raise exception '権限は変更できません';
  end if;

  if new.book_id is distinct from old.book_id
     or new.user_id is distinct from old.user_id
  then
    raise exception '参加情報の結び付け先は変更できません';
  end if;

  return new;
end;
$$;

create trigger before_membership_update
  before update on public.memberships
  for each row
  execute function public.protect_membership_fields ();

-- ---------------------------------------------------------------------------
-- ログとハッシュタグの結び付けを、同じ教材のものに限る
--
-- これまでは log_id 側の編集権限だけを見ており、tag_id が同じ教材のものか
-- 確かめていなかった。別の教材のタグを自分のログに結び付けられてしまう。
--
-- タグ名の閲覧には参加が必要なので中身が漏れるわけではないが、
-- どの教材にも属さない繋がりが残るのは避けたい。
-- ---------------------------------------------------------------------------

create or replace function public.book_id_of_tag (target_tag_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select book_id from public.tags where id = target_tag_id;
$$;

drop policy "editors can attach tags to logs" on public.log_tags;

create policy "editors can attach tags from the same book"
  on public.log_tags for insert
  to authenticated
  with check (
    public.can_edit (public.book_id_of_log (log_id))
    and public.book_id_of_log (log_id) = public.book_id_of_tag (tag_id)
  );
