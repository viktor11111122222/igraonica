import { useClosedDays } from '../context/ClosedDaysContext';
import NeradniDan from './NeradniDan';
import { spacing } from '../theme';

// Obavestenje da se tog dana ne dolazi. Za razliku od <Announcement/>, koje
// admin rucno kuca u podesavanjima, ovo se pojavljuje samo - cim je dan
// oznacen kao neradni u panelu ili je zauzet celodnevnim rodjendanom.
//
// `date` je kljuc dana (YYYY-MM-DD). `today` govori da li je taj dan danasnji,
// da bi tekst bio "Danas ne radimo" umesto "Ovog dana ne radimo".
export default function ClosedNotice({ date, today = false, style }) {
  const { closedOn } = useClosedDays();

  const dan = closedOn(date);
  if (!dan) return null;

  return (
    <NeradniDan
      kind={dan.kind}
      reason={dan.reason}
      note={dan.note}
      today={today}
      style={[{ marginHorizontal: spacing.xl, marginTop: spacing.lg }, style]}
    />
  );
}
