import { supabase } from './supabase'

/**
 * 個人のしおり。
 *
 * 「後からもう一度振り返りたい」という目印で、共有相手には見えない
 * （log_marks は user_id を持ち、行レベルセキュリティが自分の行だけを返す）。
 *
 * ただしポリシーは「見てよいもの」を決めるだけで「欲しいもの」は決めない。
 * どの関数でも user_id で絞ること。忘れると他人のしおりが自分のものとして
 * 出る。1人で試している間は絶対に出ないバグ
 * （listShelfBooks / getMyShelfEntry で2度踏んだ形）。
 */

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const userId = data.user?.id
  if (!userId) throw new Error('ログインが必要です')
  return userId
}

/** 渡したログのうち、自分がしおりを付けているもののidを返す */
export async function listMyMarks(logIds: string[]): Promise<Set<string>> {
  if (logIds.length === 0) return new Set()

  const userId = await currentUserId()

  const { data, error } = await supabase
    .from('log_marks')
    .select('log_id')
    .eq('user_id', userId)
    .in('log_id', logIds)

  if (error) throw error
  return new Set((data ?? []).map((row) => row.log_id))
}

/**
 * その教材で自分がしおりを付けているログのidを返す。
 *
 * 検索画面の絞り込みに使う。ログのidを先に集めてから渡すのではなく、
 * 回を経由して教材で絞っている。`logs!inner` が無いと logs 側の条件が
 * 効かず、他の教材のしおりまで返る。
 */
export async function listMyMarksInBook(bookId: string): Promise<Set<string>> {
  const userId = await currentUserId()

  const { data, error } = await supabase
    .from('log_marks')
    .select('log_id, logs!inner (units!inner (book_id))')
    .eq('user_id', userId)
    .eq('logs.units.book_id', bookId)

  if (error) throw error
  return new Set((data ?? []).map((row) => row.log_id))
}

export async function addMark(logId: string): Promise<void> {
  const userId = await currentUserId()

  const { error } = await supabase
    .from('log_marks')
    .insert({ log_id: logId, user_id: userId })

  if (error) throw error
}

export async function removeMark(logId: string): Promise<void> {
  const userId = await currentUserId()

  const { error } = await supabase
    .from('log_marks')
    .delete()
    .eq('log_id', logId)
    .eq('user_id', userId)

  if (error) throw error
}
