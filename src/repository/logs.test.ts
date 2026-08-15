import { describe, expect, it } from 'vitest'
import { buildThreads, formatPageRange, type LogEntry } from './logs'

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
