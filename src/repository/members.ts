import { supabase } from './supabase'
import type { Database } from './database.types'

type MembershipRow = Database['public']['Tables']['memberships']['Row']

export type BookMember = {
  userId: string
  displayName: string
  role: MembershipRow['role']
}

/**
 * その教材に参加している人を返す。担当者を選ぶときの選択肢になる。
 *
 * ゴミ箱に入れた人（deleted_at が入っている人）は含めない。
 */
export async function listBookMembers(bookId: string): Promise<BookMember[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('user_id, role, profiles (display_name)')
    .eq('book_id', bookId)
    .is('deleted_at', null)
    .order('joined_at')

  if (error) throw error

  return (data ?? []).flatMap((row) => {
    if (!row.profiles) return []
    return [
      {
        userId: row.user_id,
        displayName: row.profiles.display_name,
        role: row.role,
      },
    ]
  })
}
