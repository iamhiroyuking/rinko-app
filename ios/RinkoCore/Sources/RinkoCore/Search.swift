import Foundation

/// 絞り込みの条件。どれも省けば、その軸では絞らない
public struct SearchCriteria: Sendable {
  public var query: String
  /// 記録の種類。空なら種類で絞らない
  public var types: [LogType]
  /// 渡すと、しおりの付いたものだけに絞る
  public var markedIds: Set<String>?
  /// 未解決の疑問だけ
  public var unresolvedOnly: Bool

  public init(
    query: String = "",
    types: [LogType] = [],
    markedIds: Set<String>? = nil,
    unresolvedOnly: Bool = false
  ) {
    self.query = query
    self.types = types
    self.markedIds = markedIds
    self.unresolvedOnly = unresolvedOnly
  }
}

/// どこに一致したか。結果の見せ方を変えるために持つ
public enum MatchedIn: Sendable, Equatable {
  case title, body, tag
}

public struct SearchHit: Sendable, Identifiable {
  public let log: SearchableLog
  public let matchedIn: [MatchedIn]
  public var id: String { log.id }
}

/// 記録を探す。`src/repository/search.ts` から移した。
public enum Search {

  /// 3つの軸をまとめて扱う。
  ///
  /// タイトル・本文・タグを対象に、大文字小文字を区別しない部分一致。
  /// 返信も対象に含まれる。並び順は回の順、同じ回の中では古い順。
  ///
  /// **条件が1つも無いときは何も返さない。** 全件を出しても
  /// 探したことにならないため。
  ///
  /// **種類はOR、未解決はAND。** この2つは噛み合わないので、画面では
  /// 同時に選べないようにしてある。ここへ矛盾した組み合わせが渡って
  /// きたら、黙って広げずに空を返す。
  public static func filter(
    _ logs: [SearchableLog],
    _ criteria: SearchCriteria
  ) -> [SearchHit] {
    let needle = criteria.query
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .lowercased()

    let byKeyword = !needle.isEmpty
    let byType = !criteria.types.isEmpty
    let byMark = criteria.markedIds != nil
    let byUnresolved = criteria.unresolvedOnly

    guard byKeyword || byType || byMark || byUnresolved else { return [] }

    var hits: [SearchHit] = []

    for log in logs {
      if let marked = criteria.markedIds, !marked.contains(log.id) { continue }
      if byType, !criteria.types.contains(log.type) { continue }
      // 未解決は疑問にしか無い概念。種類も一緒に見る
      if byUnresolved, !(log.type == .question && log.resolvedAt == nil) { continue }

      var matchedIn: [MatchedIn] = []
      if byKeyword {
        if log.title?.lowercased().contains(needle) == true { matchedIn.append(.title) }
        if log.body.lowercased().contains(needle) { matchedIn.append(.body) }
        if log.tagNames.contains(where: { $0.lowercased().contains(needle) }) {
          matchedIn.append(.tag)
        }
        if matchedIn.isEmpty { continue }
      }

      hits.append(SearchHit(log: log, matchedIn: matchedIn))
    }

    return hits.sorted { a, b in
      if a.log.unitOrder != b.log.unitOrder {
        return a.log.unitOrder < b.log.unitOrder
      }
      return a.log.createdAt < b.log.createdAt
    }
  }

  /// よく使われているハッシュタグを多い順に返す。
  /// 同数なら名前の順にして、読み込むたびに並びが揺れないようにする。
  public static func topTags(_ logs: [SearchableLog], limit: Int = 10) -> [String] {
    var counts: [String: Int] = [:]
    for log in logs {
      for name in log.tagNames { counts[name, default: 0] += 1 }
    }

    return counts
      .sorted { a, b in
        a.value != b.value ? a.value > b.value : a.key < b.key
      }
      .prefix(limit)
      .map(\.key)
  }
}

/// 「次にやること」の並べ替え。`src/repository/activity.ts` から移した。
public enum Upcoming {

  /// 近い順に並べる。
  ///
  /// 日程が決まっているものが先。決まっていないものは「いつやるか未定」
  /// なので後ろへ置く。同着は書名で固定して並びを揺らさない。
  public static func sort(_ items: [UpcomingUnit]) -> [UpcomingUnit] {
    items.sorted { a, b in
      switch (a.scheduledDate, b.scheduledDate) {
      case let (da?, db?):
        return da != db ? da < db : a.bookTitle < b.bookTitle
      case (_?, nil):
        return true
      case (nil, _?):
        return false
      case (nil, nil):
        return a.bookTitle < b.bookTitle
      }
    }
  }
}

/// ハッシュタグの入力を解く。`src/repository/tags.ts` から移した。
public enum Tags {

  /// 空白かカンマで区切る。前後の `#` は取り、重複と空は落とす。
  ///
  /// **表記揺れで検索が壊れるのを防ぐのがタグの役目**なので、
  /// ここで形を揃えておく。
  public static func parse(_ input: String) -> [String] {
    // `#` は前置きではなく**区切り**として扱う。TypeScript版が
    // `[\s,、#]+` で分けており、`#正則化#過学習` が2つのタグになる
    var separators = CharacterSet.whitespacesAndNewlines
    separators.insert(charactersIn: ",、#")

    var seen = Set<String>()
    var result: [String] = []

    for raw in input.components(separatedBy: separators) {
      let name = raw.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !name.isEmpty, !seen.contains(name) else { continue }
      seen.insert(name)
      result.append(name)
    }

    return result
  }
}
