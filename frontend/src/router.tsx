import { createBrowserRouter, Navigate } from 'react-router'
import { z } from 'zod'
import { AppShell } from './components/AppShell'
import { BoardPage } from './pages/BoardPage'
import { ProfilePage } from './pages/ProfilePage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { WorkspacePage } from './pages/WorkspacePage'

const routeSchema = z.object({
  path: z.string(),
  label: z.string(),
})

export const appRoutes = [
  { path: '/profile', label: 'Profile' },
  { path: '/search', label: 'Search' },
  { path: '/board', label: 'Board' },
  { path: '/workspace', label: 'Workspace' },
  { path: '/settings', label: 'Settings' },
].map((route) => routeSchema.parse(route))

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/profile" replace /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'board', element: <BoardPage /> },
      { path: 'workspace', element: <WorkspacePage /> },
      { path: 'workspace/:applicationId', element: <WorkspacePage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
