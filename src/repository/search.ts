import { supabase } from './supabase'
import type { Database } from './database.types'

type LogRow = Database['public']['Tables']['logs']['Row']

/** 検索の対象になる、回の情報を添えたログ */
export type SearchableLog = {
  logId: string
  unitId: string
  unitOrder: number
  unitTitle: string
  authorId: string
  title: string | null
  body: string
  tagNames: string[]
  createdAt: string
}

type Row = LogRow & {
  units: { id: string; order: number; title: string } | null
  log_tags?: { tags: { name: string } | null }[] | null
}

/**
 * その教材のログを、回の情報とタグ付きで全件取り出す。
 *
 * 絞り込みをデータベース側で行わず全件取ってきてから探す形にしている。
 * 理由は3つ。
 *
 * 1. 日本語はPostgreSQLの全文検索だと単語に区切れないため、結局は部分一致になる
 * 2. タイトル・本文・タグの3か所を対象にすると問い合わせが分かれて複雑になる
 * 3. 1つの教材に付くログは多くても数百件で、その程度なら差を体感できない
 *
 * 件数が増えて重くなったら、データベース側の関数に寄せる。
 * その際は行レベルセキュリティを迂回しないよう注意が必要（今の形は
 * 通常の問い合わせなので、参加していない教材のログは自動的に返らない）。
 */
export async function listSearchableLogs(
  bookId: string,
): Promise<SearchableLog[]> {
  const { data, error } = await supabase
    .from('logs')
    .select(
      '*, units!inner (id, order, title, book_id), log_tags ( tags ( name ) )',
    )
    .eq('units.book_id', bookId)

  if (error) throw error

  return ((data ?? []) as Row[]).flatMap((row) => {
    if (!row.units) return []
    return [
      {
        logId: row.id,
        unitId: row.units.id,
        unitOrder: row.units.order,
        unitTitle: row.units.title,
        authorId: row.author_id,
        title: row.title,
        body: row.body,
        tagNames: (row.log_tags ?? []).flatMap((link) =>
          link.tags ? [link.tags.name] : [],
        ),
        createdAt: row.created_at,
      },
    ]
  })
}

export type MatchedIn = 'title' | 'body' | 'tag'

export type SearchHit = SearchableLog & {
  /** どこに一致したか。結果の見せ方を変えるために持つ */
  matchedIn: MatchedIn[]
}

/**
 * ログを絞り込む。
 *
 * タイトル・本文・ハッシュタグを対象に、大文字小文字を区別しない部分一致で探す。
 * 返信も対象に含まれる（返信も同じ logs の行なので、区別せず扱っている）。
 * 並び順は回の順、同じ回の中では古い順。
 */
export function filterLogs(logs: SearchableLog[], query: string): SearchHit[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return []

  return logs
    .flatMap((log) => {
      const matchedIn: MatchedIn[] = []
      if (log.title?.toLowerCase().includes(needle)) matchedIn.push('title')
      if (log.body.toLowerCase().includes(needle)) matchedIn.push('body')
      if (log.tagNames.some((name) => name.toLowerCase().includes(needle)))
        matchedIn.push('tag')

      return matchedIn.length > 0 ? [{ ...log, matchedIn }] : []
    })
    .sort(
      (a, b) =>
        a.unitOrder - b.unitOrder || a.createdAt.localeCompare(b.createdAt),
    )
}

/**
 * よく使われているハッシュタグを多い順に返す。
 * 検索の取っかかりとして画面上部に並べる。
 */
export function topTagNames(logs: SearchableLog[], limit = 10): string[] {
  const counts = new Map<string, number>()
  for (const log of logs) {
    for (const name of log.tagNames) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name)
}
