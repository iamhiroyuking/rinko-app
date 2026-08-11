import { supabase } from './supabase'

/**
 * 招待リンクに使う文字列を作る。
 * URLの一部になるので、記号を含まない形にしている。
 */
function generateToken(): string {
  return crypto.randomUUID().replaceAll('-', '')
}

/** トークンから、共有相手に渡すURLを組み立てる */
export function inviteUrlOf(token: string): string {
  return `${window.location.origin}/join/${token}`
}

/**
 * 貼り付けられた文字列からトークンを取り出す。
 * URLをそのまま貼っても、トークンだけを貼っても通るようにする。
 */
export function extractToken(input: string): string {
  const trimmed = input.trim()
  const fromUrl = trimmed.match(/\/join\/([A-Za-z0-9]+)/)
  if (fromUrl) return fromUrl[1]
  return trimmed
}

/**
 * その教材の招待リンクを取り出す。無ければ null。
 *
 * 発行のたびに増やすのではなく、既にあるものを使い回す。
 * 有効なリンクが複数あると、どれを配ったか分からなくなるため。
 */
export async function getInviteToken(bookId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('invite_links')
    .select('token')
    .eq('book_id', bookId)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.token ?? null
}

/** 招待リンクを発行する。既にあればそれを返す */
export async function issueInviteToken(bookId: string): Promise<string> {
  const existing = await getInviteToken(bookId)
  if (existing) return existing

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const userId = userData.user?.id
  if (!userId) throw new Error('ログインが必要です')

  const { data, error } = await supabase
    .from('invite_links')
    .insert({
      book_id: bookId,
      token: generateToken(),
      role: 'editor',
      created_by: userId,
    })
    .select('token')
    .single()

  if (error) throw error
  return data.token
}

/**
 * 招待リンクで教材に参加し、その教材のidを返す。
 *
 * データベースの関数を呼んでいる。招待された人はまだ参加者ではないため、
 * 通常の問い合わせでは invite_links を読めずトークンを照合できない。
 */
export async function joinBookWithToken(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_book_with_token', {
    invite_token: token,
  })

  if (error) throw error
  return data
}
