import { supabase } from './supabase'
import type { Database } from './database.types'
import { attachTagsToLog, ensureTags } from './tags'
import { removeLogImages, type Attachment } from './attachments'

type LogRow = Database['public']['Tables']['logs']['Row']

export type LogType = LogRow['type']

/*
  `none` は選択欄でしか出ない。記録のカードは `type !== 'none'` のときだけ
  この札を出すので、「指定しない」が本文の横に並ぶことはない。
*/
export const LOG_TYPE_LABEL: Record<LogType, string> = {
  none: '指定しない',
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
  /** 添付画像。表示に使う期限付きURLは signAttachments で後から付ける */
  attachments: Attachment[]
}

/**
 * 取得したログの行に、タグと添付を結合した分が付いた形。
 * 結合結果は無いこともあるので、受け取る側では常に無い場合を考える。
 */
type LogRowWithTags = LogRow & {
  log_tags?: { tags: { name: string } | null }[] | null
  attachments?:
    | {
        id: string
        storage_path: string
        file_name: string
        mime_type: string | null
      }[]
    | null
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
    attachments: (row.attachments ?? []).map((file) => ({
      id: file.id,
      storagePath: file.storage_path,
      fileName: file.file_name,
      mimeType: file.mime_type,
    })),
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

/** 記録一覧の並べ方 */
export type LogOrder = 'posted' | 'page'

export const LOG_ORDER_LABEL: Record<LogOrder, string> = {
  posted: '投稿順',
  page: 'ページ順',
}

/**
 * スレッドをページ順に並べ替える。
 *
 * **束のまま動かす。** 返信は本文だけで投稿できる（#61）ためページを
 * 持たない。平らに並べ替えると親と返信が離れて会話が切れる。
 * この画面の会話は返信で行われるので、順序は親のページだけで決める。
 *
 * ページが未記入のスレッドは最後にまとめる。ページを入れていない記録が
 * 先頭に来ると、読み返しの手がかりにならないため。
 *
 * 同じページの中は投稿の古い順。読み返すときは書かれた順に読みたい。
 *
 * データ取得を伴わない純粋な関数にしてある。
 */
export function sortThreadsByPage(threads: LogThread[]): LogThread[] {
  const withPage: LogThread[] = []
  const withoutPage: LogThread[] = []

  for (const thread of threads) {
    if (thread.root.pageStart === null && thread.root.pageEnd === null) {
      withoutPage.push(thread)
    } else {
      withPage.push(thread)
    }
  }

  withPage.sort((a, b) => {
    // 片方しか入っていないこともあるので、始点が無ければ終点で見る
    const pageOf = (t: LogThread) => t.root.pageStart ?? t.root.pageEnd ?? 0
    return (
      pageOf(a) - pageOf(b) || a.root.createdAt.localeCompare(b.root.createdAt)
    )
  })

  withoutPage.sort((a, b) => a.root.createdAt.localeCompare(b.root.createdAt))

  return [...withPage, ...withoutPage]
}

/**
 * その回のログを新しい順に返す。返信も含めて平らに返す。
 * スレッドの形に組み直すのは buildThreads の役目。
 */
export async function listLogs(unitId: string): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from('logs')
    .select(
      '*, log_tags ( tags ( name ) ), attachments ( id, storage_path, file_name, mime_type )',
    )
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

export type LogEdit = {
  type: LogType
  title: string | null
  body: string
  pageStart: number | null
  pageEnd: number | null
  tagNames: string[]
}

/**
 * 自分のログを書き換える。
 *
 * 他人のログは行レベルセキュリティが弾くので、ここで投稿者を確かめる
 * 必要はない。押せないよう画面側でボタンを隠す。
 *
 * 添付画像には触れない。付け外しは別の操作にしている。
 */
export async function updateLog(logId: string, input: LogEdit): Promise<void> {
  const { data, error } = await supabase
    .from('logs')
    .update({
      type: input.type,
      title: input.title,
      body: input.body,
      page_start: input.pageStart,
      page_end: input.pageEnd,
    })
    .eq('id', logId)
    .select('unit_id')
    .single()

  if (error) throw error

  await replaceLogTags(logId, data.unit_id, input.tagNames)
}

/**
 * ページ範囲だけを書き換える。
 *
 * updateLog はタグを付け直すので、ページを入れるだけの用途には重い。
 * 後からまとめてページを埋めるとき（読み返せるようにする作業）に使う。
 *
 * 他人のログは行レベルセキュリティが弾く。押せないよう画面側で隠す。
 */
export async function updateLogPages(
  logId: string,
  pageStart: number | null,
  pageEnd: number | null,
): Promise<void> {
  const { error } = await supabase
    .from('logs')
    .update({ page_start: pageStart, page_end: pageEnd })
    .eq('id', logId)

  if (error) throw error
}

/**
 * ログに付いているタグを、渡された名前の集合に合わせる。
 *
 * 差分を出さず、いったん全部外してから付け直している。1件のログに
 * 付くタグは数個で、差分を計算する手間に見合わないため。
 */
async function replaceLogTags(
  logId: string,
  unitId: string,
  names: string[],
): Promise<void> {
  const { error: detachError } = await supabase
    .from('log_tags')
    .delete()
    .eq('log_id', logId)

  if (detachError) throw detachError
  if (names.length === 0) return

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('book_id')
    .eq('id', unitId)
    .single()

  if (unitError) throw unitError

  const tagIds = await ensureTags(unit.book_id, names)
  await attachTagsToLog(logId, tagIds)
}

/**
 * 自分のログを完全に削除する。返信も連鎖して消える。
 *
 * 添付画像はストレージにあり連鎖しないので、行を消す前に消す。
 * 順番が逆だと、辿れないファイルが残る（#53で実際に踏んだ）。
 */
export async function deleteLog(logId: string): Promise<void> {
  await removeLogImages(logId)

  const { error } = await supabase.from('logs').delete().eq('id', logId)
  if (error) throw error
}

/** 1件のログを取り出す。編集画面が今の値を出すために使う */
export async function getLog(logId: string): Promise<LogEntry | null> {
  const { data, error } = await supabase
    .from('logs')
    .select(
      '*, log_tags ( tags ( name ) ), attachments ( id, storage_path, file_name, mime_type )',
    )
    .eq('id', logId)
    .maybeSingle()

  if (error) throw error
  return data ? toLogEntry(data) : null
}
