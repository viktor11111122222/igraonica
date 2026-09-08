import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useSettings } from '../context/SettingsContext';
import Announcement from '../components/Announcement';
import Banner from '../components/Banner';
import { apiRequest } from '../utils/api';
import PressableScale from '../components/PressableScale';
import BrisanjeNaloga from '../components/BrisanjeNaloga';
import HoursRing from '../components/HoursRing';
import { ageInYears, yearsLabel } from '../utils/date';
import { summarize } from '../utils/packages';
import { colors, radius, spacing, type, shadow } from '../theme';

// Bez suvisne decimale: 12,5 h ali 20 h.
const num = (value) =>
  (Math.round((Number(value) || 0) * 10) / 10).toString().replace('.', ',');
const hours = (value) => `${num(value)} h`;

export default function PackageScreen({ navigation }) {
  const { user, logout } = useAuth();

  // Povratak posle odjave trazi lozinku, a roditelj je retko ima pri ruci -
  // jedan promasen dodir ga je izbacivao iz aplikacije.
  function potvrdiOdjavu() {
    Alert.alert('Odjava', 'Da li zelite da se odjavite?', [
      { text: 'Odustani', style: 'cancel' },
      { text: 'Odjavi se', style: 'destructive', onPress: logout },
    ]);
  }
  const { settings } = useSettings();
  const [packages, setPackages] = useState([]);
  const [children, setChildren] = useState([]);
  // Minus sati stizu uz pakete: boravci odigrani bez pokrica u paketu.
  const [debtHours, setDebtHours] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [pkgs, kids] = await Promise.all([
      apiRequest('/packages/my').catch(() => null),
      apiRequest('/children').catch(() => null),
    ]);
    if (pkgs) {
      setPackages(pkgs.userPackages || []);
      setDebtHours(Number(pkgs.debtHours) || 0);
    }
    if (kids) setChildren(kids.children || []);
  }, []);

  // Admin dodeli paket ili koriguje sate, a roditelj to vidi bez izlaska i
  // povratka na ekran.
  useAutoRefresh(loadData);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  // Zbir preko svih paketa koji vaze, ne samo preko jednog.
  const sum = summarize(packages);
  // U minusu je onaj kome sati vise nema, a dug postoji.
  const uMinusu = debtHours > 0 && sum.remaining <= 0;

  const contact = [
    { icon: 'time-outline', value: settings.working_hours },
    { icon: 'call-outline', value: settings.club_phone },
    { icon: 'location-outline', value: settings.club_address },
    { icon: 'mail-outline', value: settings.club_email },
  ].filter((item) => item.value);


  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Banner
        rounded
        style={styles.header}
        eyebrow="Zdravo,"
        title={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()}
        right={
          <PressableScale
            style={styles.logoutBtn}
            onPress={potvrdiOdjavu}
            accessibilityRole="button"
            accessibilityLabel="Odjava"
          >
            <Ionicons name="log-out-outline" size={20} color={colors.textOnPrimary} />
          </PressableScale>
        }
      />

      {sum.hasAny ? (
        <View style={styles.card}>
          <View style={styles.packageTop}>
            {/* U prstenu stoji udeo, ne sati - sati su ispisani pored, pa bi
                isti broj dvaput bio suvisan. Udeo se poklapa sa lukom. */}
            <HoursRing progress={sum.progress}>
              <Text style={styles.ringHours}>{Math.round(sum.progress * 100)}%</Text>
              <Text style={styles.ringUnit}>preostalo</Text>
            </HoursRing>

            <View style={styles.packageInfo}>
              {/* Namerno ne pise naziv paketa: roditelj moze da ima vise
                  paketa, a i dokupljuje ih, pa jedan naziv ne govori nista.
                  Umesto toga stoji zbir sati iz svih paketa koji jos vaze. */}
              <Text style={styles.packageLabel}>Ukupno sati</Text>
              <Text style={styles.packageName}>{hours(sum.total)}</Text>
              {/* Broj paketa prati zbir iznad, pa se racunaju svi koji vaze -
                  i oni kojima su sati potroseni, jer i oni ulaze u ukupno. */}
              {sum.packages.length > 1 && (
                <View style={styles.metaRow}>
                  <Ionicons name="albums-outline" size={14} color={colors.textFaint} />
                  <Text style={styles.meta}>iz {sum.packages.length} paketa</Text>
                </View>
              )}
              {/* Kada ima vise paketa, vazan je onaj koji prvi istice. */}
              {sum.expiresAt && (
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textFaint} />
                  <Text style={styles.meta}>
                    {sum.usableCount > 1 ? 'Prvi istice ' : 'Vazi do '}
                    {new Date(sum.expiresAt).toLocaleDateString('sr-RS')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Ukupno stoji gore pored prstena, pa se ovde ne ponavlja. */}
          <View style={styles.sums}>
            <View style={styles.sumCell}>
              <Text style={[styles.sumValue, { color: colors.accentText }]}>
                {hours(sum.spent)}
              </Text>
              <Text style={styles.sumLabel}>iskorisceno</Text>
            </View>
            <View style={styles.sumDivider} />
            <View style={styles.sumCell}>
              {/* Kad sati nema a dug postoji, minus JE stanje - "preostalo
                  0,0 h" pa ispod "-4,0 h" bi bila ista stvar dvaput. */}
              <Text
                style={[
                  styles.sumValue,
                  { color: uMinusu ? colors.danger : colors.success },
                ]}
              >
                {uMinusu ? `-${hours(debtHours)}` : hours(sum.remaining)}
              </Text>
              <Text style={styles.sumLabel}>{uMinusu ? 'za naplatu' : 'preostalo'}</Text>
            </View>
          </View>

          {/* Kada ima vise paketa, zbir sam po sebi nije dovoljan. */}
          {sum.packages.length > 1 && (
            <View style={styles.breakdown}>
              {sum.packages.map((p) => (
                <View key={p.id} style={styles.breakdownRow}>
                  <Text style={styles.breakdownName} numberOfLines={1}>
                    {p.package.name}
                  </Text>
                  <Text style={styles.breakdownHours}>
                    {hours(p.remainingHours)} / {hours(p.totalHours)}
                  </Text>
                  <Text style={styles.breakdownDate}>
                    do {new Date(p.expiresAt).toLocaleDateString('sr-RS')}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.card, styles.emptyCard]}>
          <View style={styles.emptyIcon}>
            <Ionicons name="albums-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Nemate aktivan paket</Text>
          <Text style={styles.emptyText}>
            {debtHours > 0
              ? 'Dete moze da se prijavi i bez paketa - odigrani sati se skupljaju kao minus i placaju u igraonici.'
              : 'Kontaktirajte igraonicu za kupovinu paketa. Sati se trose kada dete prijavite QR kodom.'}
          </Text>
        </View>
      )}

      {/* Minus nastaje kad dete udje bez paketa ili kad paket ne pokrije ceo
          boravak. Stoji odmah ispod sati, jer je to isti podatak - samo sa
          druge strane nule. */}
      {debtHours > 0 && (
        <View style={styles.debtCard}>
          <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
          <View style={styles.debtTextWrap}>
            {/* Iznos se ne ponavlja kad ga gore vec nosi stanje paketa; bez
                paketa kartica je jedino mesto gde ga roditelj vidi. */}
            {uMinusu && sum.hasAny ? null : (
              <Text style={styles.debtValue}>-{hours(debtHours)}</Text>
            )}
            <Text style={styles.debtText}>
              Sati odigrani bez paketa. Placaju se u igraonici, a novi paket ih
              pokriva pre nego sto krene da se trosi.
            </Text>
          </View>
        </View>
      )}

      {/* Stoji ispod kartice paketa jer ona negativnom marginom ulazi u
          zaglavlje, pa iznad nje nema mesta. */}
      <Announcement screen="package" />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Moja deca</Text>
        {children.length > 0 && (
          <PressableScale
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddChild')}
            accessibilityRole="button"
            accessibilityLabel="Dodaj dete"
          >
            <Ionicons name="add" size={16} color={colors.primaryDarker} />
            <Text style={styles.addText}>Dodaj</Text>
          </PressableScale>
        )}
      </View>

      {children.length === 0 ? (
        // Bez deteta nema ni QR koda, pa je ovo prvi korak na ekranu.
        <View style={styles.noChildren}>
          <View style={styles.qrBadge}>
            <Ionicons name="qr-code" size={26} color={colors.textOnAccent} />
          </View>
          <Text style={styles.emptyTitle}>Jos nemate dodatu decu</Text>
          <Text style={styles.emptyText}>
            Dodajte dete da biste dobili QR kod za prijavu u igraonici.
          </Text>
          <PressableScale
            style={styles.cta}
            onPress={() => navigation.navigate('AddChild')}
          >
            <Ionicons name="add" size={18} color={colors.textOnAccent} />
            <Text style={styles.ctaText}>Dodaj dete</Text>
          </PressableScale>
        </View>
      ) : (
        children.map((child) => (
          <PressableScale
            key={child.id}
            style={styles.childRow}
            onPress={() => navigation.navigate('ChildDetail', { child })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {child.firstName[0]}
                {child.lastName[0]}
              </Text>
            </View>
            <View style={styles.childBody}>
              <Text style={styles.childName}>
                {child.firstName} {child.lastName}
              </Text>
              <Text style={styles.childAge}>
                {yearsLabel(ageInYears(child.dateOfBirth))}
              </Text>
            </View>
            {/* Precica do istog QR koda koji otvara dugme u tab baru. */}
            <PressableScale
              style={styles.qrBtn}
              onPress={() => navigation.navigate('Qr', { childId: child.id })}
              accessibilityRole="button"
              accessibilityLabel={`QR kod za ${child.firstName}`}
            >
              <Ionicons name="qr-code" size={20} color={colors.textOnAccent} />
            </PressableScale>
          </PressableScale>
        ))
      )}

      {/* Kontakt igraonice. Sve dolazi iz podesavanja - prazna polja se
          preskacu, pa kartice nema ako admin nista nije uneo. */}
      {contact.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{settings.club_name || 'Kids club'}</Text>
          </View>
          <View style={styles.contactCard}>
            {contact.map((item) => (
              <View key={item.icon} style={styles.contactRow}>
                <Ionicons name={item.icon} size={16} color={colors.primary} />
                <Text style={styles.contactText}>{item.value}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Nalog: uslovi, privatnost i brisanje. Stoji na dnu ekrana na kome je
          vec odjava, da roditelj sve oko naloga nalazi na jednom mestu. */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Nalog</Text>
      </View>
      <BrisanjeNaloga navigation={navigation} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxxl * 2 },

  // Kartica sa satima ulazi u baner odozdo, pa mu treba vise vazduha ispod
  // naslova nego sto Banner podrazumevano ima. Dodaje se na vazduh zaglavlja.
  header: { paddingBottom: spacing.xl },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.onPrimaryVeil,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: -spacing.xxl,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.card,
  },
  packageTop: { flexDirection: 'row', alignItems: 'center' },

  sums: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sumCell: { flex: 1, alignItems: 'center' },
  sumValue: { ...type.heading, color: colors.text },
  sumLabel: {
    ...type.caption,
    color: colors.textFaint,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sumDivider: { width: 1, height: 28, backgroundColor: colors.border },

  breakdown: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  breakdownName: { ...type.caption, color: colors.text, flex: 1 },
  breakdownHours: { ...type.caption, color: colors.textMuted },
  breakdownDate: { ...type.caption, color: colors.textFaint },
  ringHours: { ...type.title, color: colors.primaryDarker },
  ringUnit: { ...type.caption, color: colors.textFaint, marginTop: -2 },
  packageInfo: { flex: 1, marginLeft: spacing.xl },
  packageLabel: {
    ...type.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  packageName: { ...type.title, color: colors.text, marginTop: 2 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  meta: { ...type.caption, color: colors.textMuted, flex: 1 },

  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  debtCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  debtTextWrap: { flex: 1 },
  debtValue: { ...type.heading, color: colors.danger },
  debtText: { ...type.caption, color: colors.textMuted, marginTop: 2 },

  emptyTitle: { ...type.heading, color: colors.text, textAlign: 'center' },
  emptyText: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  sectionTitle: { ...type.heading, color: colors.text },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  addText: { ...type.label, color: colors.primaryDarker },

  noChildren: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    ...shadow.card,
  },
  qrBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  ctaText: { ...type.label, color: colors.textOnAccent },

  contactCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  contactText: { ...type.body, color: colors.textMuted, flex: 1 },

  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...type.label, color: colors.textOnPrimary },
  childBody: { flex: 1, marginLeft: spacing.lg },
  childName: { ...type.heading, color: colors.text },
  childAge: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  qrBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
