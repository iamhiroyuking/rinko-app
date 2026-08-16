import { BrowserRouter, Route, Routes } from 'react-router-dom'
import SessionProvider from './auth/SessionProvider'
import RequireLogin from './auth/RequireLogin'
import LoginView from './screens/LoginView'
import ForgotPasswordView from './screens/ForgotPasswordView'
import ResetPasswordView from './screens/ResetPasswordView'
import HomeView from './screens/HomeView'
import AddBookView from './screens/AddBookView'
import JoinBookView from './screens/JoinBookView'
import BookSummaryView from './screens/BookSummaryView'
import SeminarView from './screens/SeminarView'
import CreateUnitView from './screens/CreateUnitView'
import UnitView from './screens/UnitView'
import AddLogView from './screens/AddLogView'
import SearchView from './screens/SearchView'
import TrashView from './screens/TrashView'

/**
 * URLと画面の対応表。
 *
 * `:bookId` のようにコロンが付いた部分は可変で、画面側から値を取り出せる。
 * ログイン画面以外はすべて RequireLogin の内側に置く。こうしておくと
 * 画面を足すときに保護を書き忘れても、外側に出さない限り守られる。
 */
export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          {/* パスワード再設定は関門の外に置く。メールのリンクから来たときに
              鍵の読み取りが終わる前に未ログインと判断されないようにするため */}
          <Route path="/forgot-password" element={<ForgotPasswordView />} />
          <Route path="/reset-password" element={<ResetPasswordView />} />

          <Route element={<RequireLogin />}>
            <Route path="/" element={<HomeView />} />
            <Route path="/books/new" element={<AddBookView />} />
            {/* 招待リンクの行き先。関門の内側なので、未ログインなら
                ログイン画面へ送られ、ログイン後にここへ戻ってくる */}
            <Route path="/join/:token" element={<JoinBookView />} />
            <Route path="/books/:bookId" element={<BookSummaryView />} />
            {/* 追加と同じ画面。bookId があるかどうかで新規と編集を分けている */}
            <Route path="/books/:bookId/edit" element={<AddBookView />} />
            <Route path="/books/:bookId/units" element={<SeminarView />} />
            <Route
              path="/books/:bookId/units/new"
              element={<CreateUnitView />}
            />
            <Route path="/books/:bookId/units/:unitId" element={<UnitView />} />
            {/* 作成と同じ画面。unitId があるかどうかで新規と編集を分けている */}
            <Route
              path="/books/:bookId/units/:unitId/edit"
              element={<CreateUnitView />}
            />
            <Route
              path="/books/:bookId/units/:unitId/logs/new"
              element={<AddLogView />}
            />
            {/* 投稿と同じ画面。logId があるかどうかで新規と編集を分けている */}
            <Route
              path="/books/:bookId/units/:unitId/logs/:logId/edit"
              element={<AddLogView />}
            />
            <Route path="/books/:bookId/search" element={<SearchView />} />
            <Route path="/trash" element={<TrashView />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
