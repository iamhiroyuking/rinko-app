import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import LogCard from '../components/LogCard'
import BodyForm from '../components/BodyForm'
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
  sortThreadsByPage,
  LOG_ORDER_LABEL,
  type LogEntry,
  type LogOrder,
} from '../repository/logs'
import { signAttachments } from '../repository/attachments'
import { addMark, listMyMarks, removeMark } from '../repository/marks'
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
  /** 状態の詳細（進み具合とページの操作）を開いているか */
  const [stateOpen, setStateOpen] = useState(false)
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

  /** 自分がしおりを付けているログのid。共有相手のものは入らない */
  const [markedLogIds, setMarkedLogIds] = useState<Set<string>>(() => new Set())

  /**
   * 記録の並べ方。
   *
   * 既定は投稿順。輪講中は「さっきの発言が上」が正しい。
   * 後から読み返すときはページ順にする。個人の見え方なので
   * データベースには保存しない。
   */
  const [logOrder, setLogOrder] = useState<LogOrder>('posted')

  /** 回の画面からその場で書く分。返信とは別に持つ（同時に開けるため） */
  const [quickBody, setQuickBody] = useState('')
  const [quickBusy, setQuickBusy] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)

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

  const postedThreads = useMemo(() => buildThreads(logs), [logs])

  const threads = useMemo(
    () =>
      logOrder === 'page' ? sortThreadsByPage(postedThreads) : postedThreads,
    [postedThreads, logOrder],
  )

  /** ページ順のとき、ここから先はページが未記入という区切りを出す */
  const firstWithoutPageId =
    logOrder === 'page'
      ? (threads.find(
          (t) => t.root.pageStart === null && t.root.pageEnd === null,
        )?.root.id ?? null)
      : null

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

  // しおりはログとは別に取る。個人のもので、ログ本体には持たせていない
  useEffect(() => {
    if (logs.length === 0) return

    let cancelled = false
    listMyMarks(logs.map((log) => log.id))
      .then((marks) => {
        if (!cancelled) setMarkedLogIds(marks)
      })
      .catch(() => {
        // しおりが出ないだけ。記録そのものは読めるので画面は止めない
      })

    return () => {
      cancelled = true
    }
  }, [logs])

  /**
   * しおりを付け外しする。
   *
   * 先に画面を変えてから送っている。押した手応えを待たせたくないため。
   * 失敗したら元に戻す。
   */
  async function toggleMark(logId: string) {
    const wasMarked = markedLogIds.has(logId)

    setMarkedLogIds((prev) => {
      const next = new Set(prev)
      if (wasMarked) next.delete(logId)
      else next.add(logId)
      return next
    })

    try {
      if (wasMarked) await removeMark(logId)
      else await addMark(logId)
    } catch (caught: unknown) {
      setMarkedLogIds((prev) => {
        const next = new Set(prev)
        if (wasMarked) next.add(logId)
        else next.delete(logId)
        return next
      })
      setLogError(errorMessage(caught))
    }
  }

  const pageRangeText = unit
    ? formatUnitPageRange(unit.pageFrom, unit.pageTo)
    : null

  /**
   * 状態の1行。閉じていてもここは読める。
   * ページも開始箇所も無いときは、まだ書かれていないことが分かる文言にする。
   */
  const stateSummary = unit ? (
    <>
      <span className={`pill status-${unit.status}`}>
        {UNIT_STATUS_LABEL[unit.status]}
      </span>
      {pageRangeText && <span className="unit-pages">{pageRangeText}</span>}
      {unit.startNote && <span>{unit.startNote}</span>}
      {!pageRangeText && !unit.startNote && (
        <span className="unit-state-empty">進んだページは未記入</span>
      )}
    </>
  ) : null

  const nameOf = (userId: string | null) => {
    if (!userId) return '未割当'
    return members.find((m) => m.userId === userId)?.displayName ?? '不明'
  }

  /**
   * 自分の権限。閲覧者には書き込みの導線を出さない。
   *
   * しおりは個人のものなので閲覧者にも残す（log_marks の追加条件は
   * 参加していることで、編集できることではない）。
   */
  const myRole = members.find((m) => m.userId === session?.user.id)?.role
  const canEdit = myRole !== 'viewer'

  /**
   * 状態の詳細を開閉する。
   *
   * 開くときに今の値を入力欄へ入れておく。開いてから改めて
   * 「編集する」を押させると、階層がもう一段増えて元の木阿弥になる。
   */
  function toggleState() {
    if (stateOpen) {
      setStateOpen(false)
      return
    }
    if (!unit) return
    setPageFromInput(unit.pageFrom !== null ? String(unit.pageFrom) : '')
    setPageToInput(unit.pageTo !== null ? String(unit.pageTo) : '')
    setStartNoteInput(unit.startNote ?? '')
    setPagesError(null)
    setStateOpen(true)
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
      setStateOpen(false)
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
    if (!canEdit) return null
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

  /**
   * 回の画面からそのまま投稿する。
   *
   * 本文だけ。種別・ページ・タグ・画像を使いたいときは AddLogView へ。
   * 画面を移らないので、読んでいた位置と流れを保ったまま書ける。
   */
  async function submitQuickPost(event: React.FormEvent) {
    event.preventDefault()
    if (!unitId) return

    const body = quickBody.trim()
    if (body === '') return

    setQuickError(null)
    setQuickBusy(true)
    try {
      await createLog({ unitId, type: 'none', body })
      const refreshed = await listLogs(unitId)
      setState((prev) =>
        prev.status === 'ok' ? { ...prev, logs: refreshed } : prev,
      )
      setQuickBody('')
    } catch (caught: unknown) {
      setQuickError(errorMessage(caught))
    } finally {
      setQuickBusy(false)
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
      backTo={`/books/${bookId}/units`}
      primaryAction={
        unit && canEdit
          ? {
              label: '🗨 発言する',
              to: `/books/${bookId}/units/${unitId}/logs/new`,
            }
          : undefined
      }
      secondaryLinks={[{ label: '記録を検索', to: `/books/${bookId}/search` }]}
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
            {unit.scheduledDate ?? '日程未定'}
            {canEdit && (
              <>
                {' '}
                ・{' '}
                <Link
                  className="log-action-link"
                  to={`/books/${bookId}/units/${unitId}/edit`}
                >
                  この回を編集
                </Link>
              </>
            )}
          </p>

          {/*
            この回の状態。進み具合と進んだページを1行にまとめている。

            どちらも滅多に変えない（輪講中に1回触るかどうか）のに、
            枠付きのパネル2つで縦を大きく取り、この画面の目的である
            「書く・読む」を画面の外へ押し出していた。

            隠すのは操作であって情報ではない。閉じていても状態とページは
            読める。欠席した人が進み具合を追えることは #38 / #40 で
            入れた目的そのものなので、そこは壊さない。
          */}
          <div className="unit-state">
            {canEdit ? (
              <button
                type="button"
                className="unit-state-summary"
                aria-expanded={stateOpen}
                onClick={toggleState}
              >
                {stateSummary}
                <span className="unit-state-toggle">
                  {stateOpen ? '閉じる' : '変更'}
                </span>
              </button>
            ) : (
              <p className="unit-state-summary">{stateSummary}</p>
            )}

            {stateOpen && canEdit && (
              <div className="unit-state-detail">
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
                {statusError && <p className="screen-error">{statusError}</p>}

                <form className="form" onSubmit={savePages}>
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="pageFromInput">進んだページ・開始</label>
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

                  <button
                    type="submit"
                    className="secondary-button"
                    disabled={pagesBusy}
                  >
                    {pagesBusy ? '保存中…' : 'ページを保存する'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* 輪講中に浮かんだことをその場で書けるようにする。
              画面を移ると読んでいた位置を失ううえ、戻る手間もかかる。
              種別・ページ・タグ・画像を使いたいときは「発言する」へ */}
          {canEdit && (
            <BodyForm
              label="いま書く"
              fieldId="quick-post"
              placeholder="疑問でも気づいたことでも"
              submitLabel="投稿する"
              busyLabel="投稿中…"
              value={quickBody}
              onChange={setQuickBody}
              onSubmit={submitQuickPost}
              busy={quickBusy}
              error={quickError}
            />
          )}

          {logError && <p className="screen-error">{logError}</p>}

          {/* 並べ方の切り替え。記録が1件でも意味があるので常に出す */}
          {threads.length > 0 && (
            <div className="status-choice log-order-choice">
              {(['posted', 'page'] as LogOrder[]).map((order) => (
                <button
                  key={order}
                  type="button"
                  className={
                    logOrder === order
                      ? 'status-button selected'
                      : 'status-button'
                  }
                  aria-pressed={logOrder === order}
                  onClick={() => setLogOrder(order)}
                >
                  {LOG_ORDER_LABEL[order]}
                </button>
              ))}
            </div>
          )}

          {threads.length === 0 ? (
            <p className="empty-state">
              {canEdit
                ? 'まだ記録がありません。上の「いま書く」から残せます。'
                : 'まだ記録がありません。'}
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
                    {thread.root.id === firstWithoutPageId && (
                      <p className="log-group-divider">
                        ここから下はページが未記入
                      </p>
                    )}
                    <LogCard
                      log={thread.root}
                      authorName={nameOf(thread.root.authorId)}
                      isFocused={thread.root.id === focusLogId}
                      attachmentUrls={attachmentUrls}
                      isMarked={markedLogIds.has(thread.root.id)}
                      onToggleMark={() => toggleMark(thread.root.id)}
                      footer={
                        replyingTo === thread.root.id ? (
                          <BodyForm
                            label="返信"
                            fieldId={`reply-${thread.root.id}`}
                            submitLabel="返信する"
                            busyLabel="送信中…"
                            value={replyBody}
                            onChange={setReplyBody}
                            onSubmit={(e) => submitReply(e, thread.root.id)}
                            busy={replyBusy}
                            error={replyError}
                            onCancel={() => setReplyingTo(null)}
                            autoFocus
                          />
                        ) : (
                          <div className="log-actions">
                            {canEdit && (
                              <button
                                type="button"
                                className="quiet-button log-action-button"
                                onClick={() => openReply(thread.root.id)}
                              >
                                返信する
                              </button>
                            )}
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
                                  isMarked={markedLogIds.has(reply.id)}
                                  onToggleMark={() => toggleMark(reply.id)}
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
