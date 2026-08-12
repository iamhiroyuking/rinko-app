# rinko-app 開発コンテキスト

このプロジェクトについて、新しいセッションが最初に把握しておくべき情報。

## プロジェクト概要
研究室の輪講（reading group）運営を楽にするアプリ。夏休み中の個人開発プロジェクト（Proj_成果物開発、期限2026-09-30）の一環で、GitHub・ポートフォリオとして公開する成果物を残すことが主目的（収益化は副次目標）。

- リポジトリ: https://github.com/iamhiroyuking/rinko-app （private）
- ローカル: `~/Developer/rinko-app`
- 開発者: 1人（友人を巻き込む可能性はあるが現時点では単独開発）
- 夏休み中に解像度を上げたいテーマ: 言語選定ロジック、UI/UX設計、チーム開発の一般的な流れ
- 将来的に読書記録・授業ノートへ拡張する構想があるため、主エンティティ名は「輪講」ではなく `Book`（教材）

## ターゲット
- 研究室で輪講を実施している人
- 教科書・参考書を使って輪講形式で学習しているグループ

## 現状の課題（なぜ作るか）
1. 輪講がどこまで進んだか曖昧
2. 進度の目安・目標が立っていない → **部分的にのみ対応**（目標ペース機能は廃止）
3. 学んでいることの全体像が掴めていない
4. 学ぶことの目的意識が薄い
5. 問題演習が多く、全員が理解できているか分からない → **未対応**（対応方針が未決）
6. 新しい概念が次々出てきて復習が追いつかない
7. 担当者の予習量に見合う進度が得られていない

## 確定した仕様（詳細は docs/requirements.md、画面は docs/screen-flow.md）

**アカウント**: 本格的なログイン（メール＋パスワード / Googleログイン）。複数端末から使うため軽量な識別では成立しない。未ログインでは中身が一切見えない

**共有**: 招待リンクを発行して参加してもらう。リンク生成時に `editor` / `viewer` を選ぶ。リンクは無期限

**ログ**: v1で見送った `Exercise` を `Log` として正式採用。種別・ページ数・本文・ハッシュタグ・添付を持ち、返信でスレッドになる。ハッシュタグはサジェストを出す（表記揺れで検索が壊れるのを防ぐため）

**削除**: ログは確認ダイアログ→完全削除（返信も連鎖）。Book / Unit はゴミ箱経由。Bookの削除は「自分の本棚から消す」操作で、作成者かどうかの区別はなく他のメンバーには残る。削除した人のログは残り、再参加すれば同一ユーザーとして繋がる

**廃止したもの**: 目標ペースと実進捗の差分、メンバーごとの復習回数、StartView、回の手動ドラッグ並べ替え、一括登録

## データモデル
```
User:       id, email, display_name
Book:       id, title, cover_image_url, goal, created_by
Membership: id, book_id, user_id, role(editor|viewer),
            shelf_status(planned|reading|finished), display_order, deleted_at
InviteLink: id, book_id, token, role, created_by
Unit:       id, book_id, order, title, objective, presenter_id, scheduled_date,
            status(not_started|in_progress|done), created_by, deleted_at
Log:        id, unit_id, author_id, parent_log_id, type(none|preview|question|review),
            title, body, page_start, page_end
LogMark:    log_id, user_id   ← 個人のしおり
Tag:        id, book_id, name
LogTag:     log_id, tag_id
Attachment: id, log_id, file_url, file_name, mime_type
```

`Membership.shelf_status` は本棚の整理用でユーザーが手動変更する。`Unit.status` は進捗計算用。目的が違うので名前を分けている。

**個人の状態と共有の状態を必ず区別する。** 「その人の画面がどう見えるか」に属する情報を `Book` や `Unit` に置くと、誰かの操作が共有相手全員に波及する。本棚のステータス・並び順・削除はすべて `Membership` 側にある。

## 画面（11枚）
LoginView / HomeView / AddBookView / **JoinBookView** / BookSummaryView /
SeminarView / CreateUnitView / UnitView / AddLogView / SearchView / TrashView

