# rinko-app 開発コンテキスト

このプロジェクトについて、新しいセッションが最初に把握しておくべき情報。

## プロジェクト概要
研究室の輪講（reading group）運営を楽にするアプリ。夏休み中の個人開発プロジェクト（Proj_成果物開発、期限2026-09-30）の一環で、GitHub・ポートフォリオとして公開する成果物を残すことが主目的（収益化は副次目標）。

- リポジトリ: https://github.com/iamhiroyuking/rinko-app （private）
- ローカル: `~/Developer/rinko-app`
- 開発者: 1人（友人を巻き込む可能性はあるが現時点では単独開発）
- 夏休み中に解像度を上げたいテーマ: 言語選定ロジック、UI/UX設計、チーム開発の一般的な流れ

## ターゲット
- 研究室で輪講を実施している人
- 教科書・参考書を使って輪講形式で学習しているグループ

## 現状の課題（なぜ作るか）
1. 輪講がどこまで進んだか曖昧
2. 進度の目安・目標が立っていない
3. 学んでいることの全体像が掴めていない
4. 学ぶことの目的意識が薄い
5. 問題演習が多く、全員が理解できているか分からない
6. 新しい概念が次々出てきて復習が追いつかない
7. 担当者の予習量に見合う進度が得られていない

## MVP機能（詳細は docs/requirements.md）
1. 輪講を作成し、教材の章/回リストを登録
2. 各回に担当者・予定日を割り当て
3. 各回のステータス（未着手/進行中/完了）を更新し、進捗が一覧でパッと見える
4. 目標ペースを設定し、実進捗との差分を表示
5. 各回に演習の実施メモ・振り返りメモを残せる
6. 各回に「この回で学ぶこと」を一言書ける欄

演習(Exercise)は独立オブジェクトにせず、`Unit.notes` への自由記述に留めて複雑さを抑える方針（Phase 2以降で切り出す可能性あり）。

## データモデル（軽量版、詳細は docs/requirements.md）
```
Seminar: id, name, material_title, target_pace, members[]
Member:  id, name
Unit:    id, seminar_id, order, title, objective, presenter_id,
         planned_date, status(not_started|in_progress|done),
         notes, needs_review(bool)
```

## 進行状況・次のステップ
- [x] アイデア確定（案A: 輪講アプリ）
- [x] 要件定義・MVP機能・軽量データモデル定義（`docs/requirements.md`）
- [x] 画面遷移図（9画面を確定。`docs/screen-flow.md` とクリッカブルデモ `docs/prototype/screen-flow-demo.html`）
- [ ] デモを元にした機能要件の洗い出しと `docs/requirements.md` の改訂
- [ ] データの保存先の決定（localStorageのみ / BaaS / 自前バックエンド）← 規模を決める最重要判断
- [ ] 技術スタック選定（TypeScript/JavaScriptを軽く調査中、未確定）
- [ ] 極小プロトタイプ（画面1枚が動く最小コード）

### 未解決の設計論点（詳細は `docs/screen-flow.md`）
- ログ機能が `requirements.md` のMVP範囲（`Exercise` を作らない方針）を超えている。範囲を広げるか縮小するか未決着
- メンバー招待・権限管理、編集・削除の導線が未設計
- レスポンシブ方針（主な利用端末）が未決定

## 開発の進め方の方針
- Issueで機能単位のタスクを管理
- 機能ごとにブランチを切ってPRを作成し、mainにマージ（1人開発でも型を作る練習として実施）
- READMEは進捗に合わせて随時更新する
- 「何を考えながら開発したか」の思考ログを残す方針（媒体は検討中）
