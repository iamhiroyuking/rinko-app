import {
  UNIT_STATUS_LABEL,
  UNIT_STATUSES,
  type Unit,
  type UnitStatus,
} from '../repository/units'
import { formatUnitPageRange } from '../lib/pageRange'

type Props = {
  unit: Unit
  canEdit: boolean
  open: boolean
  onToggle: () => void
  statusBusy: boolean
  statusError: string | null
  onChangeStatus: (status: UnitStatus) => void
  pageFromInput: string
  pageToInput: string
  startNoteInput: string
  onPageFromChange: (value: string) => void
  onPageToChange: (value: string) => void
  onStartNoteChange: (value: string) => void
  pagesError: string | null
  pagesBusy: boolean
  onSavePages: (event: React.FormEvent) => void
}

/**
 * 回の状態の1行と、開いたときの操作（進み具合・進んだページ）。
 *
 * 隠すのは操作であって情報ではない。閉じていても状態とページは読める。
 * 欠席した人が進み具合を追えることは #38 / #40 で入れた目的そのものなので、
 * そこは壊さない。
 */
export default function UnitStatePanel({
  unit,
  canEdit,
  open,
  onToggle,
  statusBusy,
  statusError,
  onChangeStatus,
  pageFromInput,
  pageToInput,
  startNoteInput,
  onPageFromChange,
  onPageToChange,
  onStartNoteChange,
  pagesError,
  pagesBusy,
  onSavePages,
}: Props) {
  const pageRangeText = formatUnitPageRange(unit.pageFrom, unit.pageTo)

  const stateSummary = (
    <>
      <span className={`pill status-${unit.status}`}>
        {UNIT_STATUS_LABEL[unit.status]}
      </span>
      {pageRangeText && <span className="unit-pages">{pageRangeText}</span>}
      {unit.startNote && <span>{unit.startNote}</span>}
      {!pageRangeText && !unit.startNote && (
        <span className="unit-state-empty">進んだページは未記入</span>
      )}
    </>
  )

  return (
    <div className="unit-state">
      {canEdit ? (
        <button
          type="button"
          className="unit-state-summary"
          aria-expanded={open}
          onClick={onToggle}
        >
          {stateSummary}
          <span className="unit-state-toggle">{open ? '閉じる' : '変更'}</span>
        </button>
      ) : (
        <p className="unit-state-summary">{stateSummary}</p>
      )}

      {open && canEdit && (
        <div className="unit-state-detail">
          <div className="status-choice">
            {UNIT_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={
                  unit.status === status
                    ? 'status-button selected'
                    : 'status-button'
                }
                aria-pressed={unit.status === status}
                onClick={() => onChangeStatus(status)}
                disabled={statusBusy}
              >
                {UNIT_STATUS_LABEL[status]}
              </button>
            ))}
          </div>
          {statusError && <p className="screen-error">{statusError}</p>}

          <form className="form" onSubmit={onSavePages}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="pageFromInput">進んだページ・開始</label>
                <input
                  id="pageFromInput"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="〜から"
                  value={pageFromInput}
                  onChange={(e) => onPageFromChange(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="pageToInput">終了</label>
                <input
                  id="pageToInput"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="〜まで"
                  value={pageToInput}
                  onChange={(e) => onPageToChange(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="startNoteInput">開始箇所のメモ</label>
              <input
                id="startNoteInput"
                value={startNoteInput}
                onChange={(e) => onStartNoteChange(e.target.value)}
                placeholder="例: p.27の章末2.3から"
              />
            </div>

            {pagesError && <p className="screen-error">{pagesError}</p>}

            <button
              type="submit"
              className="secondary-button"
              disabled={pagesBusy}
            >
              {pagesBusy ? '保存中…' : 'ページを保存する'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
