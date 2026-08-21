// swift-tools-version: 6.0
import PackageDescription

/*
 Webアプリのロジックを移したもの（#147）。

 **画面もSupabaseもここには入れない。** データ取得に依存しない部分だけを
 集めてある。理由は2つ。

 1. TypeScript側の同じ関数にテストが66件あり、**それがそのまま仕様書になる**。
    先にテストを移してから実装すると、移植でいちばん怖い「微妙に挙動が変わる」を
    防げる
 2. Xcodeが無い環境でもコンパイルとテストが通る。土台を先に固められる
 */
let package = Package(
  name: "RinkoCore",
  platforms: [.iOS(.v17), .macOS(.v14)],
  products: [
    .library(name: "RinkoCore", targets: ["RinkoCore"])
  ],
  targets: [
    .target(name: "RinkoCore"),
    .testTarget(name: "RinkoCoreTests", dependencies: ["RinkoCore"]),
  ]
)
