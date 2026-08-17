import { Link } from 'react-router-dom'
import { IconBookOpen, IconBookmark, IconUsers } from '../components/icons'

/**
 * 未ログインの人に見せる紹介ページ（#114）。
 *
 * **このアプリで唯一、ログインせずに中身が読める場所。**
 * 検索エンジンがたどり着けるのもここだけなので、何のアプリかは
 * ここで言い切る。
 *
 * 逆に言えば、**教材や記録に属する情報を1文字もここへ出さないこと。**
 * 未ログインでは何も見えないという前提が崩れる。
 */
export default function LandingView() {
  return (
    <div className="screen">
      <header className="app-header">
        <div className="app-header-inner">
          <span className="app-name">輪講</span>
          <div className="app-header-action">
            <Link className="log-action-link" to="/login">
              ログイン
            </Link>
          </div>
        </div>
      </header>

      <main className="screen-body">
        <div className="screen-heading">
          <h1>輪講の記録を、みんなで残す</h1>
          <p className="screen-description">
            研究室やゼミの輪講で「どこまで進んだか」「何が分からなかったか」を
            その場で残して、あとから探せるようにするアプリです。
          </p>
        </div>

        <Link className="primary-link" to="/login">
          はじめる
        </Link>

        <div className="panel-grid">
          <section className="panel">
            <h2 className="panel-title">
              <IconBookOpen /> 進み具合が分かる
            </h2>
            <p className="panel-note">
              教材ごとに回を並べ、担当者・輪講日・進んだページを持たせます。
              欠席しても、どこまで進んだかを後から追えます。
            </p>
          </section>

          <section className="panel">
            <h2 className="panel-title">
              <IconBookmark /> その場で書いて、あとで探す
            </h2>
            <p className="panel-note">
              輪講中に浮かんだ疑問をそのまま残せます。返信でスレッドになり、
              ページ順やハッシュタグで読み返せます。
            </p>
          </section>

          <section className="panel">
            <h2 className="panel-title">
              <IconUsers /> 招待リンクで共有
            </h2>
            <p className="panel-note">
              リンクを渡すだけで参加してもらえます。書き込める人と
              見るだけの人を分けられ、リンクは後から失効できます。
            </p>
          </section>
        </div>

        <div className="objective-card">
          <span className="objective-label">公開範囲</span>
          ログインしないと中身は一切見えません。教材は招待リンクを渡した相手にだけ
          共有され、しおりや本棚の並びは自分にしか見えません。
        </div>

        <div className="foot-note">
          個人開発（
          <a
            href="https://github.com/iamhiroyuking/rinko-app"
            target="_blank"
            rel="noreferrer"
          >
            ソースコードと開発の記録
          </a>
          ）
        </div>
      </main>
    </div>
  )
}
