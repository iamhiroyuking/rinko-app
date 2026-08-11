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
