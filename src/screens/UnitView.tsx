import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import LogCard from '../components/LogCard'
import { listBookMembers, type BookMember } from '../repository/members'
import {
  getUnit,
  updateUnitPageRange,
  UNIT_STATUS_LABEL,
  type Unit,
} from '../repository/units'
import {
  buildThreads,
  createLog,
  listLogs,
  type LogEntry,
} from '../repository/logs'
import { errorMessage } from '../lib/errorMessage'
import {
  formatUnitPageRange,
  toPageNumber,
  validatePageRange,
} from '../lib/pageRange'

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ok'
      unit: Unit | null
      members: BookMember[]
      logs: LogEntry[]
    }
  | { status: 'error'; message: string }

/** 読み込み前に使い回す空配列。その場で作ると useMemo が毎描画でやり直しになる */
const NO_LOGS: LogEntry[] = []

export default function UnitView() {
  const { bookId, unitId } = useParams()
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [editingPages, setEditingPages] = useState(false)
  const [pageFromInput, setPageFromInput] = useState('')
  const [pageToInput, setPageToInput] = useState('')
  const [pagesBusy, setPagesBusy] = useState(false)
  const [pagesError, setPagesError] = useState<string | null>(null)

  /** 返信フォームを開いているログのid。null なら閉じている */
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

  /** 検索結果から飛んできたときに指定される、目当てのログ */
  const focusLogId = searchParams.get('log')

  useEffect(() => {
    if (!bookId || !unitId) return
    let cancelled = false
    setState({ status: 'loading' })

    const load = async () => {
      const [unit, members, logs] = await Promise.all([
        getUnit(unitId),
        listBookMembers(bookId),
        listLogs(unitId),
      ])
      return { unit, members, logs }
    }

    load()
      .then((result) => {
        if (!cancelled) setState({ status: 'ok', ...result })
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setState({ status: 'error', message: errorMessage(caught) })
      })

    return () => {
      cancelled = true
    }
  }, [bookId, unitId])

  // 目当てのログまで運ぶ。描画が終わってからでないと要素が無いので、
  // ログの取得が済んだあとに実行する
  useEffect(() => {
    if (state.status !== 'ok' || !focusLogId) return
    const element = document.getElementById(`log-${focusLogId}`)
    if (!element) return
    element.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [state.status, focusLogId])

  const unit = state.status === 'ok' ? state.unit : null
  const members = state.status === 'ok' ? state.members : []
  const logs = state.status === 'ok' ? state.logs : NO_LOGS

  const threads = useMemo(() => buildThreads(logs), [logs])

  const nameOf = (userId: string | null) => {
    if (!userId) return '未割当'
    return members.find((m) => m.userId === userId)?.displayName ?? '不明'
  }

  function startEditingPages() {
    if (!unit) return
    setPageFromInput(unit.pageFrom !== null ? String(unit.pageFrom) : '')
    setPageToInput(unit.pageTo !== null ? String(unit.pageTo) : '')
    setPagesError(null)
    setEditingPages(true)
  }

  async function savePages(event: React.FormEvent) {
    event.preventDefault()
    if (!unit) return

    const from = toPageNumber(pageFromInput)
    const to = toPageNumber(pageToInput)
    const validationError = validatePageRange(from, to)
    if (validationError) {
      setPagesError(validationError)
      return
    }

    setPagesError(null)
    setPagesBusy(true)
    try {
      await updateUnitPageRange(unit.id, from, to)
      setState((prev) =>
        prev.status === 'ok' && prev.unit
          ? { ...prev, unit: { ...prev.unit, pageFrom: from, pageTo: to } }
          : prev,
      )
      setEditingPages(false)
    } catch (caught: unknown) {
      setPagesError(errorMessage(caught))
    } finally {
      setPagesBusy(false)
    }
  }

  function openReply(logId: string) {
    setReplyingTo(logId)
    setReplyBody('')
    setReplyError(null)
  }

  async function submitReply(event: React.FormEvent, parentLogId: string) {
    event.preventDefault()
    if (!unitId) return

    const body = replyBody.trim()
    if (body === '') return

    setReplyError(null)
    setReplyBusy(true)
    try {
      // 返信は本文だけ。種別・ページ・タグは会話の返しには要らないので
      // フォームを増やさず、必要なら通常の投稿を使ってもらう
      await createLog({ unitId, type: 'none', body, parentLogId })
      const refreshed = await listLogs(unitId)
      setState((prev) =>
        prev.status === 'ok' ? { ...prev, logs: refreshed } : prev,
      )
      setReplyingTo(null)
      setReplyBody('')
    } catch (caught: unknown) {
      setReplyError(errorMessage(caught))
    } finally {
      setReplyBusy(false)
    }
  }

  return (
    <ScreenFrame
      title={unit ? `第${unit.order}回　${unit.title}` : '回ごとの記録'}
      description="新しい記録が上に並びます。返信は記録の下に古い順で並びます。"
      backTo={`/books/${bookId}/units`}
      primaryAction={
        unit
          ? {
              label: '🗨 発言する',
              to: `/books/${bookId}/units/${unitId}/logs/new`,
            }
          : undefined
      }
    >
      {state.status === 'loading' && (
        <p className="screen-param">読み込み中…</p>
      )}

      {state.status === 'error' && (
        <p className="screen-error">{state.message}</p>
      )}

      {state.status === 'ok' && !unit && (
        <p className="empty-state">この回は見つかりませんでした。</p>
      )}

      {unit && state.status === 'ok' && (
        <>
          {unit.objective && (
            <div className="objective-card">
              <span className="objective-label">この回で学ぶこと</span>
              {unit.objective}
            </div>
          )}

          <p className="screen-param">
            担当: {nameOf(unit.presenterId)} ・{' '}
            {unit.scheduledDate ?? '日程未定'} ・{' '}
            {UNIT_STATUS_LABEL[unit.status]}
          </p>

          <section className="panel">
            <h2 className="panel-title">進んだページ</h2>
            {editingPages ? (
              <form className="form" onSubmit={savePages}>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="pageFromInput">開始</label>
                    <input
                      id="pageFromInput"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="〜から"
                      value={pageFromInput}
                      onChange={(e) => setPageFromInput(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="pageToInput">終了</label>
                    <input
                      id="pageToInput"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="〜まで"
                      value={pageToInput}
                      onChange={(e) => setPageToInput(e.target.value)}
                    />
                  </div>
                </div>

                {pagesError && <p className="screen-error">{pagesError}</p>}

                <div className="button-row">
                  <button
                    type="button"
                    className="quiet-button"
                    onClick={() => setEditingPages(false)}
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="secondary-button"
                    disabled={pagesBusy}
                  >
                    {pagesBusy ? '保存中…' : '保存する'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="panel-note">
                  {formatUnitPageRange(unit.pageFrom, unit.pageTo) ??
                    'まだ記録がありません。'}
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={startEditingPages}
                >
                  編集する
                </button>
              </>
            )}
          </section>

          {threads.length === 0 ? (
            <p className="empty-state">
              まだ記録がありません。「発言する」から残してください。
            </p>
          ) : (
            <ul className="log-list">
              {threads.map((thread) => (
                <li key={thread.root.id}>
                  <LogCard
                    log={thread.root}
                    authorName={nameOf(thread.root.authorId)}
                    isFocused={thread.root.id === focusLogId}
                    footer={
                      replyingTo === thread.root.id ? (
                        <form
                          className="reply-form"
                          onSubmit={(e) => submitReply(e, thread.root.id)}
                        >
                          <label
                            className="reply-label"
                            htmlFor={`reply-${thread.root.id}`}
                          >
                            返信
                          </label>
                          <textarea
                            id={`reply-${thread.root.id}`}
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            rows={3}
                            required
                            autoFocus
                          />
                          {replyError && (
                            <p className="screen-error">{replyError}</p>
                          )}
                          <div className="button-row">
                            <button
                              type="button"
                              className="quiet-button"
                              onClick={() => setReplyingTo(null)}
                            >
                              キャンセル
                            </button>
                            <button
                              type="submit"
                              className="secondary-button"
                              disabled={replyBusy}
                            >
                              {replyBusy ? '送信中…' : '返信する'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="quiet-button reply-open-button"
                          onClick={() => openReply(thread.root.id)}
                        >
                          返信する
                        </button>
                      )
                    }
                  />

                  {thread.replies.length > 0 && (
                    <ul className="reply-list">
                      {thread.replies.map((reply) => (
                        <li key={reply.id}>
                          <LogCard
                            log={reply}
                            authorName={nameOf(reply.authorId)}
                            isFocused={reply.id === focusLogId}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </ScreenFrame>
  )
}
