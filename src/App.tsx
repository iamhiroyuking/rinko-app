import { BrowserRouter, Route, Routes } from 'react-router-dom'
import SessionProvider from './auth/SessionProvider'
import LoginView from './screens/LoginView'
import HomeView from './screens/HomeView'
import AddBookView from './screens/AddBookView'
import BookSummaryView from './screens/BookSummaryView'
import SeminarView from './screens/SeminarView'
import CreateUnitView from './screens/CreateUnitView'
import UnitView from './screens/UnitView'
import AddLogView from './screens/AddLogView'
import SearchView from './screens/SearchView'
import TrashView from './screens/TrashView'

/**
 * URLと画面の対応表。
 * `:bookId` のようにコロンが付いた部分は可変で、画面側から値を取り出せる。
 */
export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="/" element={<HomeView />} />
          <Route path="/books/new" element={<AddBookView />} />
          <Route path="/books/:bookId" element={<BookSummaryView />} />
          <Route path="/books/:bookId/units" element={<SeminarView />} />
          <Route path="/books/:bookId/units/new" element={<CreateUnitView />} />
          <Route path="/books/:bookId/units/:unitId" element={<UnitView />} />
          <Route
            path="/books/:bookId/units/:unitId/logs/new"
            element={<AddLogView />}
          />
          <Route path="/books/:bookId/search" element={<SearchView />} />
          <Route path="/trash" element={<TrashView />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
