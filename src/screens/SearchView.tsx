import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { listBookMembers, type BookMember } from '../repository/members'
import {
  filterLogs,
  listSearchableLogs,
  topTagNames,
  type MatchedIn,
  type SearchableLog,
} from '../repository/search'
import { listMyMarksInBook } from '../repository/marks'
import { errorMessage } from '../lib/errorMessage'

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; logs: SearchableLog[]; members: BookMember[] }
  | { status: 'error'; message: string }

/**
 * 読み込み前に使う空の配列。
 *
 * その場で `[]` と書くと毎回別の配列になり、useMemo が毎描画で
 * やり直しになって意味がなくなる。使い回すためにここで作っておく。
 */
const NO_LOGS: SearchableLog[] = []
const NO_MEMBERS: BookMember[] = []

/** 一致した部分を目立たせる。長い本文は一致箇所の周りだけ切り出す */
function Excerpt({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase()
  const at = text.toLowerCase().indexOf(needle)

  if (needle === '' || at === -1) {
    return <>{text.slice(0, 120)}</>
  }

  const around = 40
  const from = Math.max(0, at - around)
  const to = Math.min(text.length, at + needle.length + around)

  return (
    <>
      {from > 0 && '…'}
      {text.slice(from, at)}
      <mark>{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length, to)}
      {to < text.length && '…'}
    </>
  )
}

export default function SearchView() {
  const { bookId } = useParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  /** 自分がしおりを付けているログのid。共有相手のものは入らない */
  const [markedLogIds, setMarkedLogIds] = useState<Set<string>>(() => new Set())
  const [markedOnly, setMarkedOnly] = useState(false)

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    setState({ status: 'loading' })

    const load = async () => {
      const [logs, members] = await Promise.all([
        listSearchableLogs(bookId),
        listBookMembers(bookId),
      ])
      return { logs, members }
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

  // しおりは個人のものなので、記録の取得とは分けている
  useEffect(() => {
    if (!bookId) return
    let cancelled = false

    listMyMarksInBook(bookId)
      .then((marks) => {
        if (!cancelled) setMarkedLogIds(marks)
      })
      .catch(() => {
        // 絞り込みが使えないだけ。検索そのものは動く
      })

    return () => {
      cancelled = true
    }
  }, [bookId])

  const logs = state.status === 'ok' ? state.logs : NO_LOGS
  const members = state.status === 'ok' ? state.members : NO_MEMBERS

  const tags = useMemo(() => topTagNames(logs), [logs])
  const allHits = useMemo(() => filterLogs(logs, query), [logs, query])

  /**
   * しおりだけに絞る。キーワードとは別の軸なので、検索の結果に後からかける。
   *
   * キーワードが空でも、しおりだけなら一覧として意味がある。
   * 「後で振り返りたいものを並べる」のがしおりの目的なので、
   * 言葉を思い出せなくても開けるようにしておく。
   */
  const hits = useMemo(() => {
    if (!markedOnly) return allHits
    if (query.trim() !== '') {
      return allHits.filter((hit) => markedLogIds.has(hit.logId))
    }
    return logs
      .filter((log) => markedLogIds.has(log.logId))
      .map((log) => ({ ...log, matchedIn: [] as MatchedIn[] }))
      .sort(
        (a, b) =>
          a.unitOrder - b.unitOrder || a.createdAt.localeCompare(b.createdAt),
      )
  }, [allHits, logs, markedOnly, markedLogIds, query])

  const nameOf = (userId: string) =>
    members.find((m) => m.userId === userId)?.displayName ?? '不明'

  return (
    <ScreenFrame
      title="記録を検索"
      description="タイトル・本文・ハッシュタグから探します。返信も対象です。"
      backTo={`/books/${bookId}/units`}
    >
      <div className="field">
        <label htmlFor="query">キーワード</label>
        <input
          id="query"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例: 正則化"
          autoComplete="off"
        />
      </div>

      {/* しおりはキーワードとは別の軸なので、入力欄と並べず下に置く */}
      <div className="status-choice">
        <button
          type="button"
          className={markedOnly ? 'status-button selected' : 'status-button'}
          aria-pressed={markedOnly}
          onClick={() => setMarkedOnly((on) => !on)}
        >
          <span aria-hidden>🔖</span> しおりだけ（{markedLogIds.size}）
        </button>
      </div>

      {state.status === 'loading' && (
        <p className="screen-param">読み込み中…</p>
      )}

      {state.status === 'error' && (
        <p className="screen-error">{state.message}</p>
      )}

      {state.status === 'ok' && (
        <>
          {tags.length > 0 && (
            <section className="panel">
              <h2 className="panel-title">よく使うハッシュタグ</h2>
              <div className="tag-row tag-row-flush">
                {tags.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="tag-button"
                    onClick={() => setQuery(name)}
                  >
                    #{name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {query.trim() === '' && !markedOnly ? (
            <p className="empty-state">
              キーワードを入力するか、上のハッシュタグを押してください。
            </p>
          ) : hits.length === 0 ? (
            <p className="empty-state">
              {markedOnly && query.trim() === ''
                ? 'しおりを付けた記録はまだありません。記録の右上から付けられます。'
                : markedOnly
                  ? `しおりを付けた記録に「${query.trim()}」は見つかりませんでした。`
                  : `「${query.trim()}」に一致する記録は見つかりませんでした。`}
            </p>
          ) : (
            <>
              <p className="screen-param">{hits.length}件</p>
              <ul className="log-list">
                {hits.map((hit) => (
                  <li key={hit.logId}>
                    <Link
                      className="result-row"
                      to={`/books/${bookId}/units/${hit.unitId}?log=${hit.logId}`}
                    >
                      <span className="result-context">
                        第{hit.unitOrder}回 {hit.unitTitle} ・{' '}
                        {nameOf(hit.authorId)}
                        {/* 本文だけでは画像の有無が分からない。数だけ添える */}
                        {hit.attachmentCount > 0 && (
                          <>
                            {' '}
                            ・ <span aria-hidden>🖼</span> 画像
                            {hit.attachmentCount}枚
                          </>
                        )}
                      </span>
                      {hit.title && (
                        <span className="log-title">
                          <Excerpt text={hit.title} query={query} />
                        </span>
                      )}
                      <span className="log-body">
                        <Excerpt text={hit.body} query={query} />
                      </span>
                      {hit.tagNames.length > 0 && (
                        <span className="tag-row">
                          {hit.tagNames.map((name) => (
                            <span key={name} className="tag-chip">
                              #{name}
                            </span>
                          ))}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </ScreenFrame>
  )
}
