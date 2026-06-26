import { createBrowserRouter, Navigate } from 'react-router'
import { z } from 'zod'
import { AppShell } from './components/AppShell'
import { BoardPage } from './pages/BoardPage'
import { HomePage } from './pages/HomePage'
import { ProfilePage } from './pages/ProfilePage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { WorkspacePage } from './pages/WorkspacePage'

const routeSchema = z.object({
  path: z.string(),
  label: z.string(),
})

export const appRoutes = [
  { path: '/', label: 'Home' },
  { path: '/profile', label: 'Profile' },
  { path: '/search', label: 'Search' },
  { path: '/board', label: 'Board' },
  { path: '/settings', label: 'Settings' },
].map((route) => routeSchema.parse(route))

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'board', element: <BoardPage /> },
      // Workspace is contextual — opened from a saved card or a search result.
      { path: 'workspace', element: <Navigate to="/board" replace /> },
      { path: 'workspace/:applicationId', element: <WorkspacePage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
