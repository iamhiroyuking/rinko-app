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
          <h1>輪講、どこまで進んだか思い出せますか</h1>
          <p className="screen-description">
            研究室やゼミの輪講のための記録アプリです。
            進み具合と、その場で出た疑問を残します。
          </p>
        </div>

        <Link className="primary-link" to="/login">
          はじめる
        </Link>

        {/*
          課題を先に置く。機能から書くと「何ができるか」は伝わるが、
          「自分の話だ」と思ってもらえない。読む人は輪講をやっている
          当事者なので、まず心当たりのある場面を出す。
        */}
        <section className="lp-section">
          <h2 className="lp-heading">こういうこと、ありませんか</h2>
          <ul className="lp-problems">
            <li>先週どこまで進んだか、誰も正確に覚えていない</li>
            <li>その場で出た良い質問が、口頭で流れて消えてしまう</li>
            <li>欠席すると、何をやったのか分からないまま次に進む</li>
            <li>「あれ、どの回で出た話だっけ」が探せない</li>
          </ul>
        </section>

        <section className="lp-section">
          <h2 className="lp-heading">このアプリがすること</h2>
          <div className="panel-grid">
            <section className="panel">
              <h3 className="panel-title">
                <IconBookOpen /> 進み具合が残る
              </h3>
              <p className="panel-note">
                回ごとに担当者・日付・進んだページを持たせます。
                欠席しても、どこまで進んだかを後から追えます。
              </p>
            </section>

            <section className="panel">
              <h3 className="panel-title">
                <IconBookmark /> 疑問がその場で残る
              </h3>
              <p className="panel-note">
                画面を移らずに書けます。返信でスレッドになるので、
                その場で答えが出なくても後から続きを話せます。
              </p>
            </section>

            <section className="panel">
              <h3 className="panel-title">
                <IconUsers /> あとから探せる
              </h3>
              <p className="panel-note">
                ページ順に並べ替えたり、ハッシュタグや本文から探して、
                その記録まで飛べます。
              </p>
            </section>
          </div>
        </section>

        <div className="objective-card">
          <span className="objective-label">共有と公開範囲</span>
          招待リンクを渡すだけで参加してもらえます。書き込める人と見るだけの人を
          分けられ、リンクは後から失効できます。ログインしないと中身は一切見えず、
          しおりや本棚の並びは自分にしか見えません。
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
