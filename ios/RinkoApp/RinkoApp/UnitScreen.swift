import RinkoCore
import SwiftUI

/*
 回の記録。Web版の `UnitView` に当たる。

 スレッドの組み立てと並べ替えは `RinkoCore` の `Threads` がやる。
 **画面はその結果を並べるだけ。** Web版で927行まで膨らんで部品に
 割り直した経緯があるので、こちらは最初から表示に徹しておく。

 - しおりは**個人の目印**で他人には見えない。付け外しは即座に反映する
 - ステータスは参加者なら誰でも変更できる
 - 自分の投稿のみ編集・削除できる。消すと返信も連鎖して消える
 */

struct UnitScreen: View {
  let bookId: String
  let unitId: String
  let repositories: AppRepositories

  @State private var unit: StudyUnit?
  @State private var threads: [LogThread] = []
  @State private var memberList: [BookMember] = []
  @State private var markedIds: Set<String> = []
  @State private var myUserId: String?
  @State private var order: LogOrder = .posted
  @State private var errorMessage: String?

  @State private var showingNewLog = false
  @State private var replyTarget: LogEntry?
  @State private var editingLog: LogEntry?

  enum LogOrder: String, CaseIterable {
    case posted, page
    var label: String { self == .posted ? "投稿順" : "ページ順" }
  }

  private var shown: [LogThread] {
    order == .page ? Threads.sortByPage(threads) : threads
  }

