import Foundation

/*
 データの形。`src/repository/` の型から移した。

 **Supabaseの行そのものではない。** 画面が扱う形に直したもので、
 変換はデータ取得層の仕事（TypeScript版の `toLogEntry` に当たる）。
 ここを分けておくと、この層はネットワークを知らずに済み、テストが速い。

 日付は `String` のまま持っている。TypeScript版が ISO8601 の文字列を
 そのまま並べ替えに使っており、**文字列比較で時系列順になる**ことに
 依存した箇所がある（`sortThreadsByPage` など）。Date に変換すると
 その等価性が崩れるので、移植の第一段階では形を合わせておく。
 */

public enum LogType: String, Sendable, CaseIterable {
  case none
  case preview
  case question
  case review

  /// 画面に出す名前。`none` は選択欄にしか出ない
  public var label: String {
    switch self {
    case .none: "指定しない"
    case .preview: "予習メモ"
    case .question: "疑問"
    case .review: "復習"
    }
  }
}

public struct LogEntry: Sendable, Identifiable, Equatable {
  public let id: String
  public let authorId: String
  public let parentLogId: String?
  public let type: LogType
  public let title: String?
  public let body: String
  public let pageStart: Int?
  public let pageEnd: Int?
  public let createdAt: String
  /// 疑問が解決した時刻。nil は「未解決」または「疑問ではない」
  public let resolvedAt: String?
  public let tagNames: [String]

  public init(
    id: String,
    authorId: String,
    parentLogId: String? = nil,
    type: LogType = .none,
    title: String? = nil,
    body: String = "",
    pageStart: Int? = nil,
    pageEnd: Int? = nil,
    createdAt: String,
    resolvedAt: String? = nil,
    tagNames: [String] = []
  ) {
    self.id = id
    self.authorId = authorId
    self.parentLogId = parentLogId
    self.type = type
    self.title = title
    self.body = body
    self.pageStart = pageStart
    self.pageEnd = pageEnd
    self.createdAt = createdAt
    self.resolvedAt = resolvedAt
    self.tagNames = tagNames
  }

  /// 未解決の疑問か。種類と合わせて見ないと判断できない
  public var isUnresolvedQuestion: Bool {
    type == .question && resolvedAt == nil
  }
}

/// 親の記録と、それに付いた返信
public struct LogThread: Sendable, Equatable {
  public let root: LogEntry
  public let replies: [LogEntry]
}

public enum UnitStatus: String, Sendable, CaseIterable {
  case notStarted = "not_started"
  case inProgress = "in_progress"
  case done

  public var label: String {
    switch self {
    case .notStarted: "未着手"
    case .inProgress: "進行中"
    case .done: "完了"
    }
  }
}

public struct StudyUnit: Sendable, Identifiable, Equatable {
  public let id: String
  public let order: Int
  public let title: String
  public let status: UnitStatus
  public let presenterId: String?
  public let scheduledDate: String?
  public let pageFrom: Int?
  public let pageTo: Int?

  public init(
    id: String,
    order: Int,
    title: String = "",
    status: UnitStatus = .notStarted,
    presenterId: String? = nil,
    scheduledDate: String? = nil,
    pageFrom: Int? = nil,
    pageTo: Int? = nil
  ) {
    self.id = id
    self.order = order
    self.title = title
    self.status = status
    self.presenterId = presenterId
    self.scheduledDate = scheduledDate
    self.pageFrom = pageFrom
    self.pageTo = pageTo
  }
}

public struct UnitProgress: Sendable, Equatable {
  public let done: Int
  public let total: Int
  public let percent: Int
}
