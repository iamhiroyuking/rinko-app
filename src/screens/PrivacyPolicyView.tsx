import { Link } from 'react-router-dom'

/**
 * プライバシーポリシー。
 *
 * **`LandingView` と同じく、関門の外にある。** App Storeの審査や、
 * 使い始める前に確認したい人がログインせずに読める必要があるため。
 * こちらも教材や記録の中身は一切出さない。
 *
 * 実際にこのアプリが行っていることだけを書く。書いていないことを
 * やらない、というのがこのページの正しさの担保になる。
 */
export default function PrivacyPolicyView() {
  return (
    <div className="screen">
      <header className="app-header">
        <div className="app-header-inner">
          <Link className="back-link" to="/">
            <span aria-hidden>‹</span> 戻る
          </Link>
        </div>
      </header>

      <main className="screen-body">
        <div className="screen-heading">
          <h1>プライバシーポリシー</h1>
        </div>

        <section className="panel">
          <h2 className="panel-title">取得する情報</h2>
          <p>このアプリは、次の情報を取得します。</p>
          <ul>
            <li>メールアドレス（ログインの本人確認のためだけに使います）</li>
            <li>
              表示名・投稿した記録・添付した画像・教材の情報（アプリの中身そのものです）
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2 className="panel-title">情報の使いみち</h2>
          <p>
            取得した情報は、このアプリの機能を提供するためだけに使います。広告や分析のために使うことはなく、第三者に販売・提供することもありません。
          </p>
        </section>

        <section className="panel">
          <h2 className="panel-title">データの保存場所</h2>
          <p>
            データはSupabase社のサーバーに保存しています。データベースへのアクセスは、ログインした本人と、本人が招待した相手だけに制限しています（行レベルセキュリティ）。
          </p>
        </section>

        <section className="panel">
          <h2 className="panel-title">アカウントの削除</h2>
          <p>
            設定画面からいつでもアカウントを削除できます。削除すると、あなたが投稿した記録は「退会したユーザー」という表示に変わりますが、記録の中身自体は共有相手の画面に残ります（返信でスレッドになっている記録が、あなたの退会によって欠けてしまわないようにするためです）。メールアドレスなど、あなた個人を指す情報は削除されます。
          </p>
        </section>

        <section className="panel">
          <h2 className="panel-title">トラッキング・広告</h2>
          <p>
            広告SDKや、他のアプリ・Webサイトをまたいで利用者を追跡する仕組みは使っていません。
          </p>
        </section>

        <section className="panel">
          <h2 className="panel-title">お問い合わせ</h2>
          <p>
            このアプリについてのお問い合わせは、
            <a
              href="https://github.com/iamhiroyuking/rinko-app/issues"
              target="_blank"
              rel="noreferrer"
            >
              GitHubのIssue
            </a>
            からお願いします。
          </p>
        </section>

        <p className="panel-note">最終更新日: 2026年9月3日</p>
      </main>
    </div>
  )
}
