import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  onClose: () => void
  children: ReactNode
}

/**
 * 汎用のモーダル。ネイティブの `<dialog>` を使う。
 *
 * `showModal()` を呼ぶ理由は2つ。フォーカストラップ（Tabで外に出ない）と
 * Escキーでの close が標準で効く。自前で実装すると必ずどちらかが漏れる。
 *
 * 背景（::backdrop）のクリックでも閉じる。`<dialog>` はクリックされた
 * 要素で backdrop かどうかを判定できないため、`e.target === dialog` で
 * 自分自身（＝中身の外）がクリックされたかを見ている。
 */
export default function Modal({ onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="modal"
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="modal-content">{children}</div>
    </dialog>
  )
}
