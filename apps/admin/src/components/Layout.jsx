import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { get } from '../lib/api';
import { initials } from '../lib/format';
import logo from '../assets/logo.png';

const NAV = [
  {
    group: 'Pregled',
    items: [
      { to: '/', label: 'Pocetna', icon: '◱', end: true },
      { to: '/prijave', label: 'Prijave', icon: '⊙', badge: 'active' },
    ],
  },
  {
    group: 'Ljudi',
    items: [
      { to: '/korisnici', label: 'Roditelji', icon: '☺' },
      { to: '/deca', label: 'Deca', icon: '✦' },
      { to: '/posete', label: 'Posete', icon: '⇄' },
    ],
  },
  {
    group: 'Ponuda',
    items: [
      { to: '/paketi', label: 'Paketi', icon: '▦' },
      { to: '/rezervacije', label: 'Rezervacije', icon: '✿' },
    ],
  },
  {
    group: 'Sadrzaj',
    items: [
      { to: '/jelovnik', label: 'Jelovnik', icon: '☕' },
      { to: '/raspored', label: 'Raspored', icon: '▤' },
    ],
  },
  {
    group: 'Sistem',
    items: [{ to: '/podesavanja', label: 'Podesavanja', icon: '⚙' }],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeCount, setActiveCount] = useState(0);

  // Broj dece koja su trenutno u igraonici stoji uz "Prijave" - to je jedini
  // podatak koji osoblje mora da vidi bez otvaranja stranice.
  useEffect(() => {
    let alive = true;
    function load() {
      get('/visits/active')
        .then((d) => alive && setActiveCount(d.count || 0))
        .catch(() => {});
    }
    load();
    const timer = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src={logo} alt="Kids club" />
        </div>

        <nav className="nav">
          {NAV.map((section) => (
            <div key={section.group}>
              <div className="nav-group">{section.group}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {item.badge === 'active' && activeCount > 0 && (
                    <span className="nav-badge">{activeCount}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          {/* Tema je jedan klik odavde; puni izbor sa "kao sistem" je u
              Podesavanjima. */}
          <button
            className="btn ghost sm block"
            style={{ justifyContent: 'flex-start', marginBottom: 4 }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Promeni temu"
          >
            <span className="nav-icon">{theme === 'dark' ? '☀' : '☾'}</span>
            {theme === 'dark' ? 'Svetla tema' : 'Tamna tema'}
          </button>

          <div className="me">
            <div className="avatar">{initials(user?.firstName, user?.lastName)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="me-name">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="me-role">{user?.role}</div>
            </div>
          </div>
          <button className="btn secondary block sm" onClick={logout}>
            Odjava
          </button>
        </div>
      </aside>

      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}

// Zaglavlje stranice. Svaka stranica ga sama renderuje da bi mogla da doda
// svoje akcije desno.
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>
      {children && <div className="topbar-actions">{children}</div>}
    </div>
  );
}
