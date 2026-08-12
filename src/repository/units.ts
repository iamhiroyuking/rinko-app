import { supabase } from './supabase'
import type { Database } from './database.types'

type UnitRow = Database['public']['Tables']['units']['Row']

export type UnitStatus = UnitRow['status']

export type Unit = {
  id: string
  order: number
  title: string
  objective: string | null
  presenterId: string | null
  scheduledDate: string | null
  status: UnitStatus
  createdBy: string
  pageFrom: number | null
  pageTo: number | null
  /** 「p.27の章末2.3から」のような、人が読むための開始箇所。数値のページ範囲とは別枠 */
  startNote: string | null
}

export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  not_started: '未着手',
  in_progress: '進行中',
  done: '完了',
}

/** 選択肢として出す順番。進み具合の順に並べてある */
export const UNIT_STATUSES: UnitStatus[] = [
  'not_started',
  'in_progress',
  'done',
]

export type UnitProgress = {
  done: number
  total: number
  /** 0〜100 の整数。回が無いときは 0 */
  percent: number
}

/**
 * 完了した回の割合を数える。
 *
 * データ取得を伴わない純粋な関数にしてあるので、後からテストを書ける
 * （進捗率の計算は docs/issues.md でテスト対象に挙げている項目）。
 */
export function countProgress(units: Unit[]): UnitProgress {
  const total = units.length
  const done = units.filter((unit) => unit.status === 'done').length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return { done, total, percent }
}

/**
 * 次にやる回を選ぶ。第N回の順で最初の「完了していない回」。
 *
 * 進行中の回があればそれを返す。輪講は前から順に進むので、
 * 日付ではなく並び順で決めている。日付が入っていない回や、
 * 予定より遅れている回でも同じように扱えるため。
 *
 * countProgress と同じくデータ取得を伴わない純粋な関数にしてある。
 */
export function findNextUnit(units: Unit[]): Unit | null {
  return units.find((unit) => unit.status !== 'done') ?? null
}

function toUnit(row: UnitRow): Unit {
  return {
    id: row.id,
    order: row.order,
    title: row.title,
    objective: row.objective,
    presenterId: row.presenter_id,
    scheduledDate: row.scheduled_date,
    status: row.status,
    createdBy: row.created_by,
    pageFrom: row.page_from,
    pageTo: row.page_to,
    startNote: row.start_note,
  }
}

/**
 * その教材の回を第N回の順に返す。
 * ゴミ箱に入れたものは除く。
 */
export async function listUnits(bookId: string): Promise<Unit[]> {
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .eq('book_id', bookId)
    .is('deleted_at', null)
    .order('order')

  if (error) throw error
  return (data ?? []).map(toUnit)
}

