import { supabase } from './supabase'
import type { Database } from './database.types'

type BookRow = Database['public']['Tables']['books']['Row']
type MembershipRow = Database['public']['Tables']['memberships']['Row']

/** 本棚に並べる1冊。教材の情報と、自分の参加情報を合わせたもの */
export type ShelfBook = {
  id: BookRow['id']
  title: BookRow['title']
  coverImageUrl: BookRow['cover_image_url']
  shelfStatus: MembershipRow['shelf_status']
  displayOrder: MembershipRow['display_order']
}

/**
 * 自分の本棚にある教材を取り出す。
 *
 * 参加している教材だけが返る。これはこちらで絞り込んでいるのではなく、
 * データベース側の行レベルセキュリティがそう判断している。
 * ゴミ箱に入れたもの（deleted_at が入っているもの）は除く。
 */
export async function listShelfBooks(
  shelfStatus: MembershipRow['shelf_status'] = 'reading',
): Promise<ShelfBook[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('display_order, shelf_status, books (id, title, cover_image_url)')
    .is('deleted_at', null)
    .eq('shelf_status', shelfStatus)
    .order('display_order')

  if (error) throw error

  return (data ?? []).flatMap((row) => {
    // books は外部キー越しの取得なので、型のうえでは null になりうる
    if (!row.books) return []
    return [
      {
        id: row.books.id,
        title: row.books.title,
        coverImageUrl: row.books.cover_image_url,
        shelfStatus: row.shelf_status,
        displayOrder: row.display_order,
      },
    ]
  })
}

export type NewBook = {
  title: string
  coverImageUrl?: string | null
  goal?: string | null
}

/**
 * 教材を作り、そのidを返す。
 *
 * 素直に `insert(...).select('id')` と書くと失敗する。教材の閲覧は
 * 「参加していること」が条件で、作成者を参加者にするのは AFTER INSERT
 * トリガーだが、AFTER 行トリガーは文の終わりに動くのに対し RETURNING は
 * 行を処理する時点で作られるため、まだ参加情報が無い状態で弾かれてしまう。
 *
 * そのためデータベース側の create_book 関数を呼ぶ。詳しい理由は
 * supabase/migrations/20260811045139_create_book_function.sql に書いてある。
 */
export async function createBook(input: NewBook): Promise<string> {
  const { data, error } = await supabase.rpc('create_book', {
    book_title: input.title,
    book_cover_image_url: input.coverImageUrl ?? undefined,
    book_goal: input.goal ?? undefined,
  })

  if (error) throw error
  return data
}
