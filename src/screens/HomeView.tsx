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

  const userId = session?.user.id

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
      description={`${SHELF_STATUS_LABEL[shelfStatus]}の教材が並びます。`}
      headerAction={
        <button type="button" className="quiet-button" onClick={handleSignOut}>
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
