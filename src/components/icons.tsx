/**
 * 画面で使うアイコン。
 *
 * 絵文字をやめてSVGにしてある（#112）。絵文字はOSごとに絵柄が変わり、
 * 色を指定できないので配色（#64）に馴染まず、線の太さも揃わなかった。
 *
 * 決めごとは3つ。
 * - 色は `currentColor`。置いた場所の文字色、つまりCSS変数に追従する
 * - 大きさは `1em`。置いた場所の文字サイズに追従するので、
 *   `.mark-button` や `.book-cover-blank` の font-size をそのまま使える
 * - 線は 24 のグリッドで太さ2。全アイコンで揃える
 *
 * 形は Lucide（MIT）の同名アイコンに倣っている。
 *
 * 既定で `aria-hidden`。意味は隣の文字が持っている前提で、
 * 文字を持たない場所（`SeminarView` の削除ボタンなど）は
 * 呼ぶ側が `aria-label` を付けること。
 */
type IconProps = {
  className?: string
}

const BASE = {
  viewBox: '0 0 24 24',
  width: '1em',
  height: '1em',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export function IconTrash({ className = 'icon' }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

/** しおり。付いているときは塗りつぶして、外からも区別が付くようにする */
export function IconBookmark({
  className = 'icon',
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      {...BASE}
      className={className}
      fill={filled ? 'currentColor' : 'none'}
    >
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function IconImage({ className = 'icon' }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </svg>
  )
}

/** 共有している人数の横に置く */
export function IconUsers({ className = 'icon' }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

/** 表紙が無い教材の代わりに出す */
export function IconBookOpen({ className = 'icon' }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  )
}
