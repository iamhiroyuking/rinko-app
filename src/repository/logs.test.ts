import { describe, expect, it } from 'vitest'
import {
  buildThreads,
  formatPageRange,
  sortThreadsByPage,
  type LogEntry,
} from './logs'

function log(
  id: string,
  createdAt: string,
  parentLogId: string | null = null,
): LogEntry {
  return {
    id,
    authorId: 'me',
    parentLogId,
    type: 'none',
    title: null,
    body: id,
    pageStart: null,
    pageEnd: null,
    createdAt,
    resolvedAt: null,
    tagNames: [],
    attachments: [],
  }
}

/**
 * スレッドの組み立て。
 *
 * 並び順は docs/screen-flow.md の仕様どおり。親は新しい順（最新の話題が上）、
 * 返信はその中で古い順（会話の流れを追える）。
 */
describe('buildThreads', () => {
  it('親は新しい順に並ぶ', () => {
    const threads = buildThreads([
      log('古い', '2026-08-01T00:00:00Z'),
      log('新しい', '2026-08-03T00:00:00Z'),
      log('中間', '2026-08-02T00:00:00Z'),
    ])
    expect(threads.map((t) => t.root.id)).toEqual(['新しい', '中間', '古い'])
  })

  it('返信は親の下に古い順で並ぶ', () => {
    const threads = buildThreads([
      log('親', '2026-08-01T00:00:00Z'),
      log('返信2', '2026-08-03T00:00:00Z', '親'),
      log('返信1', '2026-08-02T00:00:00Z', '親'),
    ])
    expect(threads).toHaveLength(1)
    expect(threads[0].replies.map((r) => r.id)).toEqual(['返信1', '返信2'])
  })

  it('親が見当たらない返信は親として扱う（消えて見えなくならないように）', () => {
    const threads = buildThreads([
      log('迷子', '2026-08-02T00:00:00Z', 'もう無い親'),
    ])
    expect(threads.map((t) => t.root.id)).toEqual(['迷子'])
    expect(threads[0].replies).toEqual([])
  })

  it('返信の無い親は replies が空になる', () => {
    const threads = buildThreads([log('単独', '2026-08-01T00:00:00Z')])
    expect(threads[0].replies).toEqual([])
  })
})

describe('formatPageRange', () => {
  it('どちらも無ければ null', () => {
    expect(formatPageRange(null, null)).toBeNull()
  })

  it('片方だけなら1ページとして出す', () => {
    expect(formatPageRange(47, null)).toBe('p.47')
    expect(formatPageRange(null, 47)).toBe('p.47')
  })

  it('範囲は始点と終点をつなぐ', () => {
    expect(formatPageRange(47, 60)).toBe('p.47-60')
  })

  it('同じページなら1つだけ出す', () => {
    expect(formatPageRange(47, 47)).toBe('p.47')
  })
})

/**
 * ページ順の並べ替え。
 *
 * 返信はページを持たないので、平らに並べ替えると会話が切れる。
 * 束のまま動かすことをここで固定する。
 */
describe('sortThreadsByPage', () => {
  function thread(
    id: string,
    pageStart: number | null,
    createdAt: string,
    replies: LogEntry[] = [],
    pageEnd: number | null = null,
  ) {
    const root = log(id, createdAt)
    return { root: { ...root, pageStart, pageEnd }, replies }
  }

  it('ページの小さい順に並ぶ', () => {
    const sorted = sortThreadsByPage([
      thread('p50', 50, '2026-08-01T00:00:00Z'),
      thread('p10', 10, '2026-08-02T00:00:00Z'),
      thread('p30', 30, '2026-08-03T00:00:00Z'),
    ])
    expect(sorted.map((t) => t.root.id)).toEqual(['p10', 'p30', 'p50'])
  })

  it('ページが未記入のものは最後にまとめる', () => {
    const sorted = sortThreadsByPage([
      thread('なし1', null, '2026-08-01T00:00:00Z'),
      thread('p20', 20, '2026-08-02T00:00:00Z'),
      thread('なし2', null, '2026-08-03T00:00:00Z'),
    ])
    expect(sorted.map((t) => t.root.id)).toEqual(['p20', 'なし1', 'なし2'])
  })

  it('同じページの中は投稿の古い順', () => {
    const sorted = sortThreadsByPage([
      thread('新しい', 10, '2026-08-05T00:00:00Z'),
      thread('古い', 10, '2026-08-01T00:00:00Z'),
    ])
    expect(sorted.map((t) => t.root.id)).toEqual(['古い', '新しい'])
  })

  it('始点が無ければ終点で並べる', () => {
    const sorted = sortThreadsByPage([
      thread('終点60', null, '2026-08-01T00:00:00Z', [], 60),
      thread('始点20', 20, '2026-08-02T00:00:00Z'),
    ])
    expect(sorted.map((t) => t.root.id)).toEqual(['始点20', '終点60'])
  })

  it('返信は親から離れない（束のまま動く）', () => {
    const reply = log('返信', '2026-08-09T00:00:00Z', 'p40')
    const sorted = sortThreadsByPage([
      thread('p40', 40, '2026-08-01T00:00:00Z', [reply]),
      thread('p10', 10, '2026-08-02T00:00:00Z'),
    ])
    expect(sorted.map((t) => t.root.id)).toEqual(['p10', 'p40'])
    expect(sorted[1].replies.map((r) => r.id)).toEqual(['返信'])
  })
})
