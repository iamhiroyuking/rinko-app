import { supabase } from './supabase'
import type { Database } from './database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']

/**
 * 自分のプロフィールを取り出す。
 *
 * profiles の行はサインアップ時にデータベース側のトリガーが作るので、
 * アプリから作成する処理は無い。ここで null が返るならトリガーが動いていない。
 */
export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}
