import { useSession } from '../auth/SessionContext'
import HomeView from './HomeView'
import LandingView from './LandingView'

/**
 * `/` の中身を、ログインしているかどうかで振り分ける。
 *
 * ログイン済みなら本棚、未ログインなら紹介ページ（#114）。
 * 紹介ページを `/about` に置いても良かったが、**人が貼るのも検索が拾うのも
 * `/` なので、そこに中身が無いと意味が薄い。**
 *
 * ここは `RequireLogin` の外側にある数少ない画面なので、
 * **`LandingView` に教材や記録の情報を出さないこと。**
 * `HomeView` 側はこれまで通り、セッションがあるときしか描画されない。
 */
export default function RootView() {
  const { session, loading } = useSession()

  // 保存されたログイン状態を確認している最中。ここで紹介ページを出すと、
  // ログイン済みの人に一瞬それが見えてしまう（RequireLogin と同じ理由）
  if (loading) {
    return (
      <main className="screen">
        <p className="screen-param">確認中…</p>
      </main>
    )
  }

  return session ? <HomeView /> : <LandingView />
}
