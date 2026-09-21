import logo from '../assets/logo.png';

// Ekran koji stoji dok se proverava da li je osoblje jos prijavljeno.
//
// Ista podloga kao ekran za prijavu, pa kad provera zavrsi ne menja se ekran
// nego se samo pojavi kartica sa formom. Ranije je ovde stajao goli tockic na
// beloj strani, koji je posle skakao u plavi prelaz.
export default function LoadingScreen() {
  return (
    <div className="loading-wrap" role="status" aria-label="Ucitavanje" data-testid="loading-screen">
      <img className="loading-logo" src={logo} alt="" />
      <div className="loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
