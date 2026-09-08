import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useActiveVisits } from '../hooks/useActiveVisits';
import Notifications from './Notifications';
import { Confirm } from './ui';
import { initials } from '../lib/format';
import logo from '../assets/logo.png';

// Viljuska i noz. Kao i zvonce, crtez umesto znaka iz fonta - jedina jela u
// Unicode-u su emoji, pa bi ikonica bila u boji i ne bi slusala temu.
function IkonaJelovnik() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z" />
    </svg>
  );
}

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
      { to: '/dogadjaji', label: 'Dogadjaji', icon: '✧' },
      { to: '/akcije', label: 'Akcije', icon: '％' },
    ],
  },
  {
    group: 'Sadrzaj',
    items: [
      { to: '/promocije', label: 'Promocije', icon: '★' },
      { to: '/jelovnik', label: 'Jelovnik', icon: <IkonaJelovnik /> },
      { to: '/raspored', label: 'Raspored', icon: '▤' },
    ],
  },
  {
    group: 'Sistem',
    items: [{ to: '/podesavanja', label: 'Podesavanja', icon: '⚙' }],
  },
];

// Na telefonu se bocna traka pretvara u fioku. Dugme za nju stoji u zaglavlju
// stranice, a stranice sve renderuju PageHeader - pa stanje putuje kroz
// kontekst umesto da ga svaka stranica prosledjuje.
const SidebarCtx = createContext(null);

export default function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  // Odjava se pita. Panel stoji na pultu ceo dan i dugme je tik uz meni, pa je
  // slucajan klik usred smene znacio novo kucanje lozinke.
  const [pitaZaOdjavu, setPitaZaOdjavu] = useState(false);

  // Broj dece koja su trenutno u igraonici stoji uz "Prijave" - to je jedini
  // podatak koji osoblje mora da vidi bez otvaranja stranice. Izvor je deljen sa
  // ekranom Prijave, pa se ista ruta ne anketira dvaput.
  const { count: activeCount } = useActiveVisits();

  // Izbor iz menija vodi na drugu stranicu - fioka tu nema sta vise da radi.
  // Prilagodjava se u renderu, ne u effect-u: tako ne postoji prolaz u kome se
  // nova stranica vec crta a fioka jos stoji preko nje.
  const [prethodnaPutanja, setPrethodnaPutanja] = useState(pathname);
  if (pathname !== prethodnaPutanja) {
    setPrethodnaPutanja(pathname);
    setMenuOpen(false);
  }

  // Dok je fioka preko ekrana, stranica ispod ne sme da se pomera pod prstom.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <SidebarCtx.Provider value={{ menuOpen, setMenuOpen }}>
    <div className={`shell ${menuOpen ? 'menu-open' : ''}`}>
      <button
        type="button"
        className="scrim"
        aria-label="Zatvori meni"
        onClick={() => setMenuOpen(false)}
      />
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
          <button className="btn secondary block sm" onClick={() => setPitaZaOdjavu(true)}>
            Odjava
          </button>

          {/* Pravni tekstovi se sluze sa iste adrese kao panel, pa su i
              roditeljima i recenzentima prodavnica dostupni bez prijave. */}
          <div className="pravno">
            <a href="/pravno/privatnost.html" target="_blank" rel="noreferrer">
              Privatnost
            </a>
            <a href="/pravno/uslovi.html" target="_blank" rel="noreferrer">
              Uslovi
            </a>
          </div>
        </div>
      </aside>

      <div className="main">
        <Outlet />
      </div>

      {pitaZaOdjavu && (
        <Confirm
          title="Odjava"
          text="Sledeci put ce ponovo trebati email i lozinka. Nedovrsen unos na otvorenoj stranici se gubi."
          confirmLabel="Odjavi me"
          tone="danger"
          onConfirm={logout}
          onClose={() => setPitaZaOdjavu(false)}
        />
      )}
    </div>
    </SidebarCtx.Provider>
  );
}

// Zaglavlje stranice. Svaka stranica ga sama renderuje da bi mogla da doda
// svoje akcije desno.
export function PageHeader({ title, subtitle, children }) {
  const sidebar = useContext(SidebarCtx);

  return (
    <div className="topbar">
      <button
        type="button"
        className="menu-btn"
        aria-label="Meni"
        aria-expanded={!!sidebar?.menuOpen}
        onClick={() => sidebar?.setMenuOpen((o) => !o)}
      >
        ☰
      </button>
      <div className="topbar-title">
        <h1>{title}</h1>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>
      <div className="topbar-actions">
        <Notifications />
        {children}
      </div>
    </div>
  );
}
