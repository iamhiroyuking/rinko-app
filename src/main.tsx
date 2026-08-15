import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 動作確認用の種まきを、開発時だけコンソールから呼べるようにする。
//
// import.meta.env.DEV は本番ビルドでは false に置き換わるので、この分岐は
// 丸ごと消え、読み込み先の中身もバンドルに入らない。本番に開発用の
// 入り口を作らないための書き方であり、条件を変えるときは
// dist を検索して混入していないことを確かめること。
if (import.meta.env.DEV) {
  void import('./dev/seed').then((module) => module.registerSeedHelpers())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
