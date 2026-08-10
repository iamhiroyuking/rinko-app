import { Link, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'

export default function SeminarView() {
  const { bookId } = useParams()

  return (
    <ScreenFrame
      title="回のリスト"
      description="回を第N回の順に並べる。ソート切り替え、検索への入口、回の作成・編集・削除。"
    >
      <p className="screen-param">bookId: {bookId}</p>
      <nav className="screen-nav">
        <Link to={`/books/${bookId}/units/new`}>回を作成</Link>
        <Link to={`/books/${bookId}/units/demo`}>回を開く</Link>
        <Link to={`/books/${bookId}/search`}>検索</Link>
      </nav>
    </ScreenFrame>
  )
}