export async function getUnit(unitId: string): Promise<Unit | null> {
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .eq('id', unitId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  return data ? toUnit(data) : null
}

export type NewUnit = {
  bookId: string
  title: string
  objective?: string | null
  presenterId?: string | null
  scheduledDate?: string | null
  pageFrom?: number | null
  pageTo?: number | null
  startNote?: string | null
}

/**
 * 回を作り、そのidを返す。
 *
 * 第N回の番号は、その教材の最大値に1を足して決める。
 * 2人が同時に作ると同じ番号になりうるが、番号は後から手で編集できる仕様で
 * 一意制約も付けていないため、そのまま許容する。
 *
 * 教材のときと違って `insert(...).select()` がそのまま使える。
 * 回の閲覧条件は「その教材に参加していること」で、作る人はすでに参加者だからである。
 */
export async function createUnit(input: NewUnit): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const userId = userData.user?.id
  if (!userId) throw new Error('ログインが必要です')

  // ゴミ箱に入れた回も数に含めている（deleted_at で絞っていない）。
  //
  // 除くと、捨てた第3回がある状態で新しく作ったとき番号が3で重複し、
  // その回を復元した瞬間に同じ番号が2つ並ぶ。
  // 含めると一覧が「第1回・第2回・第4回」と飛ぶが、番号は後から手で
  // 直せる仕様なので、重複を作るより飛ばす方を選んでいる。
  const { data: last, error: lastError } = await supabase
    .from('units')
    .select('order')
    .eq('book_id', input.bookId)
    .order('order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastError) throw lastError

  const nextOrder = (last?.order ?? 0) + 1

  const { data, error } = await supabase
    .from('units')
    .insert({
      book_id: input.bookId,
      order: nextOrder,
      title: input.title,
      objective: input.objective ?? null,
      presenter_id: input.presenterId ?? null,
      scheduled_date: input.scheduledDate ?? null,
      created_by: userId,
      page_from: input.pageFrom ?? null,
      page_to: input.pageTo ?? null,
      start_note: input.startNote ?? null,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export type UnitPages = {
  pageFrom: number | null
  pageTo: number | null
  startNote: string | null
}

/**
 * 進んだページの情報だけを更新する。
 *
 * 回を開始する前に開始ページだけ埋めておき、終わったら終了ページを
 * 追記する、という2段階の入力を想定しているので、他の項目とは
 * 分けて更新できるようにしている。
 *
 * 数値2つと自由記述はUnitViewの同じパネルで一緒に編集するので、
 * 別々の関数には分けず1回の更新にまとめている。
 */
export async function updateUnitPages(
  unitId: string,
  pages: UnitPages,
): Promise<void> {
  const { error } = await supabase
    .from('units')
    .update({
      page_from: pages.pageFrom,
      page_to: pages.pageTo,
      start_note: pages.startNote,
    })
    .eq('id', unitId)

  if (error) throw error
}

/**
 * 回のステータスを変える。
 *
 * 権限は「編集者なら誰でも」。輪講中に気づいた人がその場で更新できるほうが
 * 実態に合うため、担当者や作成者に限っていない（docs/features.md の UNIT-4）。
 */
export async function updateUnitStatus(
  unitId: string,
  status: UnitStatus,
): Promise<void> {
  const { error } = await supabase
    .from('units')
    .update({ status })
    .eq('id', unitId)

  if (error) throw error
}

/**
 * 回をゴミ箱に入れる／復元する。
 *
 * データベース側のトリガー（protect_unit_deletion）が作成者以外の
 * deleted_at 変更を拒否するので、ここで権限を判定する必要はない。
 * 作成者でない人が押せないよう、ボタン自体は画面側で隠す。
 */
export async function trashUnit(unitId: string): Promise<void> {
  const { error } = await supabase
    .from('units')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', unitId)

  if (error) throw error
}

export async function restoreUnit(unitId: string): Promise<void> {
  const { error } = await supabase
    .from('units')
    .update({ deleted_at: null })
    .eq('id', unitId)

  if (error) throw error
}

/** ゴミ箱から完全に削除する。ログなど配下のデータも連鎖して消える */
export async function permanentlyDeleteUnit(unitId: string): Promise<void> {
  const { error } = await supabase.from('units').delete().eq('id', unitId)
  if (error) throw error
}

export type TrashedUnit = {
  id: string
  bookId: string
  bookTitle: string
  order: number
  title: string
  deletedAt: string
}

/**
 * 自分が作って削除した回を返す。
 *
 * 他人が作った回は、自分の画面から消えていてもここには出ない
 * （復元できるのは作成者だけのため）。
 */
export async function listMyTrashedUnits(): Promise<TrashedUnit[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) throw new Error('ログインが必要です')

  const { data, error } = await supabase
    .from('units')
    .select('id, book_id, order, title, deleted_at, books (title)')
    .eq('created_by', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) throw error

  return (data ?? []).flatMap((row) => {
    if (!row.books || !row.deleted_at) return []
    return [
      {
        id: row.id,
        bookId: row.book_id,
        bookTitle: row.books.title,
        order: row.order,
        title: row.title,
        deletedAt: row.deleted_at,
      },
    ]
  })
}
