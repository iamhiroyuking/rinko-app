import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { IconBookOpen, IconUsers } from '../components/icons'
import { useSession } from '../auth/SessionContext'
import { signOut } from '../repository/auth'
import { getMyProfile, type Profile } from '../repository/profiles'
import {
  countShelfBooks,
  listShelfBooks,
  SHELF_STATUS_LABEL,
  SHELF_STATUSES,
  type ShelfBook,
  type ShelfStatus,
} from '../repository/books'
import { signPaths } from '../repository/attachments'
import { errorMessage } from '../lib/errorMessage'
import {
  countNewLogs,
  listUpcoming,
  type UpcomingUnit,
} from '../repository/activity'

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; books: ShelfBook[] }
  | { status: 'error'; message: string }

/** 教材が1冊も無いときの案内。選んでいるステータスによって言うことが違う */
const EMPTY_MESSAGE: Record<ShelfStatus, string> = {
  planned: 'これから読む教材はまだありません。',
  reading: 'まだ教材がありません。下の「教材を追加」から始めてください。',
  finished: '読み終えた教材はまだありません。',
}

/** 本棚の主役。ここを開くのがほとんどなので、既定にして操作を挟まない */
const MAIN_SHELF: ShelfStatus = 'reading'

/** 主役以外。控えめな導線から見に行く */
const OTHER_SHELVES = SHELF_STATUSES.filter((status) => status !== MAIN_SHELF)

function isShelfStatus(value: string | null): value is ShelfStatus {
  return SHELF_STATUSES.some((status) => status === value)
}

