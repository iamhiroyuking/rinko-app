import { useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'

export default function SearchView() {
  const { bookId } = useParams()

  return (
    <ScreenFrame
      title="検索"
      description="頻出ハッシュタグ上位10件のチップと検索バー。結果から該当ログへジャンプする。"
    >
      <p className="screen-param">bookId: {bookId}</p>
    </ScreenFrame>
  )
}
