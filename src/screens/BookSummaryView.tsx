import { Link, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'

export default function BookSummaryView() {
  const { bookId } = useParams()

  return (
    <ScreenFrame
      title="教材の概要"
      description="書名・参加者・次回の担当者と日付・全体の進捗・目標・共有リンクを表示する。"
    >
      <p className="screen-param">bookId: {bookId}</p>
      <nav className="screen-nav">
        <Link to={`/books/${bookId}/units`}>
          学習を開始する（回のリストへ）
        </Link>
      </nav>
    </ScreenFrame>
  )
}