export default function HomeView() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  /** undefined は「まだ取得していない」。null と分けないと、読み込み中に
   *  「プロフィールが見つかりません」が一瞬出てしまう */
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [searchParams] = useSearchParams()

  /**
   * 見ている本棚。URLに持たせているので、戻るボタンで戻れる。
   * 知らない値が来たら主役に倒す。
   */
  const shelfParam = searchParams.get('shelf')
  const shelfStatus: ShelfStatus = isShelfStatus(shelfParam)
    ? shelfParam
    : MAIN_SHELF

  /** 主役以外の冊数。押す前に0冊だと分かるようにする */
  const [otherCounts, setOtherCounts] = useState<Map<ShelfStatus, number>>(
    () => new Map(),
  )
  /** 表紙のパス → 期限付きURL。非公開バケットなので表示のたびに要る */
  const [coverUrls, setCoverUrls] = useState<Map<string, string | null>>(
    () => new Map(),
  )

  /** 教材id → 前回見てから増えた記録の数（#134）。自分の書き込みは含まない */
  const [newCounts, setNewCounts] = useState<Map<string, number>>(
    () => new Map(),
  )

  /** 教材をまたいだ「次にやること」（#135）。主役の本棚にいるときだけ出す */
  const [upcoming, setUpcoming] = useState<UpcomingUnit[]>([])

  const userId = session?.user.id

  useEffect(() => {
    if (shelfStatus !== MAIN_SHELF) return
    let cancelled = false

    listUpcoming()
      .then((items) => {
        if (!cancelled) setUpcoming(items)
      })
      .catch(() => {
        // 予定が出ないだけ。本棚は読める
      })

    return () => {
      cancelled = true
    }
  }, [userId, shelfStatus])

  // 新着は本棚とは別に取る。数が出なくても本棚は読めるので画面は止めない
  useEffect(() => {
    let cancelled = false

    countNewLogs()
      .then((counts) => {
        if (!cancelled) setNewCounts(counts)
      })
      .catch(() => {
        // 新着の数が出ないだけ。教材は開ける
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    listShelfBooks(shelfStatus)
      .then((books) => {
        if (!cancelled) setState({ status: 'ok', books })
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setState({ status: 'error', message: errorMessage(caught) })
      })

    return () => {
      cancelled = true
    }
  }, [userId, shelfStatus])

  // 表紙のURLは期限付きなので保存できず、読み直すたびに発行する
  useEffect(() => {
    if (state.status !== 'ok') return

    const paths = state.books.flatMap((book) =>
      book.coverStoragePath ? [book.coverStoragePath] : [],
    )
    if (paths.length === 0) return

    let cancelled = false
    signPaths(paths)
      .then((urls) => {
        if (!cancelled) setCoverUrls(urls)
      })
      .catch(() => {
        // 表紙が出ないだけ。本棚そのものは見せる
      })

    return () => {
      cancelled = true
    }
  }, [state])

  // 冊数は控えめな導線に添えるだけなので、教材の取得とは分けている
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    Promise.all(
      OTHER_SHELVES.map(
        async (status) => [status, await countShelfBooks(status)] as const,
      ),
    )
      .then((entries) => {
        if (!cancelled) setOtherCounts(new Map(entries))
      })
      .catch(() => {
        // 冊数が出ないだけ。導線そのものは出す
      })

    return () => {
      cancelled = true
    }
  }, [userId, shelfStatus])

  // プロフィールは切り替えても変わらないので、教材の取得とは分けている。
  // 一緒にすると、タブを押すたびに同じ問い合わせを繰り返すことになる
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    getMyProfile(userId)
      .then((loaded) => {
        if (!cancelled) setProfile(loaded)
      })
      .catch(() => {
        // 表示名は画面の下の一行だけなので、取れなくても本棚は見せる
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <ScreenFrame
      title="本棚"
      width="wide"
      /*
        説明は画面の中身に合わせる。「次にやること」を上に出したので、
        「教材が並びます」だけだと直後に来るものと噛み合わない。
      */
      description={
        upcoming.length > 0 && shelfStatus === MAIN_SHELF
          ? '次にやることと、学習中の教材。'
          : `${SHELF_STATUS_LABEL[shelfStatus]}の教材が並びます。`
      }
      // ヘッダーの操作。押させたいものではないので控えめのまま
      headerAction={
        <button
          type="button"
          className="quiet-button subtle"
          onClick={handleSignOut}
        >
          ログアウト
        </button>
      }
      primaryAction={{ label: '＋ 教材を追加', to: '/books/new' }}
      secondaryLinks={[
        // 主役の本棚にいるときだけ、他の棚への入り口を出す。
        // 控えめにはするが辿れなくはしない（#41 で「学習完了にすると
        // 本棚から消えて戻れない」を実際に踏んでいる）
        ...(shelfStatus === MAIN_SHELF
          ? OTHER_SHELVES.map((status) => ({
              label: `${SHELF_STATUS_LABEL[status]}の教材（${otherCounts.get(status) ?? 0}）`,
              to: `/?shelf=${status}`,
            }))
          : [
              {
                label: `${SHELF_STATUS_LABEL[MAIN_SHELF]}の教材に戻る`,
                to: '/',
              },
            ]),
        { label: 'ゴミ箱', to: '/trash' },
      ]}
      footNote={
        profile ? `${profile.display_name} としてログイン中` : undefined
      }
    >
      {state.status === 'loading' && (
        <p className="screen-param">読み込み中…</p>
      )}

      {state.status === 'error' && (
        <p className="screen-error">{state.message}</p>
      )}

      {profile === null && (
        <p className="screen-error">
          プロフィールが見つかりません（サインアップ時のトリガーが動いていない可能性があります）
        </p>
      )}

      {/*
        次にやること（#135）。本棚の上に足すのであって、置き換えない。
        予定が無いときは何も出さない（空の枠を置くと毎回目に入る）。
      */}
      {upcoming.length > 0 && shelfStatus === MAIN_SHELF && (
        <section className="upcoming">
          <h2 className="lp-heading">次にやること</h2>
          <ul className="upcoming-list">
            {upcoming.map((item) => (
              <li key={item.unitId}>
                <Link
                  className="upcoming-row"
                  to={`/books/${item.bookId}/units/${item.unitId}`}
                >
                  <span className="upcoming-main">
                    <span className="upcoming-book">{item.bookTitle}</span>
                    <span className="upcoming-title">
                      第{item.order}回　{item.title}
                    </span>
                    <span className="upcoming-meta">
                      {item.scheduledDate ?? '日程未定'}
                      {item.presenterName && <> ・ {item.presenterName}</>}
                      {/* 担当は準備が要る側。ただし書名の行に割り込ませると
                          長い書名が押し出されるので、日付と同じ行に置く */}
                      {item.isMine && (
                        <>
                          {' '}
                          <span className="new-badge">あなたの担当</span>
                        </>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.status === 'ok' && (
        <>
          {state.books.length === 0 ? (
            <p className="empty-state">{EMPTY_MESSAGE[shelfStatus]}</p>
          ) : (
            <ul className="shelf">
              {state.books.map((book) => {
                // 上げた表紙が優先。無ければURLの表紙、それも無ければ絵文字
                const coverSrc = book.coverStoragePath
                  ? (coverUrls.get(book.coverStoragePath) ?? null)
                  : book.coverImageUrl

                return (
                  <li key={book.id}>
                    <Link className="book-card" to={`/books/${book.id}`}>
                      {coverSrc ? (
                        <img className="book-cover" src={coverSrc} alt="" />
                      ) : (
                        <span className="book-cover book-cover-blank">
                          <IconBookOpen />
                        </span>
                      )}
                      <span className="book-title">{book.title}</span>
                      {book.memberCount > 1 && (
                        <span className="book-shared">
                          <IconUsers /> {book.memberCount}人で共有
                        </span>
                      )}
                      {/* 開く理由を作るのはここ。0のときは何も出さない */}
                      {(newCounts.get(book.id) ?? 0) > 0 && (
                        <span className="new-badge">
                          新着 {newCounts.get(book.id)}件
                        </span>
                      )}
                    </Link>
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
