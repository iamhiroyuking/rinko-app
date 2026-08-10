# rinko-app

輪講（ゼミ・研究室の輪講/reading group）の運営を楽にするアプリ。

## 背景・課題

研究室の輪講で、進捗が曖昧になる／全体像が見えない／演習の実施記録が残らない／担当者の予習に見合う進度が出ない、といった課題があった。詳細は [docs/requirements.md](docs/requirements.md) を参照。

## 解決したいこと（MVP）

輪講の進度を一覧でパッと見えるようにし、各回に担当者・目的・記録を残せるようにする。ログにはページ数とハッシュタグを付けて投稿でき、後から検索して該当箇所に戻れる。詳細な機能一覧・データモデルは [docs/requirements.md](docs/requirements.md)、画面構成は [docs/screen-flow.md](docs/screen-flow.md) を参照。

## 技術スタック

| 層           | 選定         | 選んだ理由                                                                                                                      |
| ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 形態         | Webアプリ    | URLを送るだけで研究室のメンバーに試してもらえる。ネイティブアプリだとTestFlightや各OSごとの配布が必要で、試用のハードルが上がる |
| ビルドツール | Vite         | ログイン必須のツールでありSEOもSSRも不要なため、Next.jsのサーバー側の仕組みが要らない。開発サーバーの起動も速い                 |
| 言語         | TypeScript   | 型があることで実行前に誤りが分かる。フロントとバックエンドで同じ言語を使える                                                    |
| UIライブラリ | React        | 日本語の学習資料が最も多く、詰まったときに解決しやすい                                                                          |
| ルーティング | React Router | Viteと組み合わせる際の標準的な選択                                                                                              |
| スタイリング | CSS Modules  | ReactとTypeScriptを同時に学ぶ状況のため、独自の記法を増やさず既存のCSSの知識をそのまま使えるものを選んだ                        |
| バックエンド | Supabase     | 認証・共有・ファイル保存が要件そのまま揃い、サーバーのコードをほぼ書かずに複数人での共有を実現できる                            |
| ホスティング | Vercel       | GitHubへのpushで自動デプロイされる                                                                                              |
| テスト       | Vitest       | Viteと同じ設定を共有できる                                                                                                      |

## セットアップ

```bash
npm install
npm run dev
```

| コマンド         | 内容                             |
| ---------------- | -------------------------------- |
| `npm run dev`    | 開発サーバーを起動する           |
| `npm run build`  | 型チェックと本番用ビルドを行う   |
| `npm run lint`   | コードの誤りを検査する（oxlint） |
| `npm run format` | コードを整形する（Prettier）     |

### データベース（Supabase）

1. [supabase.com](https://supabase.com) でプロジェクトを作る
2. `cp .env.example .env` して、ダッシュボードの Project Settings > API から URL と anon key を書き写す
3. ローカルのリポジトリをプロジェクトに紐付けてスキーマを適用する

```bash
supabase link --project-ref <プロジェクトのref>
supabase db push
```

スキーマの変更は `supabase/migrations/` にSQLファイルとして残す。
直接ダッシュボードでテーブルをいじると履歴が残らないので行わない。

## ディレクトリ構成

```
src/
  main.tsx          アプリの起点。Reactを画面に描画する
  App.tsx           URLと画面の対応表（ルーティング）
  index.css         全画面に効く最低限のスタイル
  components/       複数の画面で使い回す部品
  screens/          画面ごとのコンポーネント（10画面）
docs/               要件定義・画面遷移図・実装計画
```

## 開発の進め方

- Issueは1機能1つの粒度（半日〜2日で終わる大きさ）
- ブランチ名は `<種類>/<内容>`（`feat/` `fix/` `docs/` `refactor/` `chore/`）
- PR本文に `Closes #N` を書いてIssueと紐付ける
- 実装計画は [docs/issues.md](docs/issues.md) を参照
