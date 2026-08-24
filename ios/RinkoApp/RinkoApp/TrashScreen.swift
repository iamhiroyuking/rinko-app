import RinkoCore
import SwiftUI

/*
 ゴミ箱。Web版の `TrashView` に当たる。

 自分がゴミ箱に入れた教材と、自分が作って削除した回が入る。
 復元すると元に戻る。他人が作った回は、自分の画面から消えていても
 ここには出ない（復元できるのは作成者だけ）。

 ゴミ箱から削除すると完全削除。教材の場合は再参加に招待リンクが要る。
 */

struct TrashScreen: View {
  let repositories: AppRepositories

  @State private var books: [TrashedBook] = []
  @State private var units: [TrashedUnit] = []
  @State private var errorMessage: String?
  @State private var confirmingBook: TrashedBook?
  @State private var confirmingUnit: TrashedUnit?

  var body: some View {
    List {
      Section("教材") {
        if books.isEmpty {
          Text("ありません").foregroundStyle(.secondary)
        }
        ForEach(books) { book in
          HStack {
            Text(book.title)
            Spacer()
            Button("復元") { Task { await restoreBook(book) } }.font(.caption)
            Button("完全に削除", role: .destructive) { confirmingBook = book }
              .font(.caption)
          }
        }
      }

      Section("回") {
        if units.isEmpty {
          Text("ありません").foregroundStyle(.secondary)
        }
        ForEach(units) { unit in
          VStack(alignment: .leading, spacing: 2) {
            HStack {
              VStack(alignment: .leading) {
                Text("\(unit.bookTitle) ・ 第\(unit.order)回")
                  .font(.caption).foregroundStyle(.secondary)
                Text(unit.title)
              }
              Spacer()
              Button("復元") { Task { await restoreUnit(unit) } }.font(.caption)
              Button("完全に削除", role: .destructive) { confirmingUnit = unit }
                .font(.caption)
            }
          }
        }
      }
    }
    .navigationTitle("ゴミ箱")
    .navigationBarTitleDisplayMode(.inline)
    .refreshable { await load() }
    .task { await load() }
    .confirmationDialog(
      "完全に削除しますか？", isPresented: .constant(confirmingBook != nil), titleVisibility: .visible
    ) {
      Button("完全に削除する", role: .destructive) {
        if let book = confirmingBook { Task { await deleteBook(book) } }
      }
      Button("キャンセル", role: .cancel) { confirmingBook = nil }
    } message: {
      Text("元に戻せません。再参加には招待リンクが要ります。")
    }
    .confirmationDialog(
      "完全に削除しますか？", isPresented: .constant(confirmingUnit != nil), titleVisibility: .visible
    ) {
      Button("完全に削除する", role: .destructive) {
        if let unit = confirmingUnit { Task { await deleteUnit(unit) } }
      }
      Button("キャンセル", role: .cancel) { confirmingUnit = nil }
    } message: {
      Text("元に戻せません。")
    }
    .alert("エラー", isPresented: .constant(errorMessage != nil)) {
      Button("閉じる") { errorMessage = nil }
    } message: {
      Text(errorMessage ?? "")
    }
  }

  private func load() async {
    do {
      books = try await repositories.books.listTrashed()
      units = try await repositories.units.listMyTrashed()
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func restoreBook(_ book: TrashedBook) async {
    do {
      try await repositories.books.restore(id: book.id)
      books.removeAll { $0.id == book.id }
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func deleteBook(_ book: TrashedBook) async {
    confirmingBook = nil
    do {
      try await repositories.books.permanentlyDelete(id: book.id)
      books.removeAll { $0.id == book.id }
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func restoreUnit(_ unit: TrashedUnit) async {
    do {
      try await repositories.units.restore(id: unit.id)
      units.removeAll { $0.id == unit.id }
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func deleteUnit(_ unit: TrashedUnit) async {
    confirmingUnit = nil
    do {
      try await repositories.units.permanentlyDelete(id: unit.id)
      units.removeAll { $0.id == unit.id }
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }
}

#Preview {
  NavigationStack {
    TrashScreen(repositories: .preview)
  }
}
