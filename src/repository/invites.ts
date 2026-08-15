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

/** 招待リンクで渡せる権限 */
export type InviteRole = 'editor' | 'viewer'

export const INVITE_ROLE_LABEL: Record<InviteRole, string> = {
  editor: '書き込める',
  viewer: '見るだけ',
}

export const INVITE_ROLES: InviteRole[] = ['editor', 'viewer']

/**
 * その教材の、その権限の招待リンクを取り出す。無ければ null。
 *
 * 発行のたびに増やすのではなく、権限ごとに1本を使い回す。
 * 同じ権限のリンクが複数あると、どれを配ったか分からなくなるため。
 * 権限が違うものは別のリンクにする。用途が違うので混ざると困る。
 */
export async function getInviteToken(
  bookId: string,
  role: InviteRole,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('invite_links')
    .select('token')
    .eq('book_id', bookId)
    .eq('role', role)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data?.token ?? null
}

/** 招待リンクを発行する。同じ権限のものが既にあればそれを返す */
export async function issueInviteToken(
  bookId: string,
  role: InviteRole,
): Promise<string> {
  const existing = await getInviteToken(bookId, role)
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
      role,
      created_by: userId,
    })
    .select('token')
    .single()

  if (error) throw error
  return data.token
}

/**
 * その権限の招待リンクを無効にする。
 *
 * 行そのものを消す。無効にした印を付ける形にすると、
 * 「有効なリンクはどれか」を毎回判定することになり、
 * 消し忘れたリンクが生き続ける事故に繋がる。
 *
 * 既に参加している人はそのまま残る。リンクは入口を閉じるだけで、
 * 中にいる人を追い出すものではない。
 */
export async function revokeInviteToken(
  bookId: string,
  role: InviteRole,
): Promise<void> {
  const { error } = await supabase
    .from('invite_links')
    .delete()
    .eq('book_id', bookId)
    .eq('role', role)

  if (error) throw error
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