  var body: some View {
    List {
      if let unit {
        Section {
          VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
              StatusPill(status: unit.status)
              if let pages = PageRange.formatUnit(start: unit.pageFrom, end: unit.pageTo) {
                Text(pages).font(.caption.monospaced())
              }
            }
            if let presenter = name(of: unit.presenterId) {
              Text("担当: \(presenter)").font(.caption).foregroundStyle(.secondary)
            }

            Picker("ステータス", selection: statusBinding(for: unit)) {
              ForEach(UnitStatus.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
          }
          .padding(.vertical, 2)
        }
      }

      Section {
        Picker("並べ方", selection: $order) {
          ForEach(LogOrder.allCases, id: \.self) { Text($0.label).tag($0) }
        }
        .pickerStyle(.segmented)
      }

      ForEach(shown, id: \.root.id) { thread in
        Section {
          logRow(thread.root)
          ForEach(thread.replies) { reply in
            logRow(reply).padding(.leading, 16)
          }

          Button {
            replyTarget = thread.root
          } label: {
            Label("返信する", systemImage: "arrowshape.turn.up.left")
          }
          .font(.caption)
        }
      }
    }
    .navigationTitle(unit.map { "第\($0.order)回　\($0.title)" } ?? "記録")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .primaryAction) {
        Button { showingNewLog = true } label: { Image(systemName: "square.and.pencil") }
          .accessibilityLabel("発言する")
      }
    }
    .refreshable { await load() }
    .task {
      myUserId = try? await repositories.auth.currentUserId()
      await load()
    }
    .sheet(isPresented: $showingNewLog) {
      AddLogScreen(unitId: unitId, repositories: repositories) {
        Task { await load() }
      }
    }
    .sheet(item: $replyTarget) { parent in
      AddLogScreen(
        unitId: unitId, repositories: repositories, parentLogId: parent.id
      ) {
        Task { await load() }
      }
    }
    .sheet(item: $editingLog) { log in
      AddLogScreen(unitId: unitId, repositories: repositories, editing: log) {
        Task { await load() }
      }
    }
    .alert("エラー", isPresented: .constant(errorMessage != nil)) {
      Button("閉じる") { errorMessage = nil }
    } message: {
      Text(errorMessage ?? "")
    }
  }

  @ViewBuilder
  private func logRow(_ log: LogEntry) -> some View {
    LogCard(
      log: log, authorName: name(of: log.authorId),
      isMarked: markedIds.contains(log.id),
      isMine: log.authorId == myUserId,
      onToggleMark: { Task { await toggleMark(log) } },
      onToggleResolved: log.type == .question ? { Task { await toggleResolved(log) } } : nil,
      onEdit: log.authorId == myUserId ? { editingLog = log } : nil,
      onDelete: log.authorId == myUserId ? { Task { await delete(log) } } : nil
    )
  }

  private func statusBinding(for unit: StudyUnit) -> Binding<UnitStatus> {
    Binding(
      get: { unit.status },
      set: { newValue in Task { await updateStatus(newValue) } }
    )
  }

  private func load() async {
    do {
      unit = try await repositories.units.get(id: unitId)
      memberList = try await repositories.members.list(bookId: bookId)
      let all = try await repositories.logs.list(unitId: unitId)
      threads = Threads.build(all)
      markedIds = try await repositories.marks.listMineInBook(bookId: bookId)
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func updateStatus(_ status: UnitStatus) async {
    do {
      try await repositories.units.updateStatus(id: unitId, status: status)
      unit = try await repositories.units.get(id: unitId)
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func toggleMark(_ log: LogEntry) async {
    do {
      if markedIds.contains(log.id) {
        try await repositories.marks.remove(logId: log.id)
        markedIds.remove(log.id)
      } else {
        try await repositories.marks.add(logId: log.id)
        markedIds.insert(log.id)
      }
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func toggleResolved(_ log: LogEntry) async {
    do {
      try await repositories.logs.setResolved(id: log.id, resolved: log.resolvedAt == nil)
      await load()
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func delete(_ log: LogEntry) async {
    do {
      try await repositories.logs.delete(id: log.id)
      await load()
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func name(of userId: String?) -> String? {
    guard let userId else { return nil }
    return memberList.first { $0.id == userId }?.displayName
  }
}

private struct LogCard: View {
  let log: LogEntry
  let authorName: String?
  let isMarked: Bool
  let isMine: Bool
  let onToggleMark: () -> Void
  /// 疑問のときだけ入る
  let onToggleResolved: (() -> Void)?
  let onEdit: (() -> Void)?
  let onDelete: (() -> Void)?

  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      HStack(spacing: 6) {
        Text(authorName ?? "不明").font(.caption.weight(.bold))

        if log.type != .none {
          Text(log.type.label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(.orange.opacity(0.15), in: Capsule())
            .foregroundStyle(.orange)
        }

        if log.type == .question, log.resolvedAt != nil {
          Text("解決済み")
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(.green.opacity(0.15), in: Capsule())
            .foregroundStyle(.green)
        }

        if let pages = PageRange.formatLog(start: log.pageStart, end: log.pageEnd) {
          Text(pages).font(.caption2.monospaced()).foregroundStyle(.secondary)
        }

        Spacer()

        Menu {
          Button {
            onToggleMark()
          } label: {
            Label(isMarked ? "しおりを外す" : "しおりを付ける", systemImage: isMarked ? "bookmark.fill" : "bookmark")
          }
          if let onToggleResolved {
            Button {
              onToggleResolved()
            } label: {
              Label(
                log.resolvedAt == nil ? "解決済みにする" : "未解決に戻す",
                systemImage: "checkmark.circle")
            }
          }
          if let onEdit {
            Button { onEdit() } label: { Label("編集する", systemImage: "pencil") }
          }
          if let onDelete {
            Button(role: .destructive) { onDelete() } label: {
              Label("削除する", systemImage: "trash")
            }
          }
        } label: {
          Image(systemName: isMarked ? "bookmark.fill" : "ellipsis.circle")
            .foregroundStyle(isMarked ? .yellow : .secondary)
        }
        .accessibilityLabel("この記録のメニュー")
      }

      if let title = log.title {
        Text(title).font(.callout.weight(.semibold))
      }

      Text(attributed(log.body)).font(.callout)

      if !log.tagNames.isEmpty {
        HStack(spacing: 4) {
          ForEach(log.tagNames, id: \.self) { tag in
            Text("#\(tag)")
              .font(.caption2)
              .padding(.horizontal, 6).padding(.vertical, 2)
              .background(.green.opacity(0.12), in: Capsule())
              .foregroundStyle(.green)
          }
        }
      }
    }
    .padding(.vertical, 3)
  }

  private func attributed(_ markdown: String) -> AttributedString {
    (try? AttributedString(
      markdown: markdown,
      options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
      ?? AttributedString(markdown)
  }
}

#Preview {
  NavigationStack {
    UnitScreen(bookId: "book-prml", unitId: "unit-2", repositories: .preview)
  }
}
