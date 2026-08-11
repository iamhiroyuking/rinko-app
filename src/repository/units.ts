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
}

export const UNIT_STATUS_LABEL: Record<UnitStatus, string> = {
  not_started: '未着手',
  in_progress: '進行中',
  done: '完了',
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
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}
