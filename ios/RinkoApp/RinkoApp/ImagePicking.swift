import PhotosUI
import RinkoCore
import SwiftUI
import UIKit

/*
 選んだ写真を送る前に縮小する。`src/lib/image.ts` の移植。

 板書やノートの写真をそのまま上げると1枚3MB前後になる。Supabaseの無料枠は
 ストレージ1GBで、しかも利用者ごとではなくアプリ全体で共有するため、
 そのままでは数百枚で埋まる。長辺を落とすとその何倍も入る。

 iOS側は PHPickerViewController（`PhotosPicker`）経由なので、Web版が
 気にしていたHEICの読める/読めない問題は起きない。`UIImage(data:)` が
 端末のデコーダを直接使うため。
 */
enum ImageResize {
  static let logMaxEdge: CGFloat = 1600
  static let coverMaxEdge: CGFloat = 800
  static let jpegQuality: CGFloat = 0.8

  /// 長辺を上限まで落とし、JPEGにして返す
  static func shrink(_ data: Data, maxEdge: CGFloat) -> ImagePayload? {
    guard let image = UIImage(data: data) else { return nil }

    let scale = min(1, maxEdge / max(image.size.width, image.size.height))
    let targetSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)

    let renderer = UIGraphicsImageRenderer(size: targetSize)
    let resized = renderer.image { _ in
      image.draw(in: CGRect(origin: .zero, size: targetSize))
    }

    guard let jpeg = resized.jpegData(compressionQuality: jpegQuality) else { return nil }
    return ImagePayload(data: jpeg, fileName: "\(UUID().uuidString).jpg", mimeType: "image/jpeg")
  }
}

/// `PhotosPicker` から選んだ1枚を読み込み、縮小するところまでを1つにまとめたもの
struct CoverPicker: View {
  @Binding var payload: ImagePayload?
  @Binding var previewImage: UIImage?

  @State private var selection: PhotosPickerItem?

  var body: some View {
    PhotosPicker(selection: $selection, matching: .images) {
      if let previewImage {
        Image(uiImage: previewImage)
          .resizable()
          .scaledToFill()
          .frame(width: 88, height: 116)
          .clipShape(RoundedRectangle(cornerRadius: 8))
      } else {
        VStack(spacing: 4) {
          Image(systemName: "photo.badge.plus")
            .font(.title2)
          Text("表紙を選ぶ").font(.caption2)
        }
        .frame(width: 88, height: 116)
        .foregroundStyle(.secondary)
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 8))
      }
    }
    .onChange(of: selection) { _, newValue in
      Task { await load(newValue) }
    }
  }

  private func load(_ item: PhotosPickerItem?) async {
    guard let item, let data = try? await item.loadTransferable(type: Data.self) else { return }
    guard let shrunk = ImageResize.shrink(data, maxEdge: ImageResize.coverMaxEdge) else { return }
    payload = shrunk
    previewImage = UIImage(data: shrunk.data)
  }
}
