import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { joinBookWithToken } from '../repository/invites'
import { errorMessage } from '../lib/errorMessage'

type State = { status: 'joining' } | { status: 'error'; message: string }

/**
 * 招待リンク（/join/<token>）を開いたときの画面。
 *
 * 開いた時点で参加処理を行い、済んだらその教材へ送る。
 * ここに来るのはログイン済みの人だけ（関門の内側にある）。
 * 未ログインの人はログイン画面に送られ、ログイン後にここへ戻ってくる。
 */
export default function JoinBookView() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: 'joining' })

  useEffect(() => {
    if (!token) return
    let cancelled = false

    joinBookWithToken(token)
      .then((bookId) => {
        if (!cancelled) navigate(`/books/${bookId}`, { replace: true })
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setState({ status: 'error', message: errorMessage(caught) })
      })

    return () => {
      cancelled = true
    }
  }, [token, navigate])

  return (
    <ScreenFrame
      title="教材に参加"
      description="招待リンクを確認しています。"
      backTo="/"
    >
      {state.status === 'joining' && (
        <p className="screen-param">参加しています…</p>
      )}

      {state.status === 'error' && (
        <>
          <p className="screen-error">{state.message}</p>
          <p className="panel-note">
            リンクが古いか、間違っている可能性があります。共有した人にもう一度もらってください。
          </p>
        </>
      )}
    </ScreenFrame>
  )
}
