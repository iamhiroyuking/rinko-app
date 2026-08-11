import { supabase } from './supabase'

/**
 * 入力された文字列をハッシュタグの配列にする。
 *
 * 空白・カンマ・読点で区切り、先頭の `#` は取り除く。
 * 同じ名前が複数回出てきても1つにまとめる。
 */
export function parseTagNames(input: string): string[] {
  const names = input
    .split(/[\s,、#]+/)
    .map((name) => name.trim())
    .filter((name) => name !== '')

  return [...new Set(names)]
}

/**
 * タグ名を受け取り、その教材のタグとして存在させたうえでidを返す。
 *
 * `tags` は `(book_id, name)` に一意制約があるので、同名なら既存の行が使われる。
 * これが「同じ教材内で同名のタグは1つにまとまる」の実装。
 */
export async function ensureTags(
  bookId: string,
  names: string[],
): Promise<string[]> {
  if (names.length === 0) return []

  const { error: upsertError } = await supabase.from('tags').upsert(
    names.map((name) => ({ book_id: bookId, name })),
    { onConflict: 'book_id,name', ignoreDuplicates: true },
  )

  if (upsertError) throw upsertError

  const { data, error } = await supabase
    .from('tags')
    .select('id, name')
    .eq('book_id', bookId)
    .in('name', names)

  if (error) throw error
  return (data ?? []).map((row) => row.id)
}

/** ログにタグを結びつける */
export async function attachTagsToLog(
  logId: string,
  tagIds: string[],
): Promise<void> {
  if (tagIds.length === 0) return

  const { error } = await supabase
    .from('log_tags')
    .insert(tagIds.map((tagId) => ({ log_id: logId, tag_id: tagId })))

  if (error) throw error
}
