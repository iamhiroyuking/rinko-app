import Foundation
import RinkoCore
import Supabase

/*
 添付画像（`src/repository/attachments.ts` の移植）。

 ■ この層の原則

 **データベースは連鎖するがストレージは連鎖しない。** 記録・回・教材を
 消すときは画像を先に消す。順番を逆にすると、参照だけ失ったファイルが
 容量を食い続ける。しかも参加情報が消えたあとはストレージのポリシーも
 通らなくなり、**本人にすら消せないファイルが残る**（実際に2件残っていて、
 Supabaseのダッシュボードからしか消せない）。

 **パスの先頭が教材idなのが要点。** ストレージのポリシーは行ではなく
 パスに対して書くので、ここから参加者かどうかを判定している
 （supabase/migrations/20260814120000_log_image_storage.sql）。

 **送る前に必ず縮小する。** 無料枠の1GBは利用者ごとではなくアプリ全体で
 共有するため、そのままの写真だと340枚ほどで埋まる。縮小そのものは
 端末側の処理なので、この層は縮小済みの `ImagePayload` を受け取る。
 */
public struct SupabaseAttachmentRepository: AttachmentRepository {
  let connection: Connection

  /// 非公開バケット。ログの画像と教材の表紙が同居している
  private static let bucket = "log-images"

  /// 期限付きURLの有効時間（秒）。
  ///
  /// 長すぎるとURLが漏れたときに読める時間が延び、短すぎると画面を
  /// 開いたままにしている間に画像が切れる。輪講中に開きっぱなしに
  /// することを考えて2時間。切れても再読み込みで直る。
  private static let signedURLSeconds = 2 * 60 * 60

  public init(connection: Connection) {
    self.connection = connection
  }

  private var storage: StorageFileApi {
    connection.client.storage.from(Self.bucket)
  }

  // MARK: - 置く

  /// 縮小済みの画像を保存し、`attachments` に記録する。
  ///
  /// 保存先は `<book_id>/<log_id>/<uuid>.<ext>`。
  ///
  /// 1枚でも失敗したらそこで止めて投げる。記録の本体は既に保存されて
  /// いるので「本文は残ったが画像が付かなかった」状態になりうる。
  public func uploadLogImages(bookId: String, logId: String, images: [ImagePayload]) async throws {
    for image in images {
      let path = "\(bookId)/\(logId)/\(UUID().uuidString.lowercased())-\(image.fileName)"

      do {
        _ = try await storage.upload(
          path, data: image.data,
          options: FileOptions(contentType: image.mimeType)
        )
      } catch {
        throw translate(error)
      }

      // ストレージに置けても記録に残せなければ、辿れないファイルになる。
      // 置いたものを消してから投げる
      do {
        try await connection.client
          .from("attachments")
          .insert([
            "log_id": logId,
            "storage_path": path,
            "file_name": image.fileName,
            "mime_type": image.mimeType,
          ])
          .execute()
      } catch {
        try? await storage.remove(paths: [path])
        throw translate(error)
      }
    }
  }

  /// 表紙を置き、そのパスを返す。
  ///
  /// 記録に残すのは呼び出し側（`BookRepository.setCoverPath`）。教材が
  /// 出来てからでないと置き場所が決まらないので、作成とは分けている。
  public func uploadBookCover(bookId: String, image: ImagePayload) async throws -> String {
    let path = "\(bookId)/cover/\(UUID().uuidString.lowercased())-\(image.fileName)"

    do {
      _ = try await storage.upload(
        path, data: image.data,
        options: FileOptions(contentType: image.mimeType)
      )
      return path
    } catch {
      throw translate(error)
    }
  }

  // MARK: - 読む

  /// 非公開バケットなので、表示のたびに期限付きURLを作る。
  ///
  /// 発行できなかったものは辞書に入らない。呼び出し側は画像の代わりに
  /// ファイル名を出すこと。**1枚の失敗で画面全体を落とさない。**
  public func signedURLs(paths: [String]) async throws -> [String: URL] {
    guard !paths.isEmpty else { return [:] }

    do {
      let signed = try await storage.createSignedURLs(
        paths: paths, expiresIn: Self.signedURLSeconds
      )

      var result: [String: URL] = [:]
      for item in signed {
        // 発行できなかったものは辞書に入らない。呼び出し側は
        // 画像の代わりにファイル名を出す
        guard let url = item.signedURL else { continue }
        result[item.path] = url
      }
      return result
    } catch {
      throw translate(error)
    }
  }

  // MARK: - 消す

  /// その記録に付いている画像を消す。**返信の分も含める。**
  ///
  /// 記録を消すと返信も連鎖して消える（`logs.parent_log_id` の
  /// `on delete cascade`）ので、返信に付いた画像も辿れなくなる。
  public func removeLogImages(logId: String) async throws {
    do {
      let replies: [IdRow] = try await connection.client
        .from("logs")
        .select("id")
        .eq("parent_log_id", value: logId)
        .execute()
        .value

      let logIds = [logId] + replies.map(\.id)
      try await removePaths(matching: "log_id", in: logIds)
    } catch {
      throw translate(error)
    }
  }

  /// その回に付いている画像を消す。回を完全に削除する前に呼ぶ。
  ///
  /// **`logs!inner` が要る。** 無いと `logs` 側の条件が効かず、
  /// 回をまたいで消してしまう。
  public func removeUnitImages(unitId: String) async throws {
    do {
      let rows: [StoragePathRow] = try await connection.client
        .from("attachments")
        .select("storage_path, logs!inner (unit_id)")
        .eq("logs.unit_id", value: unitId)
        .execute()
        .value

      try await remove(paths: rows.map(\.storagePath))
    } catch {
      throw translate(error)
    }
  }

  /// その教材の画像をまとめて消す。
  ///
  /// 呼ぶのは「最後の参加者が抜けるとき」だけ。教材が実際に消えるのは
  /// 参加者がゼロになったときで、誰か残っていればその人の画面には
  /// まだ画像が要る。
  ///
  /// `<book_id>/` の下をまとめて消すので、**表紙も自動で含まれる**。
  public func removeBookImages(bookId: String) async throws {
    do {
      try await remove(paths: listBookImagePaths(bookId: bookId))
    } catch {
      throw translate(error)
    }
  }

  // MARK: - 中で使う

  private struct StoragePathRow: Decodable, Sendable {
    let storagePath: String
    enum CodingKeys: String, CodingKey { case storagePath = "storage_path" }
  }

  private func removePaths(matching column: String, in values: [String]) async throws {
    let rows: [StoragePathRow] = try await connection.client
      .from("attachments")
      .select("storage_path")
      .in(column, values: values)
      .execute()
      .value

    try await remove(paths: rows.map(\.storagePath))
  }

  private func remove(paths: [String]) async throws {
    guard !paths.isEmpty else { return }
    _ = try await storage.remove(paths: paths)
  }

  /// `<book_id>/<log_id>/<file>` の2段になっているので、順にたどる
  private func listBookImagePaths(bookId: String) async throws -> [String] {
    let folders = try await storage.list(path: bookId)

    var paths: [String] = []
    for folder in folders {
      let files = try await storage.list(path: "\(bookId)/\(folder.name)")
      paths.append(contentsOf: files.map { "\(bookId)/\(folder.name)/\($0.name)" })
    }
    return paths
  }
}
