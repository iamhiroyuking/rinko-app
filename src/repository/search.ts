import { supabase } from './supabase'
import type { Database } from './database.types'
import type { LogType } from './logs'

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
  /** 記録の種類。絞り込みに使う（#132） */
  type: LogType
  /** 疑問が解決した時刻。null は未解決、または疑問ではない（#136） */
  resolvedAt: string | null
  tagNames: string[]
  createdAt: string
  /** 添付画像の枚数。結果に印を出すために数だけ持つ（中身は要らない） */
  attachmentCount: number
}

type Row = LogRow & {
  units: { id: string; order: number; title: string } | null
  log_tags?: { tags: { name: string } | null }[] | null
  attachments?: { id: string }[] | null
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
      '*, units!inner (id, order, title, book_id), log_tags ( tags ( name ) ), attachments ( id )',
    )
    .eq('units.book_id', bookId)
    // ゴミ箱に入れた回のログを除く。行レベルセキュリティは削除済みの回も
    // 読めるようにしてある（ゴミ箱画面で復元するために必要）ので、
    // ここで絞らないと捨てた回の記録まで検索に出てしまう。
    // しかもその結果を押しても getUnit が弾くので「見つかりません」になる。
    .is('units.deleted_at', null)

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
        type: row.type,
        resolvedAt: row.resolved_at,
        tagNames: (row.log_tags ?? []).flatMap((link) =>
          link.tags ? [link.tags.name] : [],
        ),
        createdAt: row.created_at,
        attachmentCount: (row.attachments ?? []).length,
      },
    ]
  })
}

export type MatchedIn = 'title' | 'body' | 'tag'

export type SearchHit = SearchableLog & {
  /** どこに一致したか。結果の見せ方を変えるために持つ */
  matchedIn: MatchedIn[]
}

/** 絞り込みの条件。どれも省けば、その軸では絞らない */
export type SearchCriteria = {
  /** タイトル・本文・ハッシュタグへの部分一致 */
  query?: string
  /** 記録の種類。空なら種類で絞らない */
  types?: LogType[]
  /** 渡すと、しおりの付いたものだけに絞る */
  markedLogIds?: ReadonlySet<string> | null
  /** true なら未解決の疑問だけ。輪講で溜まるのはここ（#136） */
  unresolvedOnly?: boolean
}

/**
 * ログを絞り込む。
 *
 * タイトル・本文・ハッシュタグを対象に、大文字小文字を区別しない部分一致で探す。
 * 返信も対象に含まれる（返信も同じ logs の行なので、区別せず扱っている）。
 * 並び順は回の順、同じ回の中では古い順。
 *
 * **3つの軸をここで一緒に扱う。** 以前はしおりだけ画面側で後からかけていて、
 * 「キーワードが空でもしおりなら一覧になる」という判断が画面に散っていた。
 * 軸が3つになると組み合わせが増えるので、純粋関数に寄せてテストで押さえる。
 *
 * 条件が1つも無いときは何も返さない。全件を出しても探したことにならないため。
 */
export function filterLogs(
  logs: SearchableLog[],
  criteria: SearchCriteria,
): SearchHit[] {
  const needle = (criteria.query ?? '').trim().toLowerCase()
  const types = criteria.types ?? []
  const marked = criteria.markedLogIds ?? null

  const byKeyword = needle !== ''
  const byType = types.length > 0
  const byMark = marked !== null
  const byUnresolved = criteria.unresolvedOnly === true

  if (!byKeyword && !byType && !byMark && !byUnresolved) return []

  return logs
    .flatMap((log) => {
      if (byMark && !marked.has(log.logId)) return []
      if (byType && !types.includes(log.type)) return []
      // 未解決は疑問にしか無い概念。種別も一緒に見る
      if (byUnresolved && (log.type !== 'question' || log.resolvedAt !== null))
        return []

      // どこに当たったかは結果の見せ方に使う。キーワードが無いときは空のまま
      const matchedIn: MatchedIn[] = []
      if (byKeyword) {
        if (log.title?.toLowerCase().includes(needle)) matchedIn.push('title')
        if (log.body.toLowerCase().includes(needle)) matchedIn.push('body')
        if (log.tagNames.some((name) => name.toLowerCase().includes(needle)))
          matchedIn.push('tag')

        if (matchedIn.length === 0) return []
      }

      return [{ ...log, matchedIn }]
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
