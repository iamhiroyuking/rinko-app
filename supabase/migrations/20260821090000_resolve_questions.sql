-- 疑問に「解決したかどうか」を持たせる（#136）。
--
-- 輪講の価値がいちばん溜まるのは「その場で答えが出なかった疑問」なのに、
-- 今はそれが他の記録に埋もれ、溜まったことすら見えなかった。
--
-- null は「解決していない」ではなく「関係がない」。種別が question で
-- ないものにも列は付くが、そちらでは使わない。
-- 数えるときは type = 'question' and resolved_at is null で絞る。
alter table public.logs
  add column resolved_at timestamptz;

comment on column public.logs.resolved_at is
  '疑問が解決した時刻。question 以外では使わない。null は未解決または対象外';

-- 未解決の疑問を数える問い合わせのため。
-- 部分索引にしているのは、解決済みと question 以外を索引に載せても
-- 引かないため。記録の大半は question ではない。
create index logs_unresolved_questions_idx
  on public.logs (unit_id)
  where type = 'question' and resolved_at is null;

-- 権限のための新しいポリシーは要らない。
--
-- logs の更新は既に投稿者だけに制限され、WITH CHECK も入っている
-- （20260814150000_tighten_log_update.sql）。resolved_at はその内側に入る。
-- 疑問はその人のものなので、解決したかを決めるのも本人だけでよい。
