import RinkoCore
import SwiftUI

/*
 iOS版の入口（#147）。

 **今はまだ偽の実装で動いている。** Supabaseには繋いでいない。
 画面とネットワークの不具合を同時に見ないよう、先に画面だけを立てる。

 Web版の `src/App.tsx` に当たる。あちらは未ログインを弾く関門を
 ルーティングに置いていたが、こちらは後で `SessionStore` を挟む。
 */

@main
struct RinkoApp: App {
  var body: some Scene {
    WindowGroup {
      NavigationStack {
        ShelfScreen(
          books: FakeBookRepository(),
          activity: FakeActivityRepository()
        )
      }
    }
  }
}
