import { Link, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'

export default function UnitView() {
  const { bookId, unitId } = useParams()

  return (
    <ScreenFrame
      title="回ごとの記録"
      description="ログをスレッド表示する。投稿・返信・マーク・ステータス変更。"
    >
      <p className="screen-param">
        bookId: {bookId} / unitId: {unitId}
      </p>
      <nav className="screen-nav">
        <Link to={`/books/${bookId}/units/${unitId}/logs/new`}>発言する</Link>
        <Link to={`/books/${bookId}/units`}>回のリストへ戻る</Link>
      </nav>
    </ScreenFrame>
  )
}
