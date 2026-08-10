import { Link, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'

export default function AddLogView() {
  const { bookId, unitId } = useParams()

  return (
    <ScreenFrame
      title="発言を追加"
      description="種別・タイトル・本文・ページ数・ハッシュタグ・添付を入力して投稿する。"
    >
      <nav className="screen-nav">
        <Link to={`/books/${bookId}/units/${unitId}`}>
          投稿したことにして回へ戻る
        </Link>
      </nav>
    </ScreenFrame>
  )
}
