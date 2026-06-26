import { NavLink, Outlet } from 'react-router'
import { ApiStatus } from './ApiStatus'
import { PrivacyNotice } from './PrivacyNotice'

const primaryNav = [
  { to: '/', label: 'Home', end: true },
  { to: '/profile', label: 'Profile', end: false },
  { to: '/search', label: 'Search', end: false },
  { to: '/board', label: 'Board', end: false },
]

export function AppShell() {
  return (
    <div className="app-frame">
      <header className="app-header">
        <NavLink to="/" className="brand-link" end>
          <p className="brand-kicker">JobCraft</p>
          <h1 className="brand-title">Craft your application</h1>
        </NavLink>
        <nav className="top-nav" aria-label="Primary">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
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
