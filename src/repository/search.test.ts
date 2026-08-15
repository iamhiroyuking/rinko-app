import { describe, expect, it } from 'vitest'
import { filterLogs, topTagNames, type SearchableLog } from './search'

function searchable(
  overrides: Partial<SearchableLog> & { logId: string },
): SearchableLog {
  return {
    unitId: 'unit-1',
    unitOrder: 1,
    unitTitle: '第1回',
    authorId: 'me',
    title: null,
    body: '',
    tagNames: [],
    createdAt: '2026-08-01T00:00:00Z',
    attachmentCount: 0,
    ...overrides,
  }
}

describe('filterLogs', () => {
  it('キーワードが空なら何も返さない', () => {
    const logs = [searchable({ logId: 'a', body: '正則化' })]
    expect(filterLogs(logs, '')).toEqual([])
    expect(filterLogs(logs, '   ')).toEqual([])
  })

  it('タイトル・本文・タグのどこに一致したかを持つ', () => {
    const logs = [
      searchable({ logId: 'title', title: '正則化の話', body: '無関係' }),
      searchable({ logId: 'body', body: '正則化について' }),
      searchable({ logId: 'tag', body: '無関係', tagNames: ['正則化'] }),
    ]
    const hits = filterLogs(logs, '正則化')
    expect(hits.map((h) => h.logId).sort()).toEqual(['body', 'tag', 'title'])
    expect(hits.find((h) => h.logId === 'title')?.matchedIn).toEqual(['title'])
    expect(hits.find((h) => h.logId === 'tag')?.matchedIn).toEqual(['tag'])
  })

  it('タイトルと本文の両方に一致したら両方を挙げる', () => {
    const logs = [
      searchable({ logId: 'a', title: '過学習', body: '過学習とは' }),
    ]
    expect(filterLogs(logs, '過学習')[0].matchedIn).toEqual(['title', 'body'])
  })

  it('大文字と小文字を区別しない', () => {
    const logs = [searchable({ logId: 'a', body: 'Regularization' })]
    expect(filterLogs(logs, 'regularization')).toHaveLength(1)
    expect(filterLogs(logs, 'REGULARIZATION')).toHaveLength(1)
  })

  it('一致しなければ返さない', () => {
    const logs = [searchable({ logId: 'a', body: '正則化' })]
    expect(filterLogs(logs, '確率')).toEqual([])
  })

  it('回の順、同じ回では古い順に並ぶ', () => {
    const logs = [
      searchable({
        logId: '2回目の新しい方',
        unitOrder: 2,
        body: 'あ',
        createdAt: '2026-08-05T00:00:00Z',
      }),
      searchable({
        logId: '2回目の古い方',
        unitOrder: 2,
        body: 'あ',
        createdAt: '2026-08-04T00:00:00Z',
      }),
      searchable({
        logId: '1回目',
        unitOrder: 1,
        body: 'あ',
        createdAt: '2026-08-09T00:00:00Z',
      }),
    ]
    expect(filterLogs(logs, 'あ').map((h) => h.logId)).toEqual([
      '1回目',
      '2回目の古い方',
      '2回目の新しい方',
    ])
  })
})

describe('topTagNames', () => {
  it('多い順に並べる', () => {
    const logs = [
      searchable({ logId: 'a', tagNames: ['線形代数', '固有値'] }),
      searchable({ logId: 'b', tagNames: ['線形代数'] }),
      searchable({ logId: 'c', tagNames: ['線形代数', '固有値'] }),
      searchable({ logId: 'd', tagNames: ['行列式'] }),
    ]
    expect(topTagNames(logs)).toEqual(['線形代数', '固有値', '行列式'])
  })

  it('同数なら名前の順にして、並びが揺れないようにする', () => {
    const logs = [searchable({ logId: 'a', tagNames: ['B', 'A'] })]
    expect(topTagNames(logs)).toEqual(['A', 'B'])
  })

  it('件数の上限を守る', () => {
    const logs = [searchable({ logId: 'a', tagNames: ['A', 'B', 'C'] })]
    expect(topTagNames(logs, 2)).toHaveLength(2)
  })

  it('タグが無ければ空', () => {
    expect(topTagNames([searchable({ logId: 'a' })])).toEqual([])
  })
})
