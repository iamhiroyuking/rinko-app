import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSession, onAuthStateChange } from '../repository/auth'
import { SessionContext, type SessionState } from './SessionContext'

/**
 * ログイン状態をアプリ全体に配る。
 *
 * 最初に一度だけ保存済みのログイン状態を確認し、そのあとは
 * ログイン・ログアウトのたびに Supabase から通知を受けて更新する。
 * これがあるので、再読み込みしてもログインが保たれる。
 */
export default function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    session: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    getSession()
      .then((session) => {
        if (!cancelled) setState({ session, loading: false })
      })
      .catch(() => {
        if (!cancelled) setState({ session: null, loading: false })
      })

    const unsubscribe = onAuthStateChange((session: Session | null) => {
      if (!cancelled) setState({ session, loading: false })
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return (
    <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
  )
}
