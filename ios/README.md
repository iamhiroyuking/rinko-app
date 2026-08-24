# iOS版

Web版と同じSupabaseを使う。**スキーマも行レベルセキュリティも共通**で、
書き直すのは画面とデータ取得の呼び出しだけ（[docs/concept.md](../docs/concept.md)）。

```
RinkoCore/
  Sources/RinkoCore/       ロジック。画面もネットワークも知らない。依存ゼロ
  Sources/RinkoSupabase/   上のプロトコルをSupabaseで満たす
RinkoApp/                  SwiftUIの画面。project.yml から Xcode プロジェクトを生成する
```

**ターゲットを分けてあるのが要点。** `RinkoCore` に依存を入れないので、
36件のテストが**ネットワーク無しで、Xcode無しでも走る**。SDKの都合が
ロジックへ染み出すのも防げる。

## 動かす

```bash
brew install xcodegen
cp ios/Secrets.xcconfig.example ios/Secrets.xcconfig   # 値を埋める
xcodegen generate --spec ios/RinkoApp/project.yml
open ios/RinkoApp/RinkoApp.xcodeproj
```

`Secrets.xcconfig` に接続先と anon key を書く。値は Web版の `.env` と
同じもので、Supabase のダッシュボード > Project Settings > API にある。

anon key は**端末に露出する前提の鍵**で、公開されても問題ない。データを
守るのは鍵の秘匿ではなく行レベルセキュリティ。ただしリポジトリが public
なので、値そのものは置かず gitignore してある。service_role key は
全ての制限を無視できるので**絶対に書かない**。

**URLをスキームとホストに分けているのは xcconfig の都合。** `//` を
コメントの開始として食べてしまうため、`https://xxx.supabase.co` を
そのまま書くと `https:` だけが残る。`Info.plist` 側で組み立てている。

`.xcodeproj` と `Info.plist` は**生成物なのでリポジトリに入れていない**。
巨大なXMLで差分が読めず、競合も解けないため。定義は `project.yml` が正。

ロジックだけなら Xcode 無しでも回る。

```bash
swift test --package-path ios/RinkoCore
```

## 今どこまで

- **ロジックの移植**: ページ範囲・スレッド・並べ替え・進捗・検索・タグ。**テスト36件**
- **画面**: 本棚 → 回の一覧 → 記録。シミュレータで起動を確認済み
- **データ取得**: **Supabaseに繋がった**（#151）。認証・本棚・回・記録・
  タグ・添付・新着・参加者。偽の実装は `PreviewData.swift` に残してあり、
  SwiftUIのプレビューではそちらを使う
- **ログインの関門**: 未ログインでは中身が一切見えない（Web版と同じ決まり）

まだ移していないのは検索・招待リンク・しおり・ゴミ箱の画面。
データ取得側のプロトコルは `Repositories.swift` に輪郭だけある。

### 移植で引き継いだ落とし穴

Web版が実際に踏んだもので、**1人で試している間は出ない**ものが多い。

- **`user_id` で絞る。** 行レベルセキュリティは「見てよいもの」を決める
  だけで「欲しいもの」は決めない。参加者名を出すために共有相手の参加情報も
  読めるので、絞らないと本棚が人数分だけ重複する
- **結合先で絞るときは `units!inner`。** 無いと `units` 側の条件が効かず、
  教材をまたいで数える
- **教材の作成は `create_book` 関数を通す。** `insert().select()` は
  AFTER トリガーより先に評価されるので、参加者になる前に弾かれる
- **画像は先に消す。** データベースは連鎖するがストレージは連鎖しない。
  参加情報が消えたあとはポリシーも通らず、本人にすら消せなくなる

## 検証の状況

- `swift build` / `swift test`（36件）: 通る
- `xcodebuild`（シミュレータ向け）: 通る
- 起動してログイン画面が出るところまで確認済み
- **ログイン後の実データはまだ通していない。** 本人のアカウントが要る

## 移植の考え方

**テストを先に移す。** Web版の66件が仕様書になっているので、同じ入力で
同じ結果になることを確かめながら進める。移植でいちばん怖い
「だいたい動くが細部が違う」を、その場で見つけられる。

実際、`Tags.parse` で差が出た。TypeScript版は `#` を**区切り**として
扱っており（`#a#b` は2つのタグ）、Swiftらしく「前置きを剥がす」と
書くと挙動が変わっていた。

## 名前について

`Unit` は Foundation の同名型と衝突するので **`StudyUnit`** にしてある。
データベースの `units` との対応は保っている。

日本語の呼び名（教材 / 回 など）は**まだ決めていない**。
`docs/concept.md` の「決めること」を参照。
