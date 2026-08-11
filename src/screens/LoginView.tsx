import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { signIn, signUp } from '../repository/auth'

type Mode = 'login' | 'signup'

export default function LoginView() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        await signUp(email, password, displayName.trim())
      } else {
        await signIn(email, password)
      }
      navigate('/')
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenFrame
      title={mode === 'login' ? 'ログイン' : 'アカウントを作る'}
      description="未ログインでは他の画面を開けません。"
    >
      <div className="tabs">
        <button
          type="button"
          className={mode === 'login' ? 'tab selected' : 'tab'}
          onClick={() => setMode('login')}
        >
          ログイン
        </button>
        <button
          type="button"
          className={mode === 'signup' ? 'tab selected' : 'tab'}
          onClick={() => setMode('signup')}
        >
          新規登録
        </button>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <div className="field">
            <label htmlFor="displayName">表示名</label>
            <input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="ログの投稿者として表示されます"
              required
              autoComplete="nickname"
            />
          </div>
        )}

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

        <div className="field">
          <label htmlFor="password">パスワード</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={
              mode === 'signup' ? 'new-password' : 'current-password'
            }
          />
        </div>

        {error && <p className="screen-error">{error}</p>}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy
            ? '処理中…'
            : mode === 'signup'
              ? 'アカウントを作る'
              : 'ログイン'}
        </button>
      </form>
    </ScreenFrame>
  )
}
