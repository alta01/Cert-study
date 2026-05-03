import { Outlet, NavLink } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="app-shell">
      <nav className="nav">
        <NavLink to="/" className="nav-brand">📚 Cert Study</NavLink>
        <NavLink to="/" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Home
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Admin
        </NavLink>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
