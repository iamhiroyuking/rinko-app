import { useState } from 'react'
import { Link } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { sendPasswordReset } from '../repository/auth'
import { errorMessage } from '../lib/errorMessage'

export default function ForgotPasswordView() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await sendPasswordReset(email.trim())
      setSent(true)
    } catch (caught: unknown) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenFrame
      title="パスワードの再設定"
      description="登録したメールアドレスに、再設定用のリンクを送ります。"
      backTo="/login"
    >
      {sent ? (
        <>
          {/*
            送信できたかどうかに関わらず同じ文言を出している。
            「そのアドレスは登録されていません」と伝えると、
            誰が利用者なのかを外部から調べられてしまうため。
          */}
          <p className="panel-note">
            {email.trim()} にメールを送りました。届いたリンクを開いて、
            新しいパスワードを設定してください。
          </p>
          <p className="panel-note">
            届かない場合は、迷惑メールに入っていないか確認してください。
            それでも見つからない場合は、そのアドレスで登録されていない可能性があります。
          </p>
          <Link className="primary-link" to="/login">
            ログイン画面へ戻る
          </Link>
        </>
      ) : (
        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">メールアドレス</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {error && <p className="screen-error">{error}</p>}

          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? '送信中…' : '再設定用のメールを送る'}
          </button>
        </form>
      )}
    </ScreenFrame>
  )
}
