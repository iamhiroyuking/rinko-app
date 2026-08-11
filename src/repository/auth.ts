import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * アカウントを作る。
 *
 * 表示名は options.data に載せる。この値はデータベース側の
 * handle_new_user トリガーが読み取って profiles テーブルの行を作るため、
 * ここで渡さないと表示名が「メールアドレスの@より前」になる。
 */
export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<Session | null> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  })
  if (error) throw error
  return data.session
}

export async function signIn(
  email: string,
  password: string,
): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data.session
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

/**
 * ログイン状態が変わったときに呼ばれる。
 * 戻り値の関数を呼ぶと購読をやめる。
 */
export function onAuthStateChange(
  callback: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => data.subscription.unsubscribe()
}
