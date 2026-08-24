import Foundation

/*
 データの読み書きの輪郭（#147）。

 **中身はまだ無い。** Supabaseに繋ぐ実装は別の型で用意し、
 ここには「何ができるか」だけを置く。理由は3つ。

 1. Web版の76関数を数え上げた設計図になる。移植で漏れたことに
    後から気づくのを防ぐ
 2. 画面を先に組める。**偽の実装を差し込めば、Supabaseが繋がる前から
    SwiftUIを動かせる**
 3. テストで本物のネットワークを使わずに済む

 Web版では `src/repository/` の各ファイルが同じ役割を持っている。関数の名前も
 なるべく揃えてあるので、対応を追いやすい。

 ■ 「集合知」への置き直しで変わるところ

 データの形は変えない（docs/concept.md）。ここで変わるのは**言葉**だけ。
 型の名前は英語のまま（`Book` / `StudyUnit` / `Log`）にしてあり、
 画面に出す日本語だけを差し替えれば済むようにしている。

 輪講に固有なのは `StudyUnit.presenterId` と `StudyUnit.scheduledDate` の2つで、
 どちらも省略できる。ひとりの読書記録では使わない。
 */

// MARK: - 失敗の伝え方

/// 利用者に見せる文言を持つ失敗。
///
/// Web版の `errorMessage()` に当たる。Supabaseの生の文言をそのまま
/// 出すと英語のまま出てしまうので、画面へ渡す前にここで包む。
public struct RinkoError: Error, Sendable {
  public let message: String
  public init(_ message: String) { self.message = message }
}

// MARK: - 認証

public protocol AuthRepository: Sendable {
  func signUp(email: String, password: String, displayName: String) async throws
  func signIn(email: String, password: String) async throws
  func signOut() async throws
  /// 保存されている状態を読む。起動時に一度呼ぶ
  func currentUserId() async throws -> String?
  func sendPasswordReset(email: String) async throws
  func updatePassword(_ newPassword: String) async throws

  /// アカウントを削除する（#145）。
  ///
  /// **記録は残り、投稿者は「退会したユーザー」になる。** 共有相手の
  /// 画面から議論が消えないようにするため。App Storeのガイドライン
  /// 5.1.1(v) が求める要件でもある。
  func deleteMyAccount() async throws
}

// MARK: - 本棚

/// 本棚での置き方。**その人だけの状態**で、共有相手には影響しない
public enum ShelfStatus: String, Sendable, CaseIterable {
  case planned, reading, finished

  public var label: String {
    switch self {
    case .planned: "学習予定"
    case .reading: "学習中"
    case .finished: "学習完了"
    }
  }
}

public struct ShelfBook: Sendable, Identifiable {
  public let id: String
  public let title: String
  public let coverStoragePath: String?
  public let shelfStatus: ShelfStatus
  /// 自分を含む参加者の数。2人以上なら共有されている
  public let memberCount: Int

  public init(
    id: String, title: String, coverStoragePath: String?,
    shelfStatus: ShelfStatus, memberCount: Int
  ) {
    self.id = id
    self.title = title
    self.coverStoragePath = coverStoragePath
    self.shelfStatus = shelfStatus
    self.memberCount = memberCount
  }
}

public protocol BookRepository: Sendable {
  /// **自分の参加情報だけに絞ること。** 行レベルセキュリティは
  /// 「見てよいもの」を決めるだけで「欲しいもの」は決めない。
  /// Web版はここを忘れて本棚が重複した
  func listShelf(status: ShelfStatus) async throws -> [ShelfBook]
  func countShelf(status: ShelfStatus) async throws -> Int
  func get(id: String) async throws -> Book?
  /// その教材に対する「自分の」参加情報。共有相手のものは含めない
  func getMyShelfEntry(id: String) async throws -> MyShelfEntry?
  func create(title: String, goal: String?) async throws -> String
  func update(id: String, title: String, goal: String?) async throws
  func updateShelfStatus(id: String, status: ShelfStatus) async throws
  func setCoverPath(id: String, path: String?) async throws

  /// ゴミ箱へ。**自分の本棚から消えるだけで、共有相手には残る**
  func trash(id: String) async throws
  func restore(id: String) async throws
  /// 参加者が全員消したときに、配下ごと消える
  func permanentlyDelete(id: String) async throws
  func listTrashed() async throws -> [TrashedBook]
}

/// その教材に対する「自分の」参加情報
public struct MyShelfEntry: Sendable {
  public let shelfStatus: ShelfStatus
  /// この教材に参加した日時。学習開始日として表示する
  public let joinedAt: String

  public init(shelfStatus: ShelfStatus, joinedAt: String) {
    self.shelfStatus = shelfStatus
    self.joinedAt = joinedAt
  }
}

