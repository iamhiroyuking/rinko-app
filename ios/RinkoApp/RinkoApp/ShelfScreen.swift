import RinkoCore
import SwiftUI

/*
 本棚。Web版の `HomeView` に当たる。

 並びは向こうと同じで「次にやること → 本棚」。**本棚の上に足すのであって
 置き換えない**という判断もそのまま引き継いでいる。

 SwiftUIではWeb版のCSSグリッドではなく `List` を使っている。
 iOSでは引いて更新する・横に払って消すといった動きが標準で付いてくるので、
 自前で並べるより馴染む。
 */

struct ShelfScreen: View {
  let books: any BookRepository
  let activity: any ActivityRepository

  @State private var shelf: [ShelfBook] = []
  @State private var upcoming: [UpcomingUnit] = []
  @State private var newCounts: [String: Int] = [:]
  @State private var errorMessage: String?

  var body: some View {
    List {
      // 予定が無いときは節ごと出さない。空の枠が毎回目に入るのを避ける
      if !upcoming.isEmpty {
        Section("次にやること") {
          ForEach(upcoming) { item in
            NavigationLink {
              UnitScreen(
                unitId: item.unitId,
                logs: FakeLogRepository(),
                units: FakeUnitRepository(),
                members: FakeMemberRepository())
            } label: {
              UpcomingRow(item: item)
            }
          }
        }
      }

      Section("学習中の教材") {
        ForEach(shelf) { book in
          NavigationLink {
            UnitListScreen(
              bookId: book.id,
              bookTitle: book.title,
              units: FakeUnitRepository(),
              members: FakeMemberRepository())
          } label: {
            ShelfRow(book: book, newCount: newCounts[book.id] ?? 0)
          }
        }
      }
    }
    .navigationTitle("本棚")
    .task { await load() }
    .alert("読み込めませんでした", isPresented: .constant(errorMessage != nil)) {
      Button("閉じる") { errorMessage = nil }
    } message: {
      Text(errorMessage ?? "")
    }
  }

  private func load() async {
    do {
      shelf = try await books.listShelf(status: .reading)
      upcoming = try await activity.listUpcoming()
      newCounts = try await activity.countNewLogs()
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }
}

private struct UpcomingRow: View {
  let item: UpcomingUnit

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(item.bookTitle)
        .font(.caption)
        .foregroundStyle(.secondary)

      Text("第\(item.order)回　\(item.title)")
        .font(.callout.weight(.semibold))

      HStack(spacing: 6) {
        Text(item.scheduledDate ?? "日程未定")
        if let name = item.presenterName {
          Text("・ \(name)")
        }
        // 担当は準備が要る側。いちばん伝える価値が高い
        if item.isMine {
          Text("あなたの担当")
            .font(.caption2.weight(.bold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(.tint, in: Capsule())
            .foregroundStyle(.white)
        }
      }
      .font(.caption)
      .foregroundStyle(.secondary)
    }
    .padding(.vertical, 2)
  }
}

private struct ShelfRow: View {
  let book: ShelfBook
  let newCount: Int

  var body: some View {
    HStack(spacing: 12) {
      // 表紙はまだ繋いでいないので、Web版と同じく本の絵で代替する
      Image(systemName: "book")
        .font(.title3)
        .foregroundStyle(.secondary)
        .frame(width: 44, height: 58)
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 6))

      VStack(alignment: .leading, spacing: 3) {
        Text(book.title).font(.callout.weight(.semibold))

        HStack(spacing: 8) {
          if book.memberCount > 1 {
            Label("\(book.memberCount)人で共有", systemImage: "person.2")
          }
          // 0のときは出さない。開く理由になるときだけ見せる
          if newCount > 0 {
            Text("新着 \(newCount)件")
              .font(.caption2.weight(.bold))
              .padding(.horizontal, 6)
              .padding(.vertical, 2)
              .background(.tint, in: Capsule())
              .foregroundStyle(.white)
          }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
      }
    }
    .padding(.vertical, 2)
  }
}

#Preview {
  NavigationStack {
    ShelfScreen(books: FakeBookRepository(), activity: FakeActivityRepository())
  }
}
