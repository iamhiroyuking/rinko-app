import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from './SessionContext'

/**
 * ログインしていない人を追い返す関門。
 *
 * これを通る経路にある画面は、未ログインでは一切表示されない。
 * 研究内容が書き込まれうるので、この画面より内側を見せてはいけない。
 *
 * 追い返すときは行こうとしていた場所を持たせておき、
 * ログイン後にそこへ戻せるようにする。
 */
export default function RequireLogin() {
  const { session, loading } = useSession()
  const location = useLocation()

  // 保存されたログイン状態を確認している最中。
  // ここで画面を出すと、ログイン済みでも一瞬ログイン画面が見えてしまう
  if (loading) {
    return (
      <main className="screen">
        <p className="screen-param">確認中…</p>
      </main>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}
