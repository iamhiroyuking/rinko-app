import { describe, expect, it } from 'vitest'
import {
  formatUnitPageRange,
  toPageNumber,
  validatePageRange,
} from './pageRange'

describe('toPageNumber', () => {
  it('空欄は null', () => {
    expect(toPageNumber('')).toBeNull()
    expect(toPageNumber('   ')).toBeNull()
  })

  it('数字は数値になる', () => {
    expect(toPageNumber('42')).toBe(42)
    expect(toPageNumber(' 7 ')).toBe(7)
    expect(toPageNumber('0')).toBe(0)
  })

  it('整数でないもの・負の数は null', () => {
    expect(toPageNumber('abc')).toBeNull()
    expect(toPageNumber('1.5')).toBeNull()
    expect(toPageNumber('-3')).toBeNull()
  })
})

describe('validatePageRange', () => {
  it('片方だけ・両方空は通す', () => {
    expect(validatePageRange(10, null)).toBeNull()
    expect(validatePageRange(null, 10)).toBeNull()
    expect(validatePageRange(null, null)).toBeNull()
  })

  it('開始と終了が同じでも通す', () => {
    expect(validatePageRange(10, 10)).toBeNull()
  })

  it('開始が終了より大きいときだけ拒否する', () => {
    expect(validatePageRange(11, 10)).not.toBeNull()
  })
})

/**
 * 回のページ範囲。
 *
 * 片側だけ入る形は #32 で実際に壊れたところなので、開始のみ・終了のみを
 * それぞれ確かめる。回が始まる前に開始だけ書ける仕様が理由。
 */
describe('formatUnitPageRange', () => {
  it('どちらも無ければ null', () => {
    expect(formatUnitPageRange(null, null)).toBeNull()
  })

  it('開始だけなら続きがあることを示す', () => {
    expect(formatUnitPageRange(71, null)).toBe('p.71〜')
  })

  it('終了だけなら前に開きがあることを示す', () => {
    expect(formatUnitPageRange(null, 90)).toBe('〜p.90')
  })

  it('両方あれば範囲になる', () => {
    expect(formatUnitPageRange(71, 90)).toBe('p.71〜p.90')
  })

  it('同じページなら1つだけ出す', () => {
    expect(formatUnitPageRange(71, 71)).toBe('p.71')
  })
})
