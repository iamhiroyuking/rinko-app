import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import LogCard from '../components/LogCard'
import { useSession } from '../auth/SessionContext'
import { listBookMembers, type BookMember } from '../repository/members'
import {
  getUnit,
  updateUnitPages,
  updateUnitStatus,
  UNIT_STATUS_LABEL,
  UNIT_STATUSES,
  type Unit,
  type UnitStatus,
} from '../repository/units'
import {
  buildThreads,
  createLog,
  deleteLog,
  listLogs,
  type LogEntry,
} from '../repository/logs'
import { signAttachments } from '../repository/attachments'
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
  const { session } = useSession()
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [editingPages, setEditingPages] = useState(false)
  const [pageFromInput, setPageFromInput] = useState('')
  const [pageToInput, setPageToInput] = useState('')
  const [startNoteInput, setStartNoteInput] = useState('')
  const [pagesBusy, setPagesBusy] = useState(false)
  const [pagesError, setPagesError] = useState<string | null>(null)

  /** 返信フォームを開いているログのid。null なら閉じている */
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

  const [statusBusy, setStatusBusy] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [deletingLogId, setDeletingLogId] = useState<string | null>(null)
  const [logError, setLogError] = useState<string | null>(null)

  /**
   * 返信を閉じているスレッドの、親のログのid。
   *
   * 「閉じている方」を覚えるので、初期状態（空）はすべて開いた状態になる。
   * 開いている方を覚えると、新しく読み込んだスレッドが閉じて出てしまう。
   * 個人の見え方なのでデータベースには保存しない。
   */
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(
    () => new Set(),
  )

  /** 添付のパス → 期限付きURL。非公開バケットなので表示のたびに要る */
  const [attachmentUrls, setAttachmentUrls] = useState<
    Map<string, string | null>
  >(() => new Map())

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

  // 添付のURLはログの取得とは別に作る。期限付きなので保存できず、
  // ログを読み直すたびに発行し直す必要がある
  useEffect(() => {
    const files = logs.flatMap((log) => log.attachments)
    if (files.length === 0) return

    let cancelled = false
    signAttachments(files)
      .then((signed) => {
        if (cancelled) return
        setAttachmentUrls(new Map(signed.map((s) => [s.storagePath, s.url])))
      })
      .catch(() => {
        // 画像が出ないだけで、記録そのものは読める。画面は止めない
      })

    return () => {
      cancelled = true
    }
  }, [logs])

  const pageRangeText = unit
    ? formatUnitPageRange(unit.pageFrom, unit.pageTo)
    : null

  const nameOf = (userId: string | null) => {
    if (!userId) return '未割当'
    return members.find((m) => m.userId === userId)?.displayName ?? '不明'
  }

  function startEditingPages() {
    if (!unit) return
    setPageFromInput(unit.pageFrom !== null ? String(unit.pageFrom) : '')
    setPageToInput(unit.pageTo !== null ? String(unit.pageTo) : '')
    setStartNoteInput(unit.startNote ?? '')
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

    const startNote = startNoteInput.trim() || null

    setPagesError(null)
    setPagesBusy(true)
    try {
      await updateUnitPages(unit.id, { pageFrom: from, pageTo: to, startNote })
      setState((prev) =>
        prev.status === 'ok' && prev.unit
          ? {
              ...prev,
              unit: { ...prev.unit, pageFrom: from, pageTo: to, startNote },
            }
          : prev,
      )
      setEditingPages(false)
    } catch (caught: unknown) {
      setPagesError(errorMessage(caught))
    } finally {
      setPagesBusy(false)
    }
  }

  async function changeStatus(status: UnitStatus) {
    if (!unit) return
    setStatusError(null)
    setStatusBusy(true)
    try {
      await updateUnitStatus(unit.id, status)
      setState((prev) =>
        prev.status === 'ok' && prev.unit
          ? { ...prev, unit: { ...prev.unit, status } }
          : prev,
      )
    } catch (caught: unknown) {
      setStatusError(errorMessage(caught))
    } finally {
      setStatusBusy(false)
    }
  }

  async function handleDeleteLog(log: LogEntry, replyCount: number) {
    const confirmed = window.confirm(
      replyCount > 0
        ? `この記録を削除しますか？\n返信${replyCount}件も一緒に消えます。元に戻せません。`
        : 'この記録を削除しますか？\n元に戻せません。',
    )
    if (!confirmed) return

    setLogError(null)
    setDeletingLogId(log.id)
    try {
      await deleteLog(log.id)
      if (!unitId) return
      const refreshed = await listLogs(unitId)
      setState((prev) =>
        prev.status === 'ok' ? { ...prev, logs: refreshed } : prev,
      )
    } catch (caught: unknown) {
      setLogError(errorMessage(caught))
    } finally {
      setDeletingLogId(null)
    }
  }

  /**
   * 自分の記録にだけ出す操作。
   *
   * 他人の記録を消せてはいけない。押せないよう隠すが、
   * データベース側も投稿者本人しか変更・削除できないようにしてある。
   */
  function ownLogActions(log: LogEntry, replyCount: number) {
    if (log.authorId !== session?.user.id) return null
    return (
      <>
        <Link
          className="log-action-link"
          to={`/books/${bookId}/units/${unitId}/logs/${log.id}/edit`}
        >
          編集
        </Link>
        <button
          type="button"
          className="quiet-button log-action-button"
          onClick={() => handleDeleteLog(log, replyCount)}
          disabled={deletingLogId === log.id}
        >
          {deletingLogId === log.id ? '削除中…' : '削除'}
        </button>
      </>
    )
  }

  function toggleThread(rootLogId: string) {
    setCollapsedThreads((prev) => {
      const next = new Set(prev)
      if (next.has(rootLogId)) next.delete(rootLogId)
      else next.add(rootLogId)
      return next
    })
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
      // 閉じているスレッドに返信すると、書いたものが見えないまま終わる。
      // 送ったら開く
      setCollapsedThreads((prev) => {
        if (!prev.has(parentLogId)) return prev
        const next = new Set(prev)
        next.delete(parentLogId)
        return next
      })
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
            <Link
              className="log-action-link"
              to={`/books/${bookId}/units/${unitId}/edit`}
            >
              この回を編集
            </Link>
          </p>

          <section className="panel">
            <h2 className="panel-title">この回の進み具合</h2>
            <div className="status-choice">
              {UNIT_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={
                    unit.status === status
                      ? 'status-button selected'
                      : 'status-button'
                  }
                  aria-pressed={unit.status === status}
                  onClick={() => changeStatus(status)}
                  disabled={statusBusy}
                >
                  {UNIT_STATUS_LABEL[status]}
                </button>
              ))}
            </div>
            <p className="panel-note">
              参加者なら誰でも変更できます。輪講中に気づいた人がその場で直せるようにしています。
            </p>
            {statusError && <p className="screen-error">{statusError}</p>}
          </section>

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

                <div className="field">
                  <label htmlFor="startNoteInput">開始箇所のメモ</label>
                  <input
                    id="startNoteInput"
                    value={startNoteInput}
                    onChange={(e) => setStartNoteInput(e.target.value)}
                    placeholder="例: p.27の章末2.3から"
                  />
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
                {pageRangeText === null && unit.startNote === null ? (
                  <p className="panel-note">まだ記録がありません。</p>
                ) : (
                  <>
                    {pageRangeText && (
                      <p className="panel-note">{pageRangeText}</p>
                    )}
                    {unit.startNote && (
                      <p className="panel-note">開始箇所: {unit.startNote}</p>
                    )}
                  </>
                )}
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

          {logError && <p className="screen-error">{logError}</p>}

          {threads.length === 0 ? (
            <p className="empty-state">
              まだ記録がありません。「発言する」から残してください。
            </p>
          ) : (
            <ul className="log-list">
              {threads.map((thread) => {
                // 目当てのログが返信なら、閉じていても開いて描画する。
                // 閉じたままだと要素が無く、検索結果からそのログへ飛べない
                const hasFocusedReply = thread.replies.some(
                  (reply) => reply.id === focusLogId,
                )
                const repliesOpen =
                  !collapsedThreads.has(thread.root.id) || hasFocusedReply

                return (
                  <li key={thread.root.id}>
                    <LogCard
                      log={thread.root}
                      authorName={nameOf(thread.root.authorId)}
                      isFocused={thread.root.id === focusLogId}
                      attachmentUrls={attachmentUrls}
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
                          <div className="log-actions">
                            <button
                              type="button"
                              className="quiet-button log-action-button"
                              onClick={() => openReply(thread.root.id)}
                            >
                              返信する
                            </button>
                            {ownLogActions(thread.root, thread.replies.length)}
                          </div>
                        )
                      }
                    />

                    {thread.replies.length > 0 && (
                      <>
                        <button
                          type="button"
                          className="quiet-button reply-toggle-button"
                          aria-expanded={repliesOpen}
                          aria-controls={`replies-${thread.root.id}`}
                          onClick={() => toggleThread(thread.root.id)}
                        >
                          {repliesOpen
                            ? `返信${thread.replies.length}件を隠す`
                            : `返信${thread.replies.length}件を表示`}
                        </button>

                        {repliesOpen && (
                          <ul
                            className="reply-list"
                            id={`replies-${thread.root.id}`}
                          >
                            {thread.replies.map((reply) => (
                              <li key={reply.id}>
                                <LogCard
                                  log={reply}
                                  authorName={nameOf(reply.authorId)}
                                  isFocused={reply.id === focusLogId}
                                  attachmentUrls={attachmentUrls}
                                  footer={
                                    <div className="log-actions">
                                      {ownLogActions(reply, 0)}
                                    </div>
                                  }
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </ScreenFrame>
  )
}
