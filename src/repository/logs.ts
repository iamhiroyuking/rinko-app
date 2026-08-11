import { supabase } from './supabase'
import type { Database } from './database.types'
import { attachTagsToLog, ensureTags } from './tags'

type LogRow = Database['public']['Tables']['logs']['Row']

export type LogType = LogRow['type']

export const LOG_TYPE_LABEL: Record<LogType, string> = {
  none: 'なし',
  preview: '予習メモ',
  question: '疑問',
  review: '復習',
}

/** 選択肢として出す順番。値は後から足せる */
export const LOG_TYPES: LogType[] = ['none', 'preview', 'question', 'review']

export type LogEntry = {
  id: string
  authorId: string
  parentLogId: string | null
  type: LogType
  title: string | null
  body: string
  pageStart: number | null
  pageEnd: number | null
  createdAt: string
  tagNames: string[]
}

/**
 * 取得したログの行に、タグを結合した分が付いた形。
 * 結合結果は無いこともあるので、受け取る側では常に無い場合を考える。
 */
type LogRowWithTags = LogRow & {
  log_tags?: { tags: { name: string } | null }[] | null
}

function toLogEntry(row: LogRowWithTags): LogEntry {
  return {
    id: row.id,
    authorId: row.author_id,
    parentLogId: row.parent_log_id,
    type: row.type,
    title: row.title,
    body: row.body,
    pageStart: row.page_start,
    pageEnd: row.page_end,
    createdAt: row.created_at,
    tagNames: (row.log_tags ?? []).flatMap((link) =>
      link.tags ? [link.tags.name] : [],
    ),
  }
}

/**
 * ページ数を表示用の文字列にする。
 * 片方しか入っていない場合や、どちらも無い場合も扱える。
 */
export function formatPageRange(
  pageStart: number | null,
  pageEnd: number | null,
): string | null {
  if (pageStart === null && pageEnd === null) return null
  if (pageStart !== null && pageEnd !== null) {
    if (pageStart === pageEnd) return `p.${pageStart}`
    return `p.${pageStart}-${pageEnd}`
  }
  return `p.${pageStart ?? pageEnd}`
}

/**
 * その回のログを新しい順に返す。
 * 返信のスレッド表示は別のIssueで扱うため、ここでは全件を平らに返す。
 */
export async function listLogs(unitId: string): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('*, log_tags ( tags ( name ) )')
    .eq('unit_id', unitId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(toLogEntry)
}

export type NewLog = {
  unitId: string
  type: LogType
  title?: string | null
  body: string
  pageStart?: number | null
  pageEnd?: number | null
  tagNames?: string[]
}

/**
 * ログを投稿し、そのidを返す。
 *
 * タグは教材ごとに管理しているので教材のidが必要になるが、呼び出し側から
 * 受け取らず、回のidから引いている。別々に受け取ると「教材Aの回」と
 * 「教材B」という噛み合わない組み合わせを渡せてしまい、ログは教材Aに付くのに
 * タグだけ教材Bに作られる、という壊れ方をするため。
 *
 * タグの登録と結びつけはログの作成後に行うため、厳密にはひとつの操作にまとまって
 * いない。途中で失敗するとタグの付いていないログが残る。今の規模では実害が小さいので
 * このままにしているが、気になるようなら関数にまとめて一度の処理にできる。
 */
export async function createLog(input: NewLog): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const userId = userData.user?.id
  if (!userId) throw new Error('ログインが必要です')

  const { data, error } = await supabase
    .from('logs')
    .insert({
      unit_id: input.unitId,
      author_id: userId,
      type: input.type,
      title: input.title ?? null,
      body: input.body,
      page_start: input.pageStart ?? null,
      page_end: input.pageEnd ?? null,
    })
    .select('id')
    .single()

  if (error) throw error

  const names = input.tagNames ?? []
  if (names.length > 0) {
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('book_id')
      .eq('id', input.unitId)
      .single()

    if (unitError) throw unitError

    const tagIds = await ensureTags(unit.book_id, names)
    await attachTagsToLog(data.id, tagIds)
  }

  return data.id
}
