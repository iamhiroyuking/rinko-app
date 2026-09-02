import { describe, expect, it } from 'vitest'
import {
  countProgress,
  findNextUnit,
  sortUnits,
  type Unit,
  type UnitStatus,
} from './units'

/** テスト用の回。関係のない項目は既定値で埋める */
function unit(
  order: number,
  status: UnitStatus,
  overrides: Partial<Pick<Unit, 'title' | 'createdAt'>> = {},
): Unit {
  return {
    id: `unit-${order}`,
    order,
    title: overrides.title ?? `第${order}回`,
    objective: null,
    presenterId: null,
    scheduledDate: null,
    status,
    createdBy: 'me',
    pageFrom: null,
    pageTo: null,
    startNote: null,
    createdAt:
      overrides.createdAt ?? `2026-08-${String(order).padStart(2, '0')}`,
  }
}

describe('countProgress', () => {
  it('回が無ければ0件・0%（0除算にしない）', () => {
    expect(countProgress([])).toEqual({ done: 0, total: 0, percent: 0 })
  })

  it('完了した回の割合を出す', () => {
    const units = [
      unit(1, 'done'),
      unit(2, 'done'),
      unit(3, 'in_progress'),
      unit(4, 'not_started'),
    ]
    expect(countProgress(units)).toEqual({ done: 2, total: 4, percent: 50 })
  })

  it('割り切れないときは四捨五入する', () => {
    const units = [unit(1, 'done'), unit(2, 'not_started'), unit(3, 'done')]
    // 2/3 = 66.67%
    expect(countProgress(units).percent).toBe(67)
  })

  it('進行中は完了に数えない', () => {
    expect(countProgress([unit(1, 'in_progress')]).done).toBe(0)
  })
})

/**
 * 次にやる回。
 *
 * 輪講は前から順に進むので、輪講日ではなく並び順で決めている。
 * 日付が入っていない回や遅れている回でも同じように扱えるようにするため。
 */
describe('findNextUnit', () => {
  it('回が無ければ null', () => {
    expect(findNextUnit([])).toBeNull()
  })

  it('最初の未完了の回を返す', () => {
    const units = [
      unit(1, 'done'),
      unit(2, 'in_progress'),
      unit(3, 'not_started'),
    ]
    expect(findNextUnit(units)?.order).toBe(2)
  })

  it('すべて完了していれば null', () => {
    expect(findNextUnit([unit(1, 'done'), unit(2, 'done')])).toBeNull()
  })

  it('完了した回が後ろに残っていても、前の未完了を優先する', () => {
    const units = [unit(1, 'done'), unit(2, 'not_started'), unit(3, 'done')]
    expect(findNextUnit(units)?.order).toBe(2)
  })
})

describe('sortUnits', () => {
  it('番号順は order の昇順', () => {
    const units = [
      unit(3, 'not_started'),
      unit(1, 'not_started'),
      unit(2, 'not_started'),
    ]
    expect(sortUnits(units, 'order').map((u) => u.order)).toEqual([1, 2, 3])
  })

  it('作成日順は createdAt の昇順（番号と対応していなくてもよい）', () => {
    const units = [
      unit(1, 'not_started', { createdAt: '2026-08-20' }),
      unit(2, 'not_started', { createdAt: '2026-08-01' }),
      unit(3, 'not_started', { createdAt: '2026-08-10' }),
    ]
    expect(sortUnits(units, 'createdAt').map((u) => u.order)).toEqual([2, 3, 1])
  })

  it('タイトル順は日本語のロケールで比較する', () => {
    const units = [
      unit(1, 'not_started', { title: 'う' }),
      unit(2, 'not_started', { title: 'あ' }),
      unit(3, 'not_started', { title: 'い' }),
    ]
    expect(sortUnits(units, 'title').map((u) => u.title)).toEqual([
      'あ',
      'い',
      'う',
    ])
  })

  it('元の配列を書き換えない', () => {
    const units = [unit(2, 'not_started'), unit(1, 'not_started')]
    sortUnits(units, 'order')
    expect(units.map((u) => u.order)).toEqual([2, 1])
  })
})
