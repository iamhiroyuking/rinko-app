import RinkoCore
import SwiftUI

/// 回の一覧。Web版の `SeminarView` に当たる
struct UnitListScreen: View {
  let bookId: String
  let bookTitle: String
  let repositories: AppRepositories

  @State private var list: [StudyUnit] = []
  @State private var memberList: [BookMember] = []
  @State private var myUserId: String?
  @State private var showingCreate = false
  @State private var errorMessage: String?

  private var progress: UnitProgress { Progress.count(list) }

  var body: some View {
    List {
      if !list.isEmpty {
        Section {
          VStack(alignment: .leading, spacing: 6) {
            HStack {
              Text("進み具合").font(.caption.weight(.semibold))
              Spacer()
              Text("\(progress.done) / \(progress.total) 回 完了")
                .font(.caption).foregroundStyle(.secondary)
            }
            ProgressView(value: Double(progress.percent), total: 100)
          }
          .padding(.vertical, 4)
        }
      }

      Section {
        ForEach(list) { unit in
          NavigationLink {
            UnitScreen(bookId: bookId, unitId: unit.id, repositories: repositories)
          } label: {
            UnitRow(unit: unit, presenterName: name(of: unit.presenterId))
          }
          .swipeActions(edge: .trailing) {
            // 削除・復元できるのは作成者だけ。データベース側のトリガーが
            // 拒むので、Web版と同じく「押せば拒否される」ではなく
            // 押しても意味の無いボタンをここで出さない、が本来は要る。
            // created_by を持たないのでここでは常に出し、失敗はエラーで示す
            Button(role: .destructive) {
              Task { await trash(unit) }
            } label: {
              Label("ゴミ箱へ", systemImage: "trash")
            }
          }
        }
      }

      Section {
        Button {
          showingCreate = true
        } label: {
          Label("回を作成する", systemImage: "plus.circle")
        }
      }
    }
    .navigationTitle(bookTitle)
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .primaryAction) {
        NavigationLink {
          SearchScreen(bookId: bookId, repositories: repositories)
        } label: {
          Image(systemName: "magnifyingglass")
        }
      }
    }
    .refreshable { await load() }
    .task {
      myUserId = try? await repositories.auth.currentUserId()
      await load()
      // 見たことにする。一覧を開いたときだけ呼ぶ。概要の画面を開いただけで
      // 消すと、記録を見ていないのに新着が黙って消える
      try? await repositories.activity.markSeen(bookId: bookId)
    }
    .sheet(isPresented: $showingCreate) {
      CreateUnitScreen(bookId: bookId, members: memberList, repositories: repositories) {
        Task { await load() }
      }
    }
    .alert("エラー", isPresented: .constant(errorMessage != nil)) {
      Button("閉じる") { errorMessage = nil }
    } message: {
      Text(errorMessage ?? "")
    }
  }

  private func load() async {
    do {
      list = try await repositories.units.list(bookId: bookId)
      memberList = try await repositories.members.list(bookId: bookId)
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func trash(_ unit: StudyUnit) async {
    do {
      try await repositories.units.trash(id: unit.id)
      list.removeAll { $0.id == unit.id }
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func name(of userId: String?) -> String? {
    guard let userId else { return nil }
    return memberList.first { $0.id == userId }?.displayName
  }
}

private struct UnitRow: View {
  let unit: StudyUnit
  let presenterName: String?

  var body: some View {
    HStack(spacing: 10) {
      Text("第\(unit.order)回")
        .font(.caption.monospaced())
        .foregroundStyle(.secondary)
        .frame(width: 48, alignment: .leading)

      VStack(alignment: .leading, spacing: 2) {
        Text(unit.title).font(.callout.weight(.semibold))

        HStack(spacing: 4) {
          if let presenterName { Text(presenterName) }
          if let date = unit.scheduledDate { Text("・ \(date)") }
          if let pages = PageRange.formatUnit(start: unit.pageFrom, end: unit.pageTo) {
            Text("・ \(pages)").monospaced()
          }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
      }

      Spacer()
      StatusPill(status: unit.status)
    }
    .padding(.vertical, 2)
  }
}

struct StatusPill: View {
  let status: UnitStatus

  private var tint: Color {
    switch status {
    case .notStarted: .secondary
    case .inProgress: .orange
    case .done: .green
    }
  }

  var body: some View {
    Text(status.label)
      .font(.caption2.weight(.bold))
      .padding(.horizontal, 8)
      .padding(.vertical, 3)
      .background(tint.opacity(0.15), in: Capsule())
      .foregroundStyle(tint)
  }
}

#Preview {
  NavigationStack {
    UnitListScreen(
      bookId: "book-prml", bookTitle: "パターン認識と機械学習",
      repositories: .preview)
  }
}
