import { supabase } from './supabase'
import { removeBookImages, removeStoragePaths } from './attachments'
import type { Database } from './database.types'

type BookRow = Database['public']['Tables']['books']['Row']
type MembershipRow = Database['public']['Tables']['memberships']['Row']

export type ShelfStatus = MembershipRow['shelf_status']

export const SHELF_STATUS_LABEL: Record<ShelfStatus, string> = {
  planned: '学習予定',
  reading: '学習中',
  finished: '学習完了',
}

/** 選択肢として出す順番。読む前・読んでいる間・読み終えた後の順 */
export const SHELF_STATUSES: ShelfStatus[] = ['planned', 'reading', 'finished']

/** 本棚に並べる1冊。教材の情報と、自分の参加情報を合わせたもの */
export type ShelfBook = {
  id: BookRow['id']
  title: BookRow['title']
  coverImageUrl: BookRow['cover_image_url']
  /** 手元から上げた表紙の置き場所。URLとは別に持つ */
  coverStoragePath: BookRow['cover_storage_path']
  shelfStatus: ShelfStatus
  displayOrder: MembershipRow['display_order']
  /** 自分を含む参加者の人数。2人以上なら共有されている */
  memberCount: number
}

/**
 * 自分の本棚にある教材を取り出す。
 *
 * `user_id` で自分の参加情報だけに絞っているのが要点。
 * 行レベルセキュリティに任せてはいけない。参加者名を表示するために、
 * 「自分が参加している教材の参加者全員」を読める設定にしてあるので、
 * 絞らないと共有相手の参加情報まで返ってきて同じ教材が重複する。
 *
 * ゴミ箱に入れたもの（deleted_at が入っているもの）は除く。
 */
export async function listShelfBooks(
  shelfStatus: ShelfStatus = 'reading',
): Promise<ShelfBook[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const userId = userData.user?.id
  if (!userId) throw new Error('ログインが必要です')

  const { data, error } = await supabase
    .from('memberships')
    .select(
      'display_order, shelf_status, books (id, title, cover_image_url, cover_storage_path, memberships (user_id))',
    )
    .eq('user_id', userId)
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
        coverStoragePath: row.books.cover_storage_path,
        shelfStatus: row.shelf_status,
        displayOrder: row.display_order,
        memberCount: row.books.memberships?.length ?? 1,
      },
    ]
  })
}

/** その教材に対する「自分の」参加情報。共有相手のものは含めない */
export type MyShelfEntry = {
  shelfStatus: ShelfStatus
  /** この教材に参加した日時。学習開始日として表示する */
  joinedAt: string
}

/**
 * 自分の参加情報を取り出す。
 *
 * `user_id` で絞るのを忘れないこと。参加者名を表示するために
 * 「同じ教材の参加者全員」を読める設定にしてあるので、絞らないと
 * 共有相手の行まで返ってきて、他人のステータスを自分のものとして
 * 表示してしまう（listShelfBooks と同じ落とし穴）。
 */
export async function getMyShelfEntry(
  bookId: string,
): Promise<MyShelfEntry | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) throw new Error('ログインが必要です')

  const { data, error } = await supabase
    .from('memberships')
    .select('shelf_status, joined_at')
    .eq('book_id', bookId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return { shelfStatus: data.shelf_status, joinedAt: data.joined_at }
}

/**
 * 本棚のステータスを変える。
 *
 * 自分の参加情報だけを書き換えるので、共有相手の本棚は変わらない。
 * 自分が読み終えても、まだ読んでいる人の「学習中」はそのまま残る。
 */
export async function updateShelfStatus(
  bookId: string,
  shelfStatus: ShelfStatus,
): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) throw new Error('ログインが必要です')

  const { error } = await supabase
    .from('memberships')
    .update({ shelf_status: shelfStatus })
    .eq('book_id', bookId)
    .eq('user_id', userId)

  if (error) throw error
}

export type Book = {
  id: string
  title: string
  coverImageUrl: string | null
  coverStoragePath: string | null
  goal: string | null
  createdBy: string
}

