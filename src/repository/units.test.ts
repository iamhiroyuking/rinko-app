import { describe, expect, it } from 'vitest'
import {
  countProgress,
  findNextUnit,
  type Unit,
  type UnitStatus,
} from './units'

/** テスト用の回。関係のない項目は既定値で埋める */
function unit(order: number, status: UnitStatus): Unit {
  return {
    id: `unit-${order}`,
    order,
    title: `第${order}回`,
    objective: null,
    presenterId: null,
    scheduledDate: null,
    status,
    createdBy: 'me',
    pageFrom: null,
    pageTo: null,
    startNote: null,
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
