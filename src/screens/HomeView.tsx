import { Link } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'

export default function HomeView() {
  return (
    <ScreenFrame
      title="ホーム"
      description="学習中の教材を本棚として並べる。フィルタで学習予定・学習済みに切り替える。"
    >
      <nav className="screen-nav">
        <Link to="/books/new">教材を追加</Link>
        <Link to="/books/demo">教材を開く（概要へ）</Link>
        <Link to="/trash">ゴミ箱</Link>
        <Link to="/login">ログイン画面</Link>
      </nav>
    </ScreenFrame>
  )
}
