import RinkoCore
import SwiftUI

/*
 回の記録。Web版の `UnitView` に当たる。

 スレッドの組み立てと並べ替えは `RinkoCore` の `Threads` がやる。
 **画面はその結果を並べるだけ。** Web版で927行まで膨らんで部品に
 割り直した経緯があるので、こちらは最初から表示に徹しておく。
 */

struct UnitScreen: View {
  let unitId: String
  let logs: any LogRepository
  let units: any UnitRepository
  let members: any MemberRepository

  @State private var unit: StudyUnit?
  @State private var threads: [LogThread] = []
  @State private var memberList: [BookMember] = []
  @State private var order: LogOrder = .posted

  /// 記録の並べ方。個人の見え方なので保存しない（Web版と同じ判断）
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
          VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
              StatusPill(status: unit.status)
              if let pages = PageRange.formatUnit(start: unit.pageFrom, end: unit.pageTo) {
                Text(pages).font(.caption.monospaced())
              }
            }
            if let presenter = name(of: unit.presenterId) {
              Text("担当: \(presenter)").font(.caption).foregroundStyle(.secondary)
            }
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
          LogCard(log: thread.root, authorName: name(of: thread.root.authorId))
          // 返信は一段下げて、どれに付いているか分かるようにする
          ForEach(thread.replies) { reply in
            LogCard(log: reply, authorName: name(of: reply.authorId))
              .padding(.leading, 16)
          }
        }
      }
    }
    .navigationTitle(unit.map { "第\($0.order)回　\($0.title)" } ?? "記録")
    .navigationBarTitleDisplayMode(.inline)
    .task {
      unit = try? await units.get(id: unitId)
      memberList = (try? await members.list(bookId: "")) ?? []
      let all = (try? await logs.list(unitId: unitId)) ?? []
      threads = Threads.build(all)
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

  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      HStack(spacing: 6) {
        Text(authorName ?? "不明").font(.caption.weight(.bold))

        // 「指定しない」は札を出さない。本文の横に並べても意味が無い
        if log.type != .none {
          Text(log.type.label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(.orange.opacity(0.15), in: Capsule())
            .foregroundStyle(.orange)
        }

        // 解決したかは疑問にしか無い概念
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
      }

      if let title = log.title {
        Text(title).font(.callout.weight(.semibold))
      }

      // Markdownは AttributedString が解釈する。生のHTMLを描く経路が
      // 無いので、Web版で気を配ったXSSの心配はここでは起きない
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
    // 解釈できない書き方が来ても、素の文字として出す
    (try? AttributedString(
      markdown: markdown,
      options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
      ?? AttributedString(markdown)
  }
}

#Preview {
  NavigationStack {
    UnitScreen(
      unitId: "unit-2", logs: FakeLogRepository(),
      units: FakeUnitRepository(), members: FakeMemberRepository())
  }
}