`JoinBookView`（`/join/<token>`）は招待リンクの行き先。設計段階の10画面には無かったが、
リンクを押して参加できる形にするために追加した。

`docs/prototype/screen-flow-demo.html` はv1時点の9画面で作ったクリッカブルデモ。ログイン・ゴミ箱・返信などv2の変更は未反映。

## ドキュメントの役割分担
| ファイル | 内容 |
|---|---|
| `docs/requirements.md` | なぜ作るか、課題、MVP範囲、データモデル、各種ポリシー |
| `docs/features.md` | **画面ごとの機能一覧。** 個人の状態(👤)と共有の状態(👥)を明示している |
| `docs/screen-flow.md` | 11画面と遷移、画面ごとの仕様 |
| `docs/issues.md` | 実装計画（29件のIssueと依存関係） |
| `docs/open-questions.md` | 未決事項と、決着した論点の記録 |

## 進行状況・次のステップ

**M1（コア）完了。8/20の目標「輪講で実際に使える」に到達した。**
教材を作り、回を作り、タグ付きで記録を残し、検索して戻れる。共有リンクで他の人も書き込める。

- [x] 要件定義 v2・画面遷移図 v2・データモデル・機能一覧
- [x] 技術スタック確定（Vite + React + TS / Supabase / Vercel）
- [x] 開発環境の構築と画面のルーティング（#1）
- [x] Supabaseプロジェクト作成・スキーマ適用・接続確認（#2）
- [x] サインアップ・ログイン・ログアウト（#3）
- [x] 未ログインではどの画面も見えない（#4）
- [x] **M1「輪講で実際に使える」（8/20期限、8/11に到達）**
      #10 教材 / #11 回 / #12 ログ / #13 タグ / #14 招待リンク / #15 検索 / #21 導線
