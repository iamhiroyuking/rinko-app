import { useNavigate, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import LogComposer from '../components/LogComposer'

/**
 * 発言の投稿と編集。URLに直接来たとき（ブックマーク・リロード）のための
 * フルページ版。
 *
 * `UnitView` からの通常の操作はモーダル（`LogComposer` を直接開く）に
 * なっているので、ここを通るのは直接URLを叩いたときだけになった
 * （実際に使っていて「編集するときに別の画面に遷移するのが大変」という
 * 指摘があり、モーダル化した）。フォームの中身は共通の `LogComposer`。
 */
export default function AddLogView() {
  const { bookId, unitId, logId } = useParams()
  const navigate = useNavigate()

  if (!bookId || !unitId) return null

  const backTo = `/books/${bookId}/units/${unitId}`

  return (
    <ScreenFrame
      title={logId ? '発言を編集' : '発言を追加'}
      description={
        logId
          ? '書いた内容を直せます。'
          : '輪講中に気づいたこと、予習で理解したこと、疑問などを残します。'
      }
      backTo={backTo}
    >
      <LogComposer
        bookId={bookId}
        unitId={unitId}
        logId={logId}
        onSaved={(savedLogId) => navigate(`${backTo}?log=${savedLogId}`)}
        onClose={() => navigate(backTo)}
        showHeader={false}
      />
    </ScreenFrame>
  )
}
