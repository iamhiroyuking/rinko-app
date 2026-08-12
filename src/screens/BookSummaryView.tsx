import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import {
  getBook,
  getMyShelfEntry,
  trashBook,
  updateShelfStatus,
  SHELF_STATUS_LABEL,
  SHELF_STATUSES,
  type Book,
  type MyShelfEntry,
  type ShelfStatus,
} from '../repository/books'
import { listBookMembers, type BookMember } from '../repository/members'
import { countBookLogs } from '../repository/logs'
import { findNextUnit, listUnits, type Unit } from '../repository/units'
import {
  getInviteToken,
  inviteUrlOf,
  issueInviteToken,
} from '../repository/invites'
import { errorMessage } from '../lib/errorMessage'
import { formatUnitPageRange } from '../lib/pageRange'

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ok'
      book: Book | null
      members: BookMember[]
      token: string | null
      shelfEntry: MyShelfEntry | null
      logCount: number
      unitCount: number
      nextUnit: Unit | null
    }
  | { status: 'error'; message: string }

/** 学習開始日の表示。時刻までは要らないので日付だけにする */
function formatJoinedAt(joinedAt: string): string {
  return new Date(joinedAt).toLocaleDateString('ja-JP')
}

export default function BookSummaryView() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [issuing, setIssuing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [shelfBusy, setShelfBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    setState({ status: 'loading' })

    const load = async () => {
      const [book, members, token, shelfEntry, logCount, units] =
        await Promise.all([
          getBook(bookId),
          listBookMembers(bookId),
          getInviteToken(bookId),
          getMyShelfEntry(bookId),
          countBookLogs(bookId),
          listUnits(bookId),
        ])
      return {
        book,
        members,
        token,
        shelfEntry,
        logCount,
        unitCount: units.length,
        nextUnit: findNextUnit(units),
      }
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
  }, [bookId])

  const book = state.status === 'ok' ? state.book : null
  const members = state.status === 'ok' ? state.members : []
  const token = state.status === 'ok' ? state.token : null
  const shelfEntry = state.status === 'ok' ? state.shelfEntry : null
  const nextUnit = state.status === 'ok' ? state.nextUnit : null

  const memberNameOf = (userId: string | null) => {
    if (!userId) return '担当者未定'
    return members.find((m) => m.userId === userId)?.displayName ?? '不明'
  }

  async function handleShelfStatusChange(shelfStatus: ShelfStatus) {
    if (!bookId) return
    setActionError(null)
    setShelfBusy(true)
    try {
      await updateShelfStatus(bookId, shelfStatus)
      setState((prev) =>
        prev.status === 'ok' && prev.shelfEntry
          ? { ...prev, shelfEntry: { ...prev.shelfEntry, shelfStatus } }
          : prev,
      )
    } catch (caught: unknown) {
      setActionError(errorMessage(caught))
    } finally {
      setShelfBusy(false)
    }
  }

  async function handleIssue() {
    if (!bookId || state.status !== 'ok') return
    setActionError(null)
    setIssuing(true)
    try {
      const issued = await issueInviteToken(bookId)
      setState({ ...state, token: issued })
    } catch (caught: unknown) {
      setActionError(errorMessage(caught))
    } finally {
      setIssuing(false)
    }
  }

  async function handleDelete() {
    if (!bookId || !book) return
    const confirmed = window.confirm(
      `「${book.title}」を本棚から消しますか？\n共有している相手には残ります。ゴミ箱から復元できます。`,
    )
    if (!confirmed) return

    setActionError(null)
    setDeleting(true)
    try {
      await trashBook(bookId)
      navigate('/')
    } catch (caught: unknown) {
      setActionError(errorMessage(caught))
      setDeleting(false)
    }
  }

  async function handleCopy() {
    if (!token) return
    try {
      await navigator.clipboard.writeText(inviteUrlOf(token))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // クリップボードが使えない環境ではURLを選んで手で写してもらう
      setActionError('コピーできませんでした。URLを選択して写してください。')
    }
  }

  return (
    <ScreenFrame
      title={book?.title ?? '教材の概要'}
      description="次にやる回と、この教材でのこれまで。"
      backTo="/"
      primaryAction={
        book
          ? { label: '学習を開始する', to: `/books/${bookId}/units` }
          : undefined
      }
    >
      {state.status === 'loading' && (
        <p className="screen-param">読み込み中…</p>
      )}

      {state.status === 'error' && (
        <p className="screen-error">{state.message}</p>
      )}

      {state.status === 'ok' && !book && (
        <p className="empty-state">この教材は見つかりませんでした。</p>
      )}

      {book && (
        <>
          {book.goal && (
            <div className="objective-card">
              <span className="objective-label">全体を通しての目標</span>
              {book.goal}
            </div>
          )}

          <section className="panel">
            <h2 className="panel-title">次にやる回</h2>
            {nextUnit ? (
              <>
                <p className="next-unit-title">
                  第{nextUnit.order}回　{nextUnit.title}
                </p>
                <p className="panel-note">
                  {memberNameOf(nextUnit.presenterId)} ・{' '}
                  {nextUnit.scheduledDate ?? '日程未定'}
                </p>
                {formatUnitPageRange(nextUnit.pageFrom, nextUnit.pageTo) && (
                  <p className="panel-note">
                    <span className="unit-pages">
                      {formatUnitPageRange(nextUnit.pageFrom, nextUnit.pageTo)}
                    </span>
                  </p>
                )}
                {nextUnit.startNote && (
                  <p className="panel-note">開始箇所: {nextUnit.startNote}</p>
                )}
              </>
            ) : (
              <p className="panel-note">
                {state.status === 'ok' && state.unitCount === 0
                  ? 'まだ回がありません。「学習を開始する」から追加してください。'
                  : 'すべての回が完了しています。'}
              </p>
            )}
          </section>

          <section className="panel">
            <h2 className="panel-title">この教材の状況</h2>
            <div className="field">
              <label htmlFor="shelfStatus">本棚でのステータス</label>
              <select
                id="shelfStatus"
                value={shelfEntry?.shelfStatus ?? 'reading'}
                onChange={(e) => handleShelfStatusChange(e.target.value)}
                disabled={shelfBusy || !shelfEntry}
              >
                {SHELF_STATUSES.map((shelfStatus) => (
                  <option key={shelfStatus} value={shelfStatus}>
                    {SHELF_STATUS_LABEL[shelfStatus]}
                  </option>
                ))}
              </select>
            </div>
            <p className="panel-note">
              自分の本棚での並べ方です。変えても共有している相手の本棚は変わりません。
              本棚には「学習中」の教材が並びます。
            </p>
            <dl className="stat-list">
              <div className="stat">
                <dt>学習開始日</dt>
                <dd>
                  {shelfEntry ? formatJoinedAt(shelfEntry.joinedAt) : '—'}
                </dd>
              </div>
              <div className="stat">
                <dt>記録の数</dt>
                <dd>{state.status === 'ok' ? `${state.logCount}件` : '—'}</dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <h2 className="panel-title">参加者（{members.length}人）</h2>
            <ul className="member-list">
              {members.map((member) => (
                <li key={member.userId}>{member.displayName}</li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2 className="panel-title">共有</h2>
            {token ? (
              <>
                <p className="panel-note">
                  このリンクを渡すと、相手も同じ教材に書き込めるようになります。
                </p>
                <code className="invite-url">{inviteUrlOf(token)}</code>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCopy}
                >
                  {copied ? 'コピーしました' : 'リンクをコピー'}
                </button>
              </>
            ) : (
              <>
                <p className="panel-note">
                  まだ共有していません。リンクを発行すると、渡した相手が参加できます。
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleIssue}
                  disabled={issuing}
                >
                  {issuing ? '発行中…' : '共有リンクを発行'}
                </button>
              </>
            )}
          </section>

          <section className="panel">
            <h2 className="panel-title">この教材を消す</h2>
            <p className="panel-note">
              自分の本棚から消えます。共有している相手には残ります。ゴミ箱から復元できます。
            </p>
            <button
              type="button"
              className="danger-button"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '処理中…' : '本棚から消す'}
            </button>
          </section>

          {actionError && <p className="screen-error">{actionError}</p>}
        </>
      )}
    </ScreenFrame>
  )
}
