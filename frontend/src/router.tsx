import { createBrowserRouter, Navigate, Outlet } from 'react-router'
import { z } from 'zod'
import { BoardPage } from './pages/BoardPage'
import { ProfilePage } from './pages/ProfilePage'
import { SearchPage } from './pages/SearchPage'

const routeSchema = z.object({
  path: z.string(),
  label: z.string(),
})

export const appRoutes = [
  { path: '/profile', label: 'Profile' },
  { path: '/search', label: 'Search' },
  { path: '/board', label: 'Board' },
].map((route) => routeSchema.parse(route))

function AppShell() {
  return (
    <main className="app-shell">
      <Outlet />
    </main>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/profile" replace /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'board', element: <BoardPage /> },
    ],
  },
])
