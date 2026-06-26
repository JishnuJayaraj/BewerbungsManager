import { NavLink, Outlet } from 'react-router'
import { ApiStatus } from './ApiStatus'
import { PrivacyNotice } from './PrivacyNotice'

const primaryNav = [
  { to: '/profile', label: 'Profile' },
  { to: '/search', label: 'Search' },
  { to: '/board', label: 'Board' },
  { to: '/workspace', label: 'Workspace' },
]

export function AppShell() {
  return (
    <div className="app-frame">
      <header className="app-header">
        <div>
          <p className="brand-kicker">JobCraft</p>
          <h1 className="brand-title">Application package workspace</h1>
        </div>
        <nav className="top-nav" aria-label="Primary">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/settings"
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
          >
            Settings
          </NavLink>
        </nav>
      </header>

      <PrivacyNotice />

      <main className="app-main">
        <Outlet />
      </main>

      <ApiStatus />
    </div>
  )
}
