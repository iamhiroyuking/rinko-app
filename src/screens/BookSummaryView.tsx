import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { getBook, type Book } from '../repository/books'
import { listBookMembers, type BookMember } from '../repository/members'
import {
  getInviteToken,
  inviteUrlOf,
  issueInviteToken,
} from '../repository/invites'
import { errorMessage } from '../lib/errorMessage'

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ok'
      book: Book | null
      members: BookMember[]
      token: string | null
    }
  | { status: 'error'; message: string }

export default function BookSummaryView() {
  const { bookId } = useParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [issuing, setIssuing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    setState({ status: 'loading' })

    const load = async () => {
      const [book, members, token] = await Promise.all([
        getBook(bookId),
        listBookMembers(bookId),
        getInviteToken(bookId),
      ])
      return { book, members, token }
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
      description="参加者と共有リンク。次回の担当者と全体の進捗は今後ここに表示します。"
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
            {actionError && <p className="screen-error">{actionError}</p>}
          </section>
        </>
      )}
    </ScreenFrame>
  )
}
