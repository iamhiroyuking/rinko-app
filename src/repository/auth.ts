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
 * パスワード再設定のメールを送る。
 *
 * メールのリンクを開くと、URLに一時的な鍵が付いた状態で redirectTo に飛ぶ。
 * Supabaseのクライアントがそれを読み取って自動でログイン状態を作るので、
 * 飛んだ先の画面では updatePassword() をそのまま呼べる。
 *
 * 登録されていないメールアドレスでもエラーにならない。これは仕様で、
 * 「そのアドレスが登録済みかどうか」を外部に知らせないためである。
 * 画面側でも、送れたかどうかに関わらず同じ文言を出す。
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

/** ログイン中（再設定リンクから来た状態を含む）のパスワードを変える */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

/**
 * 自分のアカウントを削除する（#145）。
 *
 * データベース側の `delete_my_account()` 関数を呼ぶ。投稿した記録は
 * 残り、投稿者の表示だけが「退会したユーザー」に変わる（共有相手の
 * スレッドを壊さないため）。引数を取らない関数なので、他人のアカウントを
 * 消せる経路にはならない。
 *
 * 消えた本人の状態が端末に残らないよう、続けてサインアウトする。
 * サインアウトが失敗しても、削除そのものは終わっているので投げない。
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw error

  await supabase.auth.signOut().catch(() => {
    // 削除自体は済んでいる。サインアウトの失敗で使い勝手を損なわない
  })
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
