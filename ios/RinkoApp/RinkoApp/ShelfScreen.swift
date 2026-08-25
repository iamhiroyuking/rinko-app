import RinkoCore
import SwiftUI

/*
 本棚。Web版の `HomeView` に当たる。

 並びは向こうと同じで「次にやること → 本棚」。表示するのは
 `shelf_status = reading` の教材が主役で、学習予定・学習済みは
 フィルタの切り替えで見る。

 SwiftUIではWeb版のCSSグリッドではなく `List` を使っている。
 iOSでは引いて更新する・横に払って消すといった動きが標準で付いてくるので、
 自前で並べるより馴染む。
 */

struct ShelfScreen: View {
  let repositories: AppRepositories
  let userId: String

  @State private var shelf: [ShelfBook] = []
  @State private var upcoming: [UpcomingUnit] = []
  @State private var newCounts: [String: Int] = [:]
  @State private var coverURLs: [String: URL] = [:]
  @State private var status: ShelfStatus = .reading
  @State private var errorMessage: String?
  @State private var showingAddBook = false

  var body: some View {
    List {
      // 予定が無いときは節ごと出さない。空の枠が毎回目に入るのを避ける
      if status == .reading, !upcoming.isEmpty {
        Section("次にやること") {
          ForEach(upcoming) { item in
            NavigationLink {
              BookSummaryScreen(bookId: item.bookId, repositories: repositories)
            } label: {
              UpcomingRow(item: item)
            }
          }
        }
      }

      Section {
        Picker("表示", selection: $status) {
          ForEach(ShelfStatus.allCases, id: \.self) { Text($0.label).tag($0) }
        }
        .pickerStyle(.segmented)
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
      }

      Section {
        if shelf.isEmpty {
          Text("まだありません").foregroundStyle(.secondary)
        }
        ForEach(shelf) { book in
          NavigationLink {
            BookSummaryScreen(bookId: book.id, repositories: repositories)
          } label: {
            ShelfRow(book: book, newCount: newCounts[book.id] ?? 0, coverURL: coverURLs[book.id])
          }
        }
      }
    }
    .navigationTitle("本棚")
    .toolbar {
      ToolbarItem(placement: .primaryAction) {
        Button { showingAddBook = true } label: { Image(systemName: "plus") }
      }
      ToolbarItem(placement: .secondaryAction) {
        NavigationLink {
          TrashScreen(repositories: repositories)
        } label: {
          Label("ゴミ箱", systemImage: "trash")
        }
      }
    }
    .refreshable { await load() }
    .task { await load() }
    .onChange(of: status) { _, _ in Task { await load() } }
    .sheet(isPresented: $showingAddBook) {
      AddBookScreen(repositories: repositories) { _ in
        Task { await load() }
      }
    }
    .alert("読み込めませんでした", isPresented: .constant(errorMessage != nil)) {
      Button("閉じる") { errorMessage = nil }
    } message: {
      Text(errorMessage ?? "")
    }
  }

  private func load() async {
    do {
      shelf = try await repositories.books.listShelf(status: status)
      if status == .reading {
        upcoming = try await repositories.activity.listUpcoming()
        newCounts = try await repositories.activity.countNewLogs()
      }

      let paths = shelf.compactMap { $0.coverStoragePath }
      if !paths.isEmpty {
        coverURLs = try await repositories.attachments.signedURLs(paths: paths)
      }
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
  let coverURL: URL?

  var body: some View {
    HStack(spacing: 12) {
      Group {
        if let coverURL {
          AsyncImage(url: coverURL) { image in
            image.resizable().scaledToFill()
          } placeholder: {
            Color.clear
          }
        } else {
          // 表紙が無い教材は本の絵で代替する
          Image(systemName: "book")
            .font(.title3)
            .foregroundStyle(.secondary)
        }
      }
      .frame(width: 44, height: 58)
      .background(.quaternary, in: RoundedRectangle(cornerRadius: 6))
      .clipShape(RoundedRectangle(cornerRadius: 6))

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
    ShelfScreen(repositories: .preview, userId: PreviewData.me)
  }
}
