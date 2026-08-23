// swift-tools-version: 6.0
import PackageDescription

/*
 Webアプリのロジックを移したもの（#147）と、Supabaseに繋ぐ実装（#151）。

 **ターゲットを2つに分けてあるのが要点。**

 - `RinkoCore`  … 画面もネットワークも知らない。依存ゼロ
 - `RinkoSupabase` … `RinkoCore` のプロトコルをSupabaseで満たす

 分ける理由は3つ。

 1. TypeScript側の同じ関数にテストが66件あり、**それがそのまま仕様書になる**。
    先にテストを移してから実装すると、移植でいちばん怖い「微妙に挙動が変わる」を
    防げる。そのテストを**ネットワーク無しで走らせ続けたい**
 2. Xcodeが無い環境でもコンパイルとテストが通る。土台を先に固められる
 3. 依存を足すのは `RinkoSupabase` 側だけで済む。ロジックが
    SDKの都合に引きずられない
 */
let package = Package(
  name: "RinkoCore",
  platforms: [.iOS(.v17), .macOS(.v14)],
  products: [
    .library(name: "RinkoCore", targets: ["RinkoCore"]),
    .library(name: "RinkoSupabase", targets: ["RinkoSupabase"]),
  ],
  dependencies: [
    .package(url: "https://github.com/supabase/supabase-swift.git", from: "2.0.0")
  ],
  targets: [
    .target(name: "RinkoCore"),
    .target(
      name: "RinkoSupabase",
      dependencies: [
        "RinkoCore",
        .product(name: "Supabase", package: "supabase-swift"),
      ]
    ),
    .testTarget(name: "RinkoCoreTests", dependencies: ["RinkoCore"]),
  ]
)
