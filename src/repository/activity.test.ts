import { describe, expect, it } from 'vitest'
import { sortUpcoming, type UpcomingUnit } from './activity'

function upcoming(overrides: Partial<UpcomingUnit> & { bookTitle: string }) {
  return {
    bookId: overrides.bookTitle,
    unitId: 'unit',
    order: 1,
    title: '第1回',
    scheduledDate: null,
    presenterName: null,
    isMine: false,
    ...overrides,
  }
}

describe('sortUpcoming', () => {
  it('日程が近い順に並ぶ', () => {
    const items = [
      upcoming({ bookTitle: '後', scheduledDate: '2026-09-10' }),
      upcoming({ bookTitle: '先', scheduledDate: '2026-09-01' }),
    ]
    expect(sortUpcoming(items).map((i) => i.bookTitle)).toEqual(['先', '後'])
  })

  it('日程未定は、決まっているものより後ろに置く', () => {
    const items = [
      upcoming({ bookTitle: '未定', scheduledDate: null }),
      upcoming({ bookTitle: '決定', scheduledDate: '2026-09-10' }),
    ]
    expect(sortUpcoming(items).map((i) => i.bookTitle)).toEqual([
      '決定',
      '未定',
    ])
  })

  it('同じ日付なら書名の順にして、並びが揺れないようにする', () => {
    const items = [
      upcoming({ bookTitle: 'B', scheduledDate: '2026-09-01' }),
      upcoming({ bookTitle: 'A', scheduledDate: '2026-09-01' }),
    ]
    expect(sortUpcoming(items).map((i) => i.bookTitle)).toEqual(['A', 'B'])
  })

  it('どちらも日程未定なら書名の順', () => {
    const items = [upcoming({ bookTitle: 'B' }), upcoming({ bookTitle: 'A' })]
    expect(sortUpcoming(items).map((i) => i.bookTitle)).toEqual(['A', 'B'])
  })

  it('元の配列を変えない', () => {
    const items = [
      upcoming({ bookTitle: 'B', scheduledDate: '2026-09-10' }),
      upcoming({ bookTitle: 'A', scheduledDate: '2026-09-01' }),
    ]
    sortUpcoming(items)
    expect(items.map((i) => i.bookTitle)).toEqual(['B', 'A'])
  })
})
