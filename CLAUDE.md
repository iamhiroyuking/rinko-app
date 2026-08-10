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
Book:       id, title, cover_image_url, shelf_status(planned|reading|finished),
            goal, created_by
Membership: id, book_id, user_id, role(editor|viewer), display_order, deleted_at
InviteLink: id, book_id, token, role, created_by
Unit:       id, book_id, order, title, objective, presenter_id,
            scheduled_date, status(not_started|in_progress|done), deleted_at
Log:        id, unit_id, author_id, parent_log_id, type(none|preview|question|review),
            title, body, page_start, page_end, is_marked
Tag:        id, book_id, name
LogTag:     log_id, tag_id
Attachment: id, log_id, file_url, file_name, mime_type
```

`Book.shelf_status` は本棚の整理用でユーザーが手動変更する。`Unit.status` は進捗計算用。目的が違うので名前を分けている。

## 画面（10枚）
LoginView / HomeView / AddBookView / BookSummaryView / SeminarView /
CreateUnitView / UnitView / AddLogView / SearchView / TrashView

`docs/prototype/screen-flow-demo.html` はv1時点の9画面で作ったクリッカブルデモ。ログイン・ゴミ箱・返信などv2の変更は未反映。

## 進行状況・次のステップ
- [x] アイデア確定（案A: 輪講アプリ）
- [x] 要件定義 v1
- [x] 画面遷移図 v1（9画面）とクリッカブルデモ
- [x] 全設問への回答を踏まえた要件定義 v2・画面遷移図 v2・データモデル再定義
- [x] 設計上の未決事項をすべて解消（`docs/open-questions.md`）
- [x] 実装計画を29件のIssueに分割（`docs/issues.md`）
- [ ] データの保存先の決定 ← Supabase（BaaS）に傾いているが未確定
- [ ] 技術スタック選定
- [ ] 開発環境の構築（Issue #1）
- [ ] M1「輪講で実際に使える」まで到達（8/20期限、Issue #5〜#10）

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
