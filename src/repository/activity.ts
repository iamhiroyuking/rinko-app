import { supabase } from './supabase'

/**
 * 前回見てから何が増えたか（#134）。
 *
 * 共有しているのに「誰かが書いた」ことがどこにも出ないと、
 * 用事があるときしか開かなくなる。輪講は週1回なので、
 * 1回忘れると2週空く。
 *
 * 見た時刻は `memberships.last_seen_at` に入れる。**個人の状態**なので
 * 教材ではなく参加情報の側にある（本棚のステータスやしおりと同じ考え方）。
 */

/** 教材ごとの「前回見た時刻」 */
type SeenAt = Map<string, string>

async function myUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const userId = data.user?.id
  if (!userId) throw new Error('ログインが必要です')
  return userId
}

/** 自分が参加している教材の、前回見た時刻をまとめて取る */
async function listSeenAt(userId: string): Promise<SeenAt> {
  const { data, error } = await supabase
    .from('memberships')
    .select('book_id, last_seen_at')
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (error) throw error
  return new Map((data ?? []).map((row) => [row.book_id, row.last_seen_at]))
}

/**
 * 教材ごとの新着の数を返す。
 *
 * **問い合わせは1回で済ませる。** 教材ごとに閾値が違うので素朴に書くと
 * 教材の数だけ問い合わせが飛ぶ。いちばん古い閾値以降のログをまとめて取り、
 * 教材ごとの比較は取得後に行う。
 *
 * **自分が書いたものは数えない。** 自分の書き込みで自分に印が付いても
 * 意味がない。
 *
 * ゴミ箱に入れた回のログも数えない（`units!inner` が要る。ここを
 * 忘れると教材をまたいで数える。#90 で踏んだのと同じ形）。
 */
export async function countNewLogs(): Promise<Map<string, number>> {
  const userId = await myUserId()
  const seenAt = await listSeenAt(userId)
  if (seenAt.size === 0) return new Map()

  const oldest = [...seenAt.values()].sort()[0]

  const { data, error } = await supabase
    .from('logs')
    .select('created_at, units!inner (book_id, deleted_at)')
    .gt('created_at', oldest)
    .neq('author_id', userId)
    .is('units.deleted_at', null)

  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const bookId = row.units?.book_id
    if (!bookId) continue

    const since = seenAt.get(bookId)
    // 参加していない教材のログは行レベルセキュリティが弾くので普通は来ない
    if (!since || row.created_at <= since) continue

    counts.set(bookId, (counts.get(bookId) ?? 0) + 1)
  }
  return counts
}

/**
 * その教材の中で、回ごとに増えた記録の数を返す。
 *
 * **時刻を更新する前に呼ぶこと。** 先に見たことにしてしまうと、
 * 何が新しかったのかを出せないまま印が消える。
 */
export async function countNewLogsByUnit(
  bookId: string,
): Promise<Map<string, number>> {
  const userId = await myUserId()
  const since = await getSeenAt(bookId)
  if (!since) return new Map()

  const { data, error } = await supabase
    .from('logs')
    .select('unit_id, units!inner (book_id, deleted_at)')
    .eq('units.book_id', bookId)
    .is('units.deleted_at', null)
    .gt('created_at', since)
    .neq('author_id', userId)

  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    counts.set(row.unit_id, (counts.get(row.unit_id) ?? 0) + 1)
  }
  return counts
}

/** その教材を前回見た時刻。回ごとの印を出すのに使う */
export async function getSeenAt(bookId: string): Promise<string | null> {
  const userId = await myUserId()
  const { data, error } = await supabase
    .from('memberships')
    .select('last_seen_at')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  return data?.last_seen_at ?? null
}

/**
 * 見たことにする。
 *
 * **回の一覧を開いたときだけ呼ぶ。** 概要の画面を開いただけで消すと、
 * 記録を見ていないのに新着が黙って消える。
 */
export async function touchSeenAt(bookId: string): Promise<void> {
  const userId = await myUserId()
  const { error } = await supabase
    .from('memberships')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('book_id', bookId)

  if (error) throw error
}
