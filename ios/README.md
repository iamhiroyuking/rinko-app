# iOS版

Web版と同じSupabaseを使う。**スキーマも行レベルセキュリティも共通**で、
書き直すのは画面とデータ取得の呼び出しだけ（[docs/concept.md](../docs/concept.md)）。

```
RinkoCore/   ロジック。画面もネットワークも知らない。テストはここに付く
RinkoApp/    SwiftUIの画面。project.yml から Xcode プロジェクトを生成する
```

## 動かす

```bash
brew install xcodegen
xcodegen generate --spec ios/RinkoApp/project.yml
open ios/RinkoApp/RinkoApp.xcodeproj
```

`.xcodeproj` と `Info.plist` は**生成物なのでリポジトリに入れていない**。
巨大なXMLで差分が読めず、競合も解けないため。定義は `project.yml` が正。

ロジックだけなら Xcode 無しでも回る。

```bash
swift test --package-path ios/RinkoCore
```

## 今どこまで

- **ロジックの移植**: ページ範囲・スレッド・並べ替え・進捗・検索・タグ。**テスト36件**
- **画面**: 本棚 → 回の一覧 → 記録。シミュレータで起動を確認済み
- **データ取得**: プロトコルだけ。**まだ偽の実装で動いている**（`PreviewData.swift`）

Supabaseには繋いでいない。画面とネットワークの不具合を同時に見ないよう、
先に画面だけを立ててある。

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
