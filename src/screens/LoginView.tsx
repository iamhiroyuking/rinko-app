import { Link } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'

export default function LoginView() {
  return (
    <ScreenFrame
      title="ログイン"
      description="メールとパスワードでログインする。未ログインでは他の画面を開けない。"
    >
      <nav className="screen-nav">
        <Link to="/">ログインしたことにしてホームへ</Link>
      </nav>
    </ScreenFrame>
  )
}
