import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { useSession } from '../auth/SessionContext'
import { signOut } from '../repository/auth'
import { getMyProfile, type Profile } from '../repository/profiles'
import { listShelfBooks, type ShelfBook } from '../repository/books'
import { errorMessage } from '../lib/errorMessage'

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; books: ShelfBook[]; profile: Profile | null }
  | { status: 'error'; message: string }

export default function HomeView() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const userId = session?.user.id

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    const load = async () => {
      const books = await listShelfBooks()
      const profile = userId ? await getMyProfile(userId) : null
      return { books, profile }
    }

    load()
      .then(({ books, profile }) => {
        if (!cancelled) setState({ status: 'ok', books, profile })
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        const message = errorMessage(caught)
        setState({ status: 'error', message })
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
    <ScreenFrame title="本棚" description="学習中の教材が並びます。">
      {state.status === 'loading' && (
        <p className="screen-param">読み込み中…</p>
      )}

      {state.status === 'error' && (
        <p className="screen-error">{state.message}</p>
      )}

      {state.status === 'ok' && (
        <>
          <p className="screen-param">
            {state.profile
              ? `${state.profile.display_name} としてログイン中`
              : '⚠️ プロフィールが見つかりません（サインアップ時のトリガーが動いていない可能性があります）'}
          </p>

          {state.books.length === 0 ? (
            <p className="empty-state">
              まだ教材がありません。「教材を追加」から始めてください。
            </p>
          ) : (
            <ul className="shelf">
              {state.books.map((book) => (
                <li key={book.id}>
                  <Link className="book-card" to={`/books/${book.id}`}>
                    {book.coverImageUrl ? (
                      <img
                        className="book-cover"
                        src={book.coverImageUrl}
                        alt=""
                      />
                    ) : (
                      <span className="book-cover book-cover-blank" aria-hidden>
                        📖
                      </span>
                    )}
                    <span className="book-title">{book.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <nav className="screen-nav">
        <Link to="/books/new">教材を追加</Link>
        <Link to="/trash">ゴミ箱</Link>
        <button type="button" className="link-button" onClick={handleSignOut}>
          ログアウト
        </button>
      </nav>
    </ScreenFrame>
  )
}
