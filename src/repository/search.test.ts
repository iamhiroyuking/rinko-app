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
    type: 'none',
    resolvedAt: null,
    tagNames: [],
    createdAt: '2026-08-01T00:00:00Z',
    attachmentCount: 0,
    ...overrides,
  }
}

describe('filterLogs', () => {
  it('条件が1つも無ければ何も返さない', () => {
    const logs = [searchable({ logId: 'a', body: '正則化' })]
    expect(filterLogs(logs, { query: '' })).toEqual([])
    expect(filterLogs(logs, { query: '   ' })).toEqual([])
    expect(filterLogs(logs, {})).toEqual([])
    expect(filterLogs(logs, { types: [] })).toEqual([])
  })

  it('タイトル・本文・タグのどこに一致したかを持つ', () => {
    const logs = [
      searchable({ logId: 'title', title: '正則化の話', body: '無関係' }),
      searchable({ logId: 'body', body: '正則化について' }),
      searchable({ logId: 'tag', body: '無関係', tagNames: ['正則化'] }),
    ]
    const hits = filterLogs(logs, { query: '正則化' })
    expect(hits.map((h) => h.logId).sort()).toEqual(['body', 'tag', 'title'])
    expect(hits.find((h) => h.logId === 'title')?.matchedIn).toEqual(['title'])
    expect(hits.find((h) => h.logId === 'tag')?.matchedIn).toEqual(['tag'])
  })

  it('タイトルと本文の両方に一致したら両方を挙げる', () => {
    const logs = [
      searchable({ logId: 'a', title: '過学習', body: '過学習とは' }),
    ]
    expect(filterLogs(logs, { query: '過学習' })[0].matchedIn).toEqual([
      'title',
      'body',
    ])
  })

  it('大文字と小文字を区別しない', () => {
    const logs = [searchable({ logId: 'a', body: 'Regularization' })]
    expect(filterLogs(logs, { query: 'regularization' })).toHaveLength(1)
    expect(filterLogs(logs, { query: 'REGULARIZATION' })).toHaveLength(1)
  })

  it('一致しなければ返さない', () => {
    const logs = [searchable({ logId: 'a', body: '正則化' })]
    expect(filterLogs(logs, { query: '確率' })).toEqual([])
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
    expect(filterLogs(logs, { query: 'あ' }).map((h) => h.logId)).toEqual([
      '1回目',
      '2回目の古い方',
      '2回目の新しい方',
    ])
  })

  it('キーワードが無くても種類だけで絞れる', () => {
    const logs = [
      searchable({ logId: 'q', type: 'question', body: '無関係' }),
      searchable({ logId: 'r', type: 'review', body: '無関係' }),
      searchable({ logId: 'n', type: 'none', body: '無関係' }),
    ]
    expect(
      filterLogs(logs, { types: ['question'] }).map((h) => h.logId),
    ).toEqual(['q'])
  })

  it('種類は複数選べる', () => {
    const logs = [
      searchable({ logId: 'p', type: 'preview' }),
      searchable({ logId: 'q', type: 'question' }),
      searchable({ logId: 'r', type: 'review' }),
    ]
    const hits = filterLogs(logs, { types: ['preview', 'review'] })
    expect(hits.map((h) => h.logId).sort()).toEqual(['p', 'r'])
  })

  it('キーワードが無いときは matchedIn が空になる', () => {
    const logs = [searchable({ logId: 'q', type: 'question', body: '正則化' })]
    expect(filterLogs(logs, { types: ['question'] })[0].matchedIn).toEqual([])
  })

  it('キーワードと種類は両方に当てはまるものだけ返す', () => {
    const logs = [
      searchable({ logId: '疑問で一致', type: 'question', body: '正則化' }),
      searchable({ logId: '疑問だが不一致', type: 'question', body: '確率' }),
      searchable({ logId: '一致だが復習', type: 'review', body: '正則化' }),
    ]
    expect(
      filterLogs(logs, { query: '正則化', types: ['question'] }).map(
        (h) => h.logId,
      ),
    ).toEqual(['疑問で一致'])
  })

  it('しおりだけに絞れる。キーワードが無くても一覧になる', () => {
    const logs = [
      searchable({ logId: 'a', body: '正則化' }),
      searchable({ logId: 'b', body: '正則化' }),
    ]
    const marked = new Set(['b'])
    expect(
      filterLogs(logs, { markedLogIds: marked }).map((h) => h.logId),
    ).toEqual(['b'])
  })

  it('しおりと種類とキーワードを重ねられる', () => {
    const logs = [
      searchable({ logId: '全部満たす', type: 'question', body: '正則化' }),
      searchable({ logId: 'しおり無し', type: 'question', body: '正則化' }),
      searchable({ logId: '種類違い', type: 'review', body: '正則化' }),
      searchable({ logId: '語が違う', type: 'question', body: '確率' }),
    ]
    const marked = new Set(['全部満たす', '種類違い', '語が違う'])
    expect(
      filterLogs(logs, {
        query: '正則化',
        types: ['question'],
        markedLogIds: marked,
      }).map((h) => h.logId),
    ).toEqual(['全部満たす'])
  })

  it('未解決の疑問だけに絞れる', () => {
    const logs = [
      searchable({ logId: '未解決', type: 'question', resolvedAt: null }),
      searchable({
        logId: '解決済み',
        type: 'question',
        resolvedAt: '2026-08-20T00:00:00Z',
      }),
      searchable({ logId: '疑問ではない', type: 'review', resolvedAt: null }),
    ]
    expect(
      filterLogs(logs, { unresolvedOnly: true }).map((h) => h.logId),
    ).toEqual(['未解決'])
  })

  // 画面では両方を同時に選べないようにしてある（#132 / #136）。
  // ここは万一渡ってきたときに、静かに広く返さないための守り
  it('未解決と噛み合わない種類が来たら、広げずに空を返す', () => {
    const logs = [
      searchable({ logId: '未解決の疑問', type: 'question' }),
      searchable({ logId: '復習', type: 'review' }),
    ]
    expect(
      filterLogs(logs, { unresolvedOnly: true, types: ['review'] }),
    ).toEqual([])
  })

  it('しおりが1つも無ければ何も返さない', () => {
    const logs = [searchable({ logId: 'a', body: '正則化' })]
    expect(filterLogs(logs, { markedLogIds: new Set<string>() })).toEqual([])
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