public struct Book: Sendable, Identifiable {
  public let id: String
  public let title: String
  public let goal: String?
  public let coverStoragePath: String?
  public let createdBy: String

  public init(
    id: String, title: String, goal: String?,
    coverStoragePath: String?, createdBy: String
  ) {
    self.id = id
    self.title = title
    self.goal = goal
    self.coverStoragePath = coverStoragePath
    self.createdBy = createdBy
  }
}

public struct TrashedBook: Sendable, Identifiable {
  public let id: String
  public let title: String
  public let deletedAt: String

  public init(id: String, title: String, deletedAt: String) {
    self.id = id
    self.title = title
    self.deletedAt = deletedAt
  }
}

// MARK: - 回

public protocol UnitRepository: Sendable {
  func list(bookId: String) async throws -> [StudyUnit]
  func get(id: String) async throws -> StudyUnit?
  func create(_ input: NewUnit) async throws -> String
  func update(id: String, _ input: NewUnit) async throws
  func updatePages(id: String, from: Int?, to: Int?, startNote: String?) async throws
  func updateStatus(id: String, status: UnitStatus) async throws

  /// **削除・復元できるのは作成者だけ。** データベース側のトリガーが
  /// 拒むので、画面はボタンを隠すだけでよい
  func trash(id: String) async throws
  func restore(id: String) async throws
  func permanentlyDelete(id: String) async throws
  func listMyTrashed() async throws -> [TrashedUnit]
}

public struct NewUnit: Sendable {
  public let bookId: String
  public let title: String
  public let objective: String?
  /// 輪講のときだけ使う。ひとりの読書記録では nil
  public let presenterId: String?
  /// 同上
  public let scheduledDate: String?
  public let pageFrom: Int?
  public let pageTo: Int?
  public let startNote: String?

  public init(
    bookId: String, title: String, objective: String? = nil,
    presenterId: String? = nil, scheduledDate: String? = nil,
    pageFrom: Int? = nil, pageTo: Int? = nil, startNote: String? = nil
  ) {
    self.bookId = bookId
    self.title = title
    self.objective = objective
    self.presenterId = presenterId
    self.scheduledDate = scheduledDate
    self.pageFrom = pageFrom
    self.pageTo = pageTo
    self.startNote = startNote
  }
}

public struct TrashedUnit: Sendable, Identifiable {
  public let id: String
  public let bookId: String
  public let bookTitle: String
  public let order: Int
  public let title: String
  public let deletedAt: String

  public init(
    id: String, bookId: String, bookTitle: String,
    order: Int, title: String, deletedAt: String
  ) {
    self.id = id
    self.bookId = bookId
    self.bookTitle = bookTitle
    self.order = order
    self.title = title
    self.deletedAt = deletedAt
  }
}

// MARK: - 記録

public protocol LogRepository: Sendable {
  /// 返信も含めて平らに返す。スレッドに組むのは `Threads.build`
  func list(unitId: String) async throws -> [LogEntry]
  func get(id: String) async throws -> LogEntry?
  func create(_ input: NewLog) async throws -> String
  func update(id: String, _ input: NewLog) async throws
  func updatePages(id: String, start: Int?, end: Int?) async throws
  /// 疑問を解決済みにする／戻す。押せるのは投稿者だけ
  func setResolved(id: String, resolved: Bool) async throws
  /// 返信も連鎖して消える。取り消せない
  func delete(id: String) async throws

  func countInBook(bookId: String) async throws -> Int
  func countUnresolvedQuestions(bookId: String) async throws -> Int
}

public struct NewLog: Sendable {
  public let unitId: String
  public let type: LogType
  public let title: String?
  public let body: String
  public let pageStart: Int?
  public let pageEnd: Int?
  public let tagNames: [String]
  /// 返信のときだけ入る
  public let parentLogId: String?

  public init(
    unitId: String, type: LogType = .none, title: String? = nil,
    body: String, pageStart: Int? = nil, pageEnd: Int? = nil,
    tagNames: [String] = [], parentLogId: String? = nil
  ) {
    self.unitId = unitId
    self.type = type
    self.title = title
    self.body = body
    self.pageStart = pageStart
    self.pageEnd = pageEnd
    self.tagNames = tagNames
    self.parentLogId = parentLogId
  }
}

// MARK: - 探す

public protocol SearchRepository: Sendable {
  /// **全件取ってから手元で絞る。** 日本語は単語に切れないので
  /// どのみち部分一致になり、対象が3か所（タイトル・本文・タグ）に
  /// またがるため。件数が増えたらデータベース側の関数に寄せる
  func listSearchable(bookId: String) async throws -> [SearchableLog]
}