/** 教材そのものを取り出す。参加していなければ null が返る（行レベルセキュリティ） */
export async function getBook(bookId: string): Promise<Book | null> {
  const { data, error } = await supabase
    .from('books')
    .select('id, title, cover_image_url, cover_storage_path, goal, created_by')
    .eq('id', bookId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    title: data.title,
    coverImageUrl: data.cover_image_url,
    coverStoragePath: data.cover_storage_path,
    goal: data.goal,
    createdBy: data.created_by,
  }
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

/**
 * 上げた表紙の場所を教材に記録する。
 *
 * 教材が出来てからでないと置き場所（パス）が決まらないので、
 * 作成とは分けている。ログと画像の関係と同じ。
 */
export async function setBookCoverPath(
  bookId: string,
  storagePath: string,
): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ cover_storage_path: storagePath })
    .eq('id', bookId)

  if (error) throw error
}

export type BookEdit = {
  title: string
  goal: string | null
}

/**
 * 教材の題名と目標を書き換える。
 *
 * 権限は編集者。教材は共有されているので、変えると参加者全員の本棚に
 * 反映される（「追加と編集は全員に同期」の原則どおり）。
 */
export async function updateBook(
  bookId: string,
  input: BookEdit,
): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ title: input.title, goal: input.goal })
    .eq('id', bookId)

  if (error) throw error
}

/**
 * 表紙を差し替える、または外す。
 *
 * **前の画像をストレージから消すのを忘れないこと。** 残すと、どこからも
 * 辿れないファイルが容量を食い続ける（#53 で実際に踏んだ形）。
 * 記録を先に書き換えてから消すと、失敗したときに参照だけ失った
 * ファイルが残るので、順番は「新しいものを置く → 記録を変える → 古いものを消す」。
 */
export async function replaceBookCover(
  bookId: string,
  previousPath: string | null,
  nextPath: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ cover_storage_path: nextPath })
    .eq('id', bookId)

  if (error) throw error

  if (previousPath && previousPath !== nextPath) {
    await removeStoragePaths([previousPath])
  }
}

/**
 * 教材を自分の本棚から消す（ゴミ箱へ）。
 *
 * 自分の参加情報の deleted_at を立てるだけで、教材本体や他の参加者には
 * 触れない。共有している教材を消しても、他のメンバーの本棚には残る。
 */
export async function trashBook(bookId: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) throw new Error('ログインが必要です')

  const { error } = await supabase
    .from('memberships')
    .update({ deleted_at: new Date().toISOString() })
    .eq('book_id', bookId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function restoreBook(bookId: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) throw new Error('ログインが必要です')

  const { error } = await supabase
    .from('memberships')
    .update({ deleted_at: null })
    .eq('book_id', bookId)
    .eq('user_id', userId)

  if (error) throw error
}

/**
 * ゴミ箱から完全に削除する。
 *
 * 自分の参加情報の行そのものを消す。他に参加者がいなければ
 * delete_orphan_book トリガーが教材と配下のデータをまとめて消す。
 * 誰か残っていれば、その人たちには影響しない。
 */
export async function permanentlyDeleteBook(bookId: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) throw new Error('ログインが必要です')

  // 自分以外に参加者がいなければ、この削除で教材ごと消える。
  // 添付画像はストレージにあり連鎖しないので、先に消しておく。
  // 参加情報が消えたあとはストレージのポリシーも通らなくなり、
  // 本人にすら消せないファイルが残ってしまう。
  const { count, error: countError } = await supabase
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', bookId)
    .neq('user_id', userId)

  if (countError) throw countError
  if ((count ?? 0) === 0) await removeBookImages(bookId)

  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('book_id', bookId)
    .eq('user_id', userId)

  if (error) throw error
}

export type TrashedBook = {
  id: string
  title: string
  deletedAt: string
}

/** 自分がゴミ箱に入れた教材を返す */
export async function listTrashedBooks(): Promise<TrashedBook[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) throw new Error('ログインが必要です')

  const { data, error } = await supabase
    .from('memberships')
    .select('deleted_at, books (id, title)')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) throw error

  return (data ?? []).flatMap((row) => {
    if (!row.books || !row.deleted_at) return []
    return [
      { id: row.books.id, title: row.books.title, deletedAt: row.deleted_at },
    ]
  })
}
