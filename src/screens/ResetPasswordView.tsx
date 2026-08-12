import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { useSession } from '../auth/SessionContext'
import { updatePassword } from '../repository/auth'
import { errorMessage } from '../lib/errorMessage'

/**
 * メールのリンクから来たときの、新しいパスワードを決める画面。
 *
 * リンクを開いた時点でSupabaseのクライアントがURLの鍵を読み取り、
 * ログイン状態を作っている。だからここでは updatePassword() を呼ぶだけでよい。
 *
 * 関門（RequireLogin）の外に置いている。内側だと、鍵の読み取りが終わる前に
 * 未ログインと判断されてログイン画面へ弾き出される可能性があるため。
 */
export default function ResetPasswordView() {
  const { session, loading } = useSession()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (password !== confirmation) {
      setError('確認用のパスワードが一致しません。')
      return
    }

    setError(null)
    setBusy(true)
    try {
      await updatePassword(password)
      // パスワードを変えた時点でログイン状態になっているので、そのまま本棚へ
      navigate('/', { replace: true })
    } catch (caught: unknown) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenFrame
      title="新しいパスワードを設定"
      description="設定するとそのままログインした状態になります。"
    >
      {loading && <p className="screen-param">確認中…</p>}

      {!loading && !session && (
        <>
          <p className="screen-error">
            この画面を開くための情報が見つかりませんでした。
          </p>
          <p className="panel-note">
            リンクの有効期限が切れているか、メール本文のURLが途中で切れている可能性があります。
            もう一度メールを送り直してください。
          </p>
          <Link className="primary-link" to="/forgot-password">
            メールを送り直す
          </Link>
        </>
      )}

      {!loading && session && (
        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="password">新しいパスワード</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <div className="field">
            <label htmlFor="confirmation">確認のためもう一度</label>
            <input
              id="confirmation"
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && <p className="screen-error">{error}</p>}

          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? '設定中…' : 'パスワードを設定する'}
          </button>
        </form>
      )}
    </ScreenFrame>
  )
}
