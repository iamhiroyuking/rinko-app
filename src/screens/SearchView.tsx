import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { IconBookmark, IconImage } from '../components/icons'
import { listBookMembers, type BookMember } from '../repository/members'
import {
  filterLogs,
  listSearchableLogs,
  topTagNames,
  type SearchableLog,
} from '../repository/search'
import { LOG_TYPE_LABEL, type LogType } from '../repository/logs'
import { listMyMarksInBook } from '../repository/marks'
import { errorMessage } from '../lib/errorMessage'

/**
 * 絞り込みに出す種類。
 *
 * `none`（指定しない）は入れない。付けていない記録が最も多く、
 * それで絞っても「種類を選ばなかったもの」が並ぶだけで探した気にならない。
 */
const FILTERABLE_TYPES: LogType[] = ['preview', 'question', 'review']

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

  /**
   * 絞り込む種類。空ならすべて。
   *
   * 「指定しない」は出していない。付けていない記録が最も多く、
   * それで絞っても「種類を選ばなかったもの」が並ぶだけで探した気にならない。
   */
  const [types, setTypes] = useState<LogType[]>([])

  /** 未解決の疑問だけに絞る（#136） */
  const [unresolvedOnly, setUnresolvedOnly] = useState(false)

  function toggleType(type: LogType) {
    setTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

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

  /*
    3つの軸（キーワード・種類・しおり）はすべて filterLogs が扱う。
    キーワードが空でも、種類やしおりだけで一覧として意味がある。
    「後で振り返りたいものを並べる」のがしおりの目的で、種類も同じ。
  */
  const hits = useMemo(
    () =>
      filterLogs(logs, {
        query,
        types,
        markedLogIds: markedOnly ? markedLogIds : null,
        unresolvedOnly,
      }),
    [logs, query, types, markedOnly, markedLogIds, unresolvedOnly],
  )

  /** 何かで絞っているか。空の画面に出す文言を変えるために見る */
  const filtering =
    query.trim() !== '' || types.length > 0 || markedOnly || unresolvedOnly

  /**
   * 見つからなかったときの文言。
   *
   * 軸が3つあるので、入れ子の三項演算子で書くと読めなくなる。
   * 「何で絞ったか」を組み立てて、そこに一致しなかったことを伝える。
   */
  function emptyMessage(): string {
    const keyword = query.trim()
    const scopes: string[] = []
    if (markedOnly) scopes.push('しおりを付けた記録')
    if (unresolvedOnly) scopes.push('未解決の疑問')
    if (types.length > 0) {
      scopes.push(types.map((t) => LOG_TYPE_LABEL[t]).join('・'))
    }

    if (scopes.length === 0) {
      return `「${keyword}」に一致する記録は見つかりませんでした。`
    }

    const scope = scopes.join(' と ')
    if (keyword === '') {
      return markedOnly && types.length === 0 && !unresolvedOnly
        ? 'しおりを付けた記録はまだありません。記録の右上から付けられます。'
        : `${scope}の記録はまだありません。`
    }
    return `${scope}に「${keyword}」は見つかりませんでした。`
  }

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

      {/* しおりと種類はキーワードとは別の軸なので、入力欄と並べず下に置く。
          どれも押した分だけ絞り込む（種類は複数選べる） */}
      <div className="status-choice">
        <button
          type="button"
          className={markedOnly ? 'status-button selected' : 'status-button'}
          aria-pressed={markedOnly}
          onClick={() => setMarkedOnly((on) => !on)}
        >
          <IconBookmark filled /> しおりだけ（{markedLogIds.size}）
        </button>

        <button
          type="button"
          className={
            unresolvedOnly ? 'status-button selected' : 'status-button'
          }
          aria-pressed={unresolvedOnly}
          onClick={() => setUnresolvedOnly((on) => !on)}
        >
          未解決の疑問
        </button>

        {FILTERABLE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={
              types.includes(type) ? 'status-button selected' : 'status-button'
            }
            aria-pressed={types.includes(type)}
            onClick={() => toggleType(type)}
          >
            {LOG_TYPE_LABEL[type]}
          </button>
        ))}
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

          {!filtering ? (
            <p className="empty-state">
              キーワードを入力するか、上のハッシュタグや絞り込みを押してください。
            </p>
          ) : hits.length === 0 ? (
            <p className="empty-state">{emptyMessage()}</p>
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
                            ・ <IconImage /> 画像
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
