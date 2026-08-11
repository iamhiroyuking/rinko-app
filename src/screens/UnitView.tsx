import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { listBookMembers, type BookMember } from '../repository/members'
import { getUnit, UNIT_STATUS_LABEL, type Unit } from '../repository/units'
import { errorMessage } from '../lib/errorMessage'

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; unit: Unit | null; members: BookMember[] }
  | { status: 'error'; message: string }

export default function UnitView() {
  const { bookId, unitId } = useParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (!bookId || !unitId) return
    let cancelled = false
    setState({ status: 'loading' })

    const load = async () => {
      const [unit, members] = await Promise.all([
        getUnit(unitId),
        listBookMembers(bookId),
      ])
      return { unit, members }
    }

    load()
      .then((result) => {
        if (!cancelled) setState({ status: 'ok', ...result })
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setState({ status: 'error', message: errorMessage(caught) })
      })

    return () => {
      cancelled = true
    }
  }, [bookId, unitId])

  const unit = state.status === 'ok' ? state.unit : null
  const presenterName =
    state.status === 'ok' && unit?.presenterId
      ? (state.members.find((m) => m.userId === unit.presenterId)
          ?.displayName ?? '不明')
      : '未割当'

  return (
    <ScreenFrame
      title={unit ? `第${unit.order}回　${unit.title}` : '回ごとの記録'}
      description="この回に残された記録が並びます。"
    >
      {state.status === 'loading' && (
        <p className="screen-param">読み込み中…</p>
      )}

      {state.status === 'error' && (
        <p className="screen-error">{state.message}</p>
      )}

      {state.status === 'ok' && !unit && (
        <p className="empty-state">この回は見つかりませんでした。</p>
      )}

      {unit && (
        <>
          {unit.objective && (
            <div className="objective-card">
              <span className="objective-label">この回で学ぶこと</span>
              {unit.objective}
            </div>
          )}

          <p className="screen-param">
            担当: {presenterName} ・ {unit.scheduledDate ?? '日程未定'} ・{' '}
            {UNIT_STATUS_LABEL[unit.status]}
          </p>
        </>
      )}

      <nav className="screen-nav">
        <Link to={`/books/${bookId}/units`}>回のリストへ戻る</Link>
      </nav>
    </ScreenFrame>
  )
}
