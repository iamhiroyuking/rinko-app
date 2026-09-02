import { useState } from 'react'
import ScreenFrame from '../components/ScreenFrame'
import { deleteMyAccount, signOut } from '../repository/auth'
import { errorMessage } from '../lib/errorMessage'

/**
 * 設定。ログアウトとアカウント削除だけを持つ、いちばん小さい画面。
 *
 * **アカウント削除の導線はApp Storeの必須要件（iOS版・5.1.1(v)）。**
 * Web版にも同じ理由で置いてある。アカウントを跨いで同じデータベースを
 * 使っているので、Web版から削除してもiOS版から削除しても結果は同じ。
 *
 * ログアウト・削除のどちらも `onAuthStateChange` の通知で
 * `SessionProvider` が自動的に拾い、`RequireLogin` がログイン画面へ
 * 送り返す。ここで明示的に遷移させる必要はない。
 */
export default function SettingsView() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignOut() {
    setError(null)
    setBusy(true)
    try {
      await signOut()
    } catch (caught: unknown) {
      setError(errorMessage(caught))
      setBusy(false)
    }
  }

  async function handleDelete() {
    // 教材・回の削除と同じ、素の window.confirm。
    // 取り消せない操作なので二段階にしている
    const step1 = window.confirm(
      '本当にアカウントを削除しますか？\n投稿した記録は残り、投稿者は「退会したユーザー」と表示されます。共有相手の会話が壊れないようにするためです。',
    )
    if (!step1) return

    const step2 = window.confirm('これが最後の確認です。取り消せません。削除しますか？')
    if (!step2) return

    setError(null)
    setBusy(true)
    try {
      await deleteMyAccount()
    } catch (caught: unknown) {
      setError(errorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <ScreenFrame title="設定" backTo="/">
      <section className="panel">
        <button
          type="button"
          className="secondary-button"
          onClick={handleSignOut}
          disabled={busy}
        >
          ログアウト
        </button>
      </section>

      <section className="panel">
        <h2 className="panel-title">アカウントを削除する</h2>
        <p className="panel-note">
          投稿した記録は残り、投稿者は「退会したユーザー」と表示されます。共有相手の会話が壊れないようにするためです。取り消せません。
        </p>
        <button
          type="button"
          className="quiet-button danger"
          onClick={handleDelete}
          disabled={busy}
        >
          {busy ? '削除しています…' : 'アカウントを削除する'}
        </button>
      </section>

      {error && <p className="screen-error">{error}</p>}
    </ScreenFrame>
  )
}
