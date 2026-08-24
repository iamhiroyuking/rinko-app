import RinkoCore
import SwiftUI

/*
 記録を探す。Web版の `SearchView` に当たる。

 絞り込みそのものは `RinkoCore` の `Search.filter` に任せる（純粋関数、
 テスト済み）。この画面はキーワード・種類・未解決・しおりの4つを
 State で持ち、結果を並べるだけ。

 教材をまたいだ検索、発言者や期間での絞り込みは行わない（要件どおり）。
 */

struct SearchScreen: View {
  let bookId: String
  let repositories: AppRepositories

  @State private var all: [SearchableLog] = []
  @State private var markedIds: Set<String> = []
  @State private var query = ""
  @State private var selectedTypes: Set<LogType> = []
  @State private var unresolvedOnly = false
  @State private var markedOnly = false
  @State private var errorMessage: String?

  /// 絞り込みに出す種類。「指定しない」は入れない。付けていない記録が
  /// 最も多く、それで絞っても探した気にならない
  private static let filterableTypes: [LogType] = [.preview, .question, .review]

  private var criteria: SearchCriteria {
    SearchCriteria(
      query: query,
      types: Array(selectedTypes),
      markedIds: markedOnly ? markedIds : nil,
      unresolvedOnly: unresolvedOnly
    )
  }

  private var hits: [SearchHit] { Search.filter(all, criteria) }
  private var topTags: [String] { Search.topTags(all) }

  var body: some View {
    List {
      Section {
        TextField("キーワードで探す", text: $query)
          .textInputAutocapitalization(.never)

        if !topTags.isEmpty {
          ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
              ForEach(topTags, id: \.self) { tag in
                Button {
                  query = tag
                } label: {
                  Text("#\(tag)")
                    .font(.caption2)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(.green.opacity(0.12), in: Capsule())
                    .foregroundStyle(.green)
                }
                .buttonStyle(.plain)
              }
            }
          }
        }

        ScrollView(.horizontal, showsIndicators: false) {
          HStack(spacing: 6) {
            ForEach(Self.filterableTypes, id: \.self) { type in
              FilterChip(label: type.label, isOn: selectedTypes.contains(type)) {
                if selectedTypes.contains(type) {
                  selectedTypes.remove(type)
                } else {
                  selectedTypes.insert(type)
                }
              }
            }
            FilterChip(label: "未解決の疑問", isOn: unresolvedOnly) {
              unresolvedOnly.toggle()
            }
            FilterChip(label: "しおり付き", isOn: markedOnly) {
              markedOnly.toggle()
            }
          }
        }
      }

      if hits.isEmpty {
        Section {
          Text(query.isEmpty && selectedTypes.isEmpty && !unresolvedOnly && !markedOnly
            ? "キーワードか絞り込みを指定してください"
            : "見つかりませんでした")
            .foregroundStyle(.secondary)
        }
      } else {
        ForEach(hits) { hit in
          NavigationLink {
            UnitScreen(bookId: bookId, unitId: hit.log.unitId, repositories: repositories)
          } label: {
            HitRow(hit: hit)
          }
        }
      }
    }
    .navigationTitle("検索")
    .navigationBarTitleDisplayMode(.inline)
    .task {
      do {
        all = try await repositories.search.listSearchable(bookId: bookId)
        markedIds = try await repositories.marks.listMineInBook(bookId: bookId)
      } catch {
        errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
      }
    }
    .alert("エラー", isPresented: .constant(errorMessage != nil)) {
      Button("閉じる") { errorMessage = nil }
    } message: {
      Text(errorMessage ?? "")
    }
  }
}

private struct FilterChip: View {
  let label: String
  let isOn: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Text(label)
        .font(.caption2.weight(.semibold))
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(isOn ? Color.accentColor : Color(.tertiarySystemFill), in: Capsule())
        .foregroundStyle(isOn ? .white : .primary)
    }
    .buttonStyle(.plain)
  }
}

private struct HitRow: View {
  let hit: SearchHit

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      HStack(spacing: 6) {
        Text("第\(hit.log.unitOrder)回").font(.caption).foregroundStyle(.secondary)
        if hit.log.type != .none {
          Text(hit.log.type.label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(.orange.opacity(0.15), in: Capsule())
            .foregroundStyle(.orange)
        }
      }

      if let title = hit.log.title {
        Text(title).font(.callout.weight(.semibold))
      }

      Text(hit.log.body.prefix(120))
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(2)

      if !hit.log.tagNames.isEmpty {
        Text(hit.log.tagNames.map { "#\($0)" }.joined(separator: " "))
          .font(.caption2)
          .foregroundStyle(.green)
      }
    }
    .padding(.vertical, 2)
  }
}

#Preview {
  NavigationStack {
    SearchScreen(bookId: "book-prml", repositories: .preview)
  }
}
