import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CheckIn from './pages/CheckIn';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import Children from './pages/Children';
import Visits from './pages/Visits';
import Packages from './pages/Packages';
import Reservations from './pages/Reservations';
import Events from './pages/Events';
import Menu from './pages/Menu';
import Promotions from './pages/Promotions';
import PromoBanners from './pages/PromoBanners';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import Pravno from './pages/Pravno';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Pravni tekstovi se citaju i bez naloga: adresa iz opisa na
            prodavnici ne sme da vodi na ekran za prijavu. */}
        <Route path="/pravno/:dokument" element={<Pravno />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="prijave" element={<CheckIn />} />
        <Route path="korisnici" element={<Users />} />
        <Route path="korisnici/:id" element={<UserDetail />} />
        <Route path="deca" element={<Children />} />
        <Route path="posete" element={<Visits />} />
        <Route path="paketi" element={<Packages />} />
        <Route path="rezervacije" element={<Reservations />} />
        <Route path="dogadjaji" element={<Events />} />
        <Route path="akcije" element={<Promotions />} />
        <Route path="promocije" element={<PromoBanners />} />
        <Route path="jelovnik" element={<Menu />} />
        <Route path="raspored" element={<Schedule />} />
        <Route path="podesavanja" element={<Settings />} />
        <Route path="pravno/:dokument" element={<Pravno />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
