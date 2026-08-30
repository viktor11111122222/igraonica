import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { apiRequest } from '../utils/api';
import { dayIndex, fromKey, monthDates, toKey } from '../utils/date';
import { useDaySelection } from '../hooks/useDay';
import Banner from '../components/Banner';
import DayStrip from '../components/DayStrip';
import Announcement from '../components/Announcement';
import NeradniDan from '../components/NeradniDan';
import ClosedNotice from '../components/ClosedNotice';
import { useClosedDays } from '../context/ClosedDaysContext';
import { colors, radius, spacing, type, shadow } from '../theme';

// Backend koristi 0 = ponedeljak (ne JS konvenciju gde je 0 = nedelja).
// Imena stoje u akuzativu jer se koriste samo u recenici "Za <dan> nije
// zakazana...". Zenski dani tu menjaju oblik (sreda -> sredu), muski ne.
const DAY_NAMES_ACC = [
  'ponedeljak',
  'utorak',
  'sredu',
  'cetvrtak',
  'petak',
  'subotu',
  'nedelju',
];

export default function ScheduleScreen() {
  const [week, setWeek] = useState({});
  const [items, setItems] = useState([]);
  const [rodjendanski, setRodjendanski] = useState([]);
  const { today, selected: selectedDay, setSelected: setSelectedDay } =
    useDaySelection();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Spisak dana dolazi sa servera vec spojen i poredjan: rodjendani na vrhu,
  // pa aktivnosti po vremenu. Nedeljni raspored se i dalje povlaci, ali samo
  // da bi traka datuma znala koji dani imaju sadrzaja.
  const load = useCallback(async (dateKey) => {
    const [plan, nedelja, rezervacije] = await Promise.all([
      apiRequest(`/schedule/plan?date=${dateKey}`).catch(() => null),
      apiRequest('/schedule').catch(() => null),
      apiRequest('/reservations').catch(() => null),
    ]);

    setItems(plan?.items || []);
    if (nedelja) setWeek(nedelja.week || {});
    if (rezervacije) {
      setRodjendanski(
        (rezervacije.reservations || [])
          .filter((r) => r.type === 'BIRTHDAY')
          .map((r) => String(r.date).split('T')[0])
      );
    }
    setLoading(false);
  }, []);

  // selectedDay je u zavisnostima, pa promena dana odmah povlaci njegov plan
  // umesto da se ceka sledece osvezavanje.
  useAutoRefresh(useCallback(() => load(selectedDay), [load, selectedDay]));

  async function onRefresh() {
    setRefreshing(true);
    await load(selectedDay);
    setRefreshing(false);
  }

  const { isClosed, closedDays } = useClosedDays();

  const day = dayIndex(fromKey(selectedDay));
  const zatvoreno = isClosed(selectedDay);
  // Neradnog dana aktivnosti se ne odrzavaju, pa se i ne prikazuju - inace bi
  // roditelj video "Mali kuvari 10:30" ispod obavestenja da se ne dolazi.
  const activities = zatvoreno ? [] : items;

  // Raspored se ponavlja nedeljno, pa se oznacava svaki datum ciji dan u
  // nedelji ima aktivnosti. Rodjendani se dodaju posebno: oni padaju na tacan
  // datum, pa bez njih dan sa rodjendanom a bez nedeljne aktivnosti ne bi bio
  // oznacen. Neradni dani se ne oznacavaju.
  const saRodjendanom = new Set(rodjendanski);
  const marked = new Set(
    monthDates()
      .filter((d) => {
        const kljuc = toKey(d);
        if (isClosed(kljuc)) return false;
        return (week[dayIndex(d)] || []).length > 0 || saRodjendanom.has(kljuc);
      })
      .map(toKey)
  );

  // Traka posebno oznacava neradne dane, da se vide i pre nego sto se dodirnu.
  const closed = new Set(Object.keys(closedDays));

  return (
    <View style={styles.container}>
      <Banner doodles="head" title="Raspored" subtitle="Nedeljne aktivnosti">
        <DayStrip
          today={today}
          selected={selectedDay}
          onSelect={setSelectedDay}
          marked={marked}
          closed={closed}
        />
      </Banner>

      <ClosedNotice date={selectedDay} today={selectedDay === today} />
      <Announcement screen="schedule" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Neradnog dana obavestenje iznad vec sve objasnjava - "nije
              zakazana nijedna aktivnost" bi tu samo zbunjivalo. */}
          {zatvoreno ? null : activities.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={34} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Nema aktivnosti</Text>
              <Text style={styles.emptyText}>
                Za {DAY_NAMES_ACC[day]} nije zakazana nijedna aktivnost.
              </Text>
            </View>
          ) : (
            activities.map((a) => {
              const rodjendan = a.kind === 'BIRTHDAY';
              // Rezervacija drzi termin za sebe, pa se u spisku izdvaja od
              // redovnih aktivnosti - rodjendan poklonom, ostale bravicom.
              const zauzeto = rodjendan || a.kind === 'RESERVATION';

              // Celodnevna rezervacija je jedino sto se tog dana desava - server
              // vise i ne salje aktivnosti uz nju. Zato dobija celu karticu
              // umesto reda u spisku. Ista je i kad dan stigne kao neradni.
              if (zauzeto && a.isFullDay) {
                return <NeradniDan key={a.id} kind={a.kind} reason={a.title} />;
              }

              return (
              <View key={a.id} style={[styles.card, zauzeto && styles.cardRodjendan]}>
                <View
                  style={[
                    styles.stripe,
                    { backgroundColor: zauzeto ? colors.accent : a.color || colors.primary },
                  ]}
                />
                <View style={styles.cardBody}>
                  <View style={styles.timeRow}>
                    <Ionicons
                      name={
                        rodjendan ? 'gift-outline' : zauzeto ? 'lock-closed-outline' : 'time-outline'
                      }
                      size={14}
                      color={zauzeto ? colors.accentText : colors.textFaint}
                    />
                    <Text style={[styles.time, zauzeto && styles.timeRodjendan]}>
                      {`${a.startTime} - ${a.endTime}`}
                    </Text>
                    {/* Naslov reda vec kaze sta je (Rodjendan, Privatna
                        proslava...), pa oznaka kaze ono sto iz njega ne vidi:
                        da je taj termin zauzet. */}
                    {zauzeto ? (
                      <View style={styles.oznaka}>
                        <Text style={styles.oznakaTekst}>Zauzeto</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.activityTitle}>{a.title}</Text>
                  {a.description ? (
                    <Text style={styles.activityDesc}>{a.description}</Text>
                  ) : null}
                  {a.ageGroup ? (
                    <View style={styles.ageChip}>
                      <Text style={styles.ageText}>{a.ageGroup}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: {
    padding: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  // Rodjendan je dogadjaj dana - stoji na vrhu spiska i ima svoju boju, da se
  // razlikuje od redovnih aktivnosti koje se ponavljaju svake nedelje.
  cardRodjendan: { backgroundColor: colors.accentSoft },
  stripe: { width: 5 },
  cardBody: { flex: 1, padding: spacing.lg },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  time: { ...type.caption, color: colors.textFaint },
  timeRodjendan: { color: colors.accentText },
  oznaka: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  oznakaTekst: { ...type.caption, fontSize: 11, color: colors.textOnAccent },
  activityTitle: {
    ...type.heading,
    color: colors.text,
    marginTop: spacing.xs,
  },
  activityDesc: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  ageChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  ageText: { ...type.caption, color: colors.primaryDarker },
  empty: { alignItems: 'center', paddingTop: spacing.xxxl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { ...type.heading, color: colors.text },
  emptyText: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
