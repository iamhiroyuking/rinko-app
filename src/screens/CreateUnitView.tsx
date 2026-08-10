import { Link, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'

export default function CreateUnitView() {
  const { bookId } = useParams()

  return (
    <ScreenFrame
      title="回を作成"
      description="タイトル・この回で学ぶこと・担当者・輪講日を入力する。作成後はその回へ遷移する。"
    >
      <nav className="screen-nav">
        <Link to={`/books/${bookId}/units/demo`}>作成したことにして回へ</Link>
      </nav>
    </ScreenFrame>
  )
}
