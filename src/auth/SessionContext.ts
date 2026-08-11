import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type SessionState = {
  /** ログインしていなければ null */
  session: Session | null
  /** 最初の確認が終わるまで true。この間は画面を出さずに待つ */
  loading: boolean
}

export const SessionContext = createContext<SessionState>({
  session: null,
  loading: true,
})

export function useSession(): SessionState {
  return useContext(SessionContext)
}