public struct SearchableLog: Sendable, Identifiable {
  public let id: String
  public let unitId: String
  public let unitOrder: Int
  public let unitTitle: String
  public let authorId: String
  public let title: String?
  public let body: String
  public let type: LogType
  public let resolvedAt: String?
  public let tagNames: [String]
  public let createdAt: String
  public let attachmentCount: Int

  public init(
    id: String, unitId: String, unitOrder: Int, unitTitle: String,
    authorId: String, title: String?, body: String, type: LogType,
    resolvedAt: String?, tagNames: [String], createdAt: String,
    attachmentCount: Int
  ) {
    self.id = id
    self.unitId = unitId
    self.unitOrder = unitOrder
    self.unitTitle = unitTitle
    self.authorId = authorId
    self.title = title
    self.body = body
    self.type = type
    self.resolvedAt = resolvedAt
    self.tagNames = tagNames
    self.createdAt = createdAt
    self.attachmentCount = attachmentCount
  }
}

// MARK: - 共有

public enum InviteRole: String, Sendable {
  case editor, viewer

  public var label: String {
    switch self {
    case .editor: "書き込める"
    case .viewer: "見るだけ"
    }
  }
}

public protocol InviteRepository: Sendable {
  func token(bookId: String, role: InviteRole) async throws -> String?
  func issue(bookId: String, role: InviteRole) async throws -> String
  /// 配ったリンクが外へ流れたときに止める。既に参加した人は残る
  func revoke(bookId: String, role: InviteRole) async throws

  /// **一度の挿入で済ませること。** 「調べてから入れる」形にすると、
  /// 同じ人が二度開いたときに重複キーで落ちる
  func join(token: String) async throws -> String
}

public struct BookMember: Sendable, Identifiable {
  public let id: String
  public let displayName: String
  public let role: InviteRole

  public init(id: String, displayName: String, role: InviteRole) {
    self.id = id
    self.displayName = displayName
    self.role = role
  }
}

public protocol MemberRepository: Sendable {
  func list(bookId: String) async throws -> [BookMember]
}

// MARK: - しおり

/// **個人のもの。共有相手には見えない**
public protocol MarkRepository: Sendable {
  func listMine(logIds: [String]) async throws -> Set<String>
  func listMineInBook(bookId: String) async throws -> Set<String>
  func add(logId: String) async throws
  func remove(logId: String) async throws
}

// MARK: - 添付

public protocol AttachmentRepository: Sendable {
  /// **送る前に必ず縮小する。** 無料枠の1GBは利用者ごとではなく
  /// アプリ全体で共有するので、そのままの写真だと数百枚で埋まる
  func uploadLogImages(bookId: String, logId: String, images: [ImagePayload]) async throws
  func uploadBookCover(bookId: String, image: ImagePayload) async throws -> String
  /// 非公開バケットなので、表示のたびに期限付きURLを作る
  func signedURLs(paths: [String]) async throws -> [String: URL]

  /// **データベースは連鎖するがストレージは連鎖しない。**
  /// 記録・回・教材を消すときは、画像を先に消す
  func removeLogImages(logId: String) async throws
  func removeUnitImages(unitId: String) async throws
  func removeBookImages(bookId: String) async throws
}

/// 縮小済みの画像。縮小そのものは端末側の処理なので、この層は結果だけ受け取る
public struct ImagePayload: Sendable {
  public let data: Data
  public let fileName: String
  public let mimeType: String

  public init(data: Data, fileName: String, mimeType: String) {
    self.data = data
    self.fileName = fileName
    self.mimeType = mimeType
  }
}

// MARK: - 動き

public struct UpcomingUnit: Sendable, Identifiable {
  public var id: String { unitId }
  public let bookId: String
  public let bookTitle: String
  public let unitId: String
  public let order: Int
  public let title: String
  public let scheduledDate: String?
  public let presenterName: String?
  /// 自分が担当か。準備が要る側なので目立たせる
  public let isMine: Bool

  public init(
    bookId: String, bookTitle: String, unitId: String, order: Int,
    title: String, scheduledDate: String?, presenterName: String?,
    isMine: Bool
  ) {
    self.bookId = bookId
    self.bookTitle = bookTitle
    self.unitId = unitId
    self.order = order
    self.title = title
    self.scheduledDate = scheduledDate
    self.presenterName = presenterName
    self.isMine = isMine
  }
}

public protocol ActivityRepository: Sendable {
  /// 教材ごとの新着の数。**自分の書き込みは数えない**
  func countNewLogs() async throws -> [String: Int]
  func countNewLogsByUnit(bookId: String) async throws -> [String: Int]
  /// **数えてから呼ぶこと。** 先に見たことにすると、何が新しかったかを
  /// 出せないまま印が消える
  func markSeen(bookId: String) async throws
  /// 教材をまたいだ「次にやること」
  func listUpcoming() async throws -> [UpcomingUnit]
}