- [x] ページ範囲のバグ修正・回のページ範囲・削除機能（#32, #31, #33）
- [ ] **次はこの順で着手する（この通りに1件ずつブランチ→PR→マージ）**
      1. [#39](https://github.com/iamhiroyuking/rinko-app/issues/39) ログの返信・スレッド（`logs.parent_log_id` は実装済み・未使用。**見た目の刷新はしない**、今のレイアウトの延長で機能だけ作る）
      2. [#40](https://github.com/iamhiroyuking/rinko-app/issues/40) 回のステータス変更・進捗バー（`Unit.status` は実装済み、UIが無いだけ）
      3. [#38](https://github.com/iamhiroyuking/rinko-app/issues/38) 回に自由記述の開始箇所メモを追加（`page_from`/`page_to`と両立させる方針で確定済み。詳細はIssue本文）
      4. [#41](https://github.com/iamhiroyuking/rinko-app/issues/41) BookSummaryViewの拡張（`shelf_status`/`joined_at`は実装済み、集計クエリを足すだけ）
      5. [#42](https://github.com/iamhiroyuking/rinko-app/issues/42) HomeViewのフィルタ（`listShelfBooks`は引数を受け取れる設計済み）

      **チャット風UI・吹き出し・アイコンライブラリの導入はやらない。** Antigravityから提案があったが、
      このプロジェクトはTailwind不使用・絵文字アイコンで確定済みで、提案はその経緯を踏まえていなかった。
      デザインの作り込みはM4「デザインを精査する」まで意図的に保留している（機能が固まるとレイアウトが
      変わるため）。次のセッションで同種の提案が来ても、まずこのCLAUDE.mdと関連Issueを読んでから判断する。

### 動作を確認済みのもの
- 行レベルセキュリティ（未ログイン・未参加のどちらでも何も返らない。3アカウントで確認）
- `handle_new_user()` — サインアップで `profiles` が自動生成される
- `handle_new_book()` — 教材作成で作成者が参加者になる
- `join_book_with_token()` — 招待リンクでの参加（本番URLでも確認）
- `delete_orphan_book()` — 参加者ゼロの教材が配下ごと消える
- ログイン状態が再読み込みをまたいで保たれる

### まだ一度も動いていないもの
- `protect_unit_deletion()` — 回の削除を作成者に限定（ゴミ箱のIssueで検証）

### 共有で踏んだ落とし穴（同じ形に注意）
- **行レベルセキュリティは「見てよいもの」を決めるだけで「欲しいもの」は決めない。**
  `listShelfBooks` で自分の参加情報に絞る条件を書かず、共有相手の分まで返って本棚が重複した。
  1人で試している間は絶対に出ないバグ
- **`insert().select()` は AFTER トリガーより先に評価される。** 教材の作成でこれに当たり、
  `create_book()` 関数を経由する形にした
- **profiles を広く開けすぎていた。** 担当者名を出すためだったが、全利用者の名前が見える状態だった

## デプロイ

本番URL: https://rinko-app-silk.vercel.app （Vercel、mainへのpushで自動デプロイ）

`vercel.json` で全パスを `index.html` に向けている。これが無いと `/join/<token>` のような
URLを直接開いたときにVercelがファイルを探して404を返し、**共有リンクが機能しない**。
デプロイ直後に実際に踏んだ。

### 開発用アカウント
`devtest` / `devtest2` / `devtest3` は削除済み（本人がSupabaseの管理画面から実施）。
本人のアカウント `ひろゆき` のみ残っている。

以下は検証のたびに作られる使い捨てアカウント。**残っていたら本人が管理画面から削除する**
（削除には管理者権限が必要なので私にはできない）。

- `pwtest@example.com` — パスワード再設定機能の検証用。既に削除確認済み
- `verify-delete-me@example.com` / `perm-check-2@example.com` — 回のページ範囲・削除機能の検証用（作成者／非作成者の権限確認に使った）

### メール確認は意図的に無効にしている
検証のために切ったが、そのままにしている。有効にすると、サインアップ時にメールのリンクを
踏む必要が出る一方、Supabase無料枠の標準メール送信は制限が厳しく迷惑メールに入りやすいため、
**招待した相手がサインアップできず詰まる**恐れがある。このアプリはメールを本人確認以外に
使っていないので、研究室内で使う段階では無効のままにしている。公開範囲を広げるときに再検討する。

### アカウント削除の経路が無い
ログを書いたアカウントは、外部キー（`logs.author_id` → `profiles`）が投稿者名を守るため削除できない。
「削除した人のログは残る」という仕様の帰結であり不具合ではないが、
利用者が自分のアカウントを消したくなった場合の設計は未検討。

### 共有されているものの扱い（原則）
**追加と編集は参加者全員に同期し、削除だけは作った本人しかできない。**
回を削除すると全員の画面から消えるが、ゴミ箱に出て復元できるのは作成者だけ（`Unit.created_by`）。
ログのしおりは個人のもので他人には見えない（`log_marks` テーブル）。

データの持ち方に影響する論点はすべて決着済み。残るQ3（添付ファイルの保護方針）と
Q4（第N回の番号が重複したときの並び順）は実装時の判断で足りる。

### 実装計画の要点（詳細は docs/issues.md）
Issueは縦切り（1つが「画面→データ取得→保存」まで通る単位）で分割してある。
土台（#1〜#4: 環境・DB・認証）だけ横切り。背骨は `#5 教材 → #6 回 → #7 ログ → #8 タグ` で、
ここが通れば「輪講で記録を残す」が成立する。上から順に着手し、並行して進めない。

## 開発の進め方の方針
- Issueは1機能1つの粒度（半日〜2日で終わる大きさ）
- ブランチ名は `<種類>/<内容>` のkebab-case（`feat/` `fix/` `docs/` `refactor/` `chore/`）
- PR本文に `Closes #N` を書いてIssueと紐付ける
- コード内の識別子は英語、UIの表示は日本語
- テストは進捗率の計算・検索フィルタなどロジックに限定。UIのテストは書かない
- READMEは進捗に合わせて随時更新する
- 「何を考えながら開発したか」の思考ログを残す方針（媒体は検討中）
