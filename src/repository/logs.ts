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

/** 親のログと、それに付いた返信をまとめたもの */
export type LogThread = {
  root: LogEntry
  replies: LogEntry[]
}

/**
 * 平らなログの配列をスレッドの形に組み直す。
 *
 * 並び順は docs/screen-flow.md の仕様どおり。
 * 親は新しい順（最新の話題が上）、返信はその中で古い順（会話の流れを追える）。
 *
 * 問い合わせを親と返信で分けず、1回で取ってからここで組み立てている。
 * 親ごとに返信を取りに行くと件数分だけ通信が増えるため。
 *
 * データの取得を伴わない純粋な関数にしてあるので、後からテストを書ける。
 */
export function buildThreads(logs: LogEntry[]): LogThread[] {
  const repliesByParent = new Map<string, LogEntry[]>()
  const roots: LogEntry[] = []

  const ids = new Set(logs.map((log) => log.id))

  for (const log of logs) {
    // 親が見当たらない返信は、行き場がなくなるので親として扱う。
    // 削除は連鎖するので通常は起こらないが、消えて見えなくなるより
    // 場所がずれても表示されるほうがましなため。
    if (log.parentLogId === null || !ids.has(log.parentLogId)) {
      roots.push(log)
      continue
    }
    const siblings = repliesByParent.get(log.parentLogId) ?? []
    siblings.push(log)
    repliesByParent.set(log.parentLogId, siblings)
  }

  roots.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return roots.map((root) => ({
    root,
    replies: (repliesByParent.get(root.id) ?? []).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    ),
  }))
}

/**
 * その回のログを新しい順に返す。返信も含めて平らに返す。
 * スレッドの形に組み直すのは buildThreads の役目。
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

/**
 * その教材に残されたログの総数を数える。返信も1件として数える。
 *
 * 本文は要らないので `head: true` で件数だけ受け取る。
 * `units!inner` は「回と結合できた行だけ」の意味で、これが無いと
 * units の条件が効かず教材をまたいで数えてしまう。
 * ゴミ箱に入れた回のログは、画面から消えている以上ここでも数えない。
 */
export async function countBookLogs(bookId: string): Promise<number> {
  const { count, error } = await supabase
    .from('logs')
    .select('id, units!inner (book_id, deleted_at)', {
      count: 'exact',
      head: true,
    })
    .eq('units.book_id', bookId)
    .is('units.deleted_at', null)

  if (error) throw error
  return count ?? 0
}

export type NewLog = {
  unitId: string
  type: LogType
  title?: string | null
  body: string
  pageStart?: number | null
  pageEnd?: number | null
  tagNames?: string[]
  /** 返信のときだけ、返信先のログのidを入れる */
  parentLogId?: string | null
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
      parent_log_id: input.parentLogId ?? null,
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
