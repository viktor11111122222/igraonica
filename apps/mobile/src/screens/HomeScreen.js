import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useClosedDays } from '../context/ClosedDaysContext';
import { apiRequest } from '../utils/api';
import Banner from '../components/Banner';
import PromoList from '../components/PromoList';
import PromoBanners from '../components/PromoBanners';
import PromoPopup from '../components/PromoPopup';
import PressableScale from '../components/PressableScale';
import Announcement from '../components/Announcement';
import ClosedNotice from '../components/ClosedNotice';
import { todayKey } from '../utils/date';
import { mailUrl, mapsUrl, open, parseCoords, telUrl } from '../utils/contact';
import { summarize } from '../utils/packages';
import { photos } from '../data/gallery';
import { MEALS } from '../data/meals';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, spacing, type, shadow } from '../theme';

const num = (value) =>
  (Math.round((Number(value) || 0) * 10) / 10).toString().replace('.', ',');

// Pocetni ekran je pregled dana: koliko sati ima, sta se danas jede, sta se
// danas radi i nekoliko slika. Detalji su na svojim tabovima.
export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  // Zaglavlje krece ispod sistemske trake; njena visina se razlikuje po
  // uredjaju (iPhone ~59, Android 24-49), pa se ne sme upisati kao broj.
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { isClosed } = useClosedDays();
  // Pocetnom ekranu treba samo znacka, ne i ceo spisak.
  const { unreadCount } = useNotifications({ samoBroj: true });

  const [packages, setPackages] = useState([]);
  // Sati odigrani bez pokrica u paketu. Stizu uz pakete, pa nema drugog zahteva.
  const [debtHours, setDebtHours] = useState(0);
  const [menu, setMenu] = useState([]);
  const [activities, setActivities] = useState([]);
  const [promotions, setPromotions] = useState([]);
  // Promocije sa slikom: prvi put idu preko celog ekrana, posle stoje iznad
  // galerije.
  const [promoBanners, setPromoBanners] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const today = todayKey();
    // Plan dana, a ne nedeljni raspored: samo on zna za rodjendane i za to da
    // ih rodjendan gasi, pa se pocetna slaze sa tabom "Raspored".
    const [pkgs, todayMenu, schedule, akcije, baneri] = await Promise.all([
      apiRequest('/packages/my').catch(() => null),
      apiRequest(`/menu?date=${today}`).catch(() => null),
      apiRequest(`/schedule/plan?date=${today}`).catch(() => null),
      apiRequest('/promotions').catch(() => null),
      apiRequest('/promo-banners').catch(() => null),
    ]);
    if (pkgs) {
      setPackages(pkgs.userPackages || []);
      setDebtHours(Number(pkgs.debtHours) || 0);
    }
    if (todayMenu) setMenu(todayMenu.items || []);
    if (schedule) setActivities(schedule.items || []);
    if (akcije) setPromotions(akcije.promotions || []);
    if (baneri) setPromoBanners(baneri.promoBanners || []);
  }, []);

  useAutoRefresh(loadData);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  const sum = summarize(packages);
  // U minusu je onaj kome sati vise nema, a dug postoji. Ako sati jos ima,
  // stanje nije minus - dug se tada samo pripisuje ispod.
  const uMinusu = debtHours > 0 && sum.remaining <= 0;
  const showGallery = settings.mobile_tab_gallery === 'true';

  const danas = todayKey();
  const zatvorenoDanas = isClosed(danas);

  // Redovi koji vode negde (telefon, mejl) nose `onPress`; ostali su samo
  // podatak. Prazna podesavanja ispadaju, da ne ostane red sa crticom.
  const contact = [
    {
      key: 'hours',
      icon: 'time-outline',
      label: 'Radno vreme',
      value: settings.working_hours,
    },
    {
      key: 'phone',
      icon: 'call-outline',
      label: 'Telefon',
      value: settings.club_phone,
      url: telUrl(settings.club_phone),
      cantOpen: 'Ovaj uredjaj ne moze da pokrene pozivanje.',
    },
    {
      key: 'email',
      icon: 'mail-outline',
      label: 'Email',
      value: settings.club_email,
      url: mailUrl(settings.club_email),
      cantOpen: 'Ovaj uredjaj nema podesen nalog za slanje mejla.',
    },
    {
      key: 'address',
      icon: 'location-outline',
      label: 'Adresa',
      value: settings.club_address,
    },
  ].filter((item) => item.value);

  // Dugme za mapu ima smisla samo ako su koordinate ispravno unete.
  const coords = parseCoords(settings.club_latitude, settings.club_longitude);
  const mapa = mapsUrl(coords, settings.club_name);

  // Ako sistem ne moze da otvori link (simulator nema Telefon, uredjaj bez
  // naloga nema mejl), dodir ne sme da prodje bez traga - vrednost se bar
  // pokaze da moze rucno da se prepise.
  async function otvori(url, naslov, vrednost, poruka) {
    const uspelo = await open(url);
    if (!uspelo) {
      Alert.alert(naslov, `${vrednost}\n\n${poruka}`);
    }
  }

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Banner rounded style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRed}>
          <View style={styles.headerTekst}>
            <Text style={styles.greeting}>Zdravo,</Text>
            <Text style={styles.name}>{user?.firstName}</Text>
            <Text style={styles.club}>{settings.club_name || 'Kids club'}</Text>
          </View>

          {/* Zvono stoji ovde, a ne u traci tabova: obavestenja se ne gledaju
              stalno, ali se broj mora videti cim se aplikacija otvori. */}
          <PressableScale
            style={styles.zvono}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0 ? `Obavestenja, ${unreadCount} neprocitano` : 'Obavestenja'
            }
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textOnPrimary} />
            {unreadCount > 0 && (
              <View style={styles.zvonoBroj}>
                <Text style={styles.zvonoBrojTekst}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </PressableScale>
        </View>
      </Banner>

      {/* Sati su ovde samo kao brojka; ceo pregled je na tabu Moj paket. */}
      <PressableScale
        style={styles.hoursCard}
        onPress={() => navigation.navigate('Package')}
        accessibilityRole="button"
        accessibilityLabel="Otvori moj paket"
      >
        <View style={styles.hoursLeft}>
          <Text style={styles.hoursLabel}>
            {sum.hasAny || uMinusu ? 'Preostalo sati' : 'Nemate aktivan paket'}
          </Text>

          {/* Kad je stanje u minusu, minus JE brojka stanja. "Preostalo 0" i
              "minus 4 h" jedno pored drugog su govorili istu stvar dvaput, i to
              kao da su dva razlicita podatka. */}
          {uMinusu ? (
            <>
              <Text style={[styles.hoursValue, styles.hoursValueMinus]}>
                -{num(debtHours)}
              </Text>
              <Text style={styles.hoursDebt}>za naplatu</Text>
            </>
          ) : sum.hasAny ? (
            <>
              <Text style={styles.hoursValue}>{num(sum.remaining)}</Text>
              <Text style={styles.hoursSub}>od ukupno {num(sum.total)} h</Text>
              {/* Sati jos ima, ali je ostao i stari dug - tada stoje oba, jer
                  govore o dve razlicite stvari. */}
              {debtHours > 0 && (
                <Text style={styles.hoursDebt}>Minus {num(debtHours)} h za naplatu</Text>
              )}
            </>
          ) : (
            <Text style={styles.hoursSub}>Kontaktirajte igraonicu za paket</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={22} color={colors.textFaint} />
      </PressableScale>

      {/* Akcije traju ogranicen broj dana, pa stoje visoko - ispod sati, a
          iznad onoga sto se ionako ponavlja svaki dan. */}
      {promotions.length > 0 && (
        <>
          <Section title={promotions.length > 1 ? 'Akcije' : 'Akcija'} />
          <PromoList promotions={promotions} />
        </>
      )}

      {/* Stoji iznad rucnog obavestenja: ako se danas ne radi, to je najvaznija
          informacija na ekranu. */}
      <ClosedNotice date={danas} today />
      <Announcement screen="home" />

      {/* Neradnog dana nema ni jelovnika ni aktivnosti - obavestenje iznad je
          cela prica, pa se ceo blok preskace. */}
      {zatvorenoDanas ? null : (
        <>
      <Section title="Danas u igraonici" />

      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardIcon}>
            <Ionicons name="restaurant-outline" size={18} color={colors.accentText} />
          </View>
          <Text style={styles.cardTitle}>Jelovnik</Text>
          <PressableScale onPress={() => navigation.navigate('Menu')}>
            <Text style={styles.link}>Ceo jelovnik</Text>
          </PressableScale>
        </View>

        {menu.length === 0 ? (
          <Text style={styles.emptyLine}>Za danas jos nema unetih obroka.</Text>
        ) : (
          MEALS.map((meal) => {
            const item = menu.find((m) => m.mealType === meal.key);
            if (!item) return null;
            return (
              <View key={meal.key} style={styles.line}>
                <Text style={styles.lineLabel}>{meal.label}</Text>
                <Text style={styles.lineValue} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardIcon}>
            <Ionicons name="calendar-outline" size={18} color={colors.accentText} />
          </View>
          <Text style={styles.cardTitle}>Aktivnosti</Text>
          <PressableScale onPress={() => navigation.navigate('Schedule')}>
            <Text style={styles.link}>Ceo raspored</Text>
          </PressableScale>
        </View>

        {activities.length === 0 ? (
          <Text style={styles.emptyLine}>Danas nije zakazana nijedna aktivnost.</Text>
        ) : (
          activities.slice(0, 3).map((a) => (
            <View key={a.id} style={styles.line}>
              {/* Celodnevni rodjendan nema smislen sat pocetka - u rasporedu
                  na svom tabu takodje pise "Ceo dan". */}
              <Text style={styles.lineLabel}>
                {a.kind === 'BIRTHDAY' && a.isFullDay ? 'Ceo dan' : a.startTime}
              </Text>
              <Text style={styles.lineValue} numberOfLines={1}>
                {a.title}
              </Text>
            </View>
          ))
        )}
      </View>
        </>
      )}

      {/* Promocije stoje tacno iznad galerije: to je mesto koje roditelj vidi
          kad skroluje do kraja pocetne, a prvi put su ionako vec iskocile. */}
      {promoBanners.length > 0 && (
        <>
          <Section title={promoBanners.length > 1 ? 'Promocije' : 'Promocija'} />
          <PromoBanners promocije={promoBanners} />
        </>
      )}

      {showGallery && (
        <>
          <Section
            title="Galerija"
            action="Sve fotografije"
            onPress={() => navigation.navigate('Gallery')}
          />
          {/* Traka slika; dodir na bilo koju otvara punu galeriju. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
          >
            {photos.map((photo, i) => (
              <PressableScale
                key={photo.id}
                onPress={() => navigation.navigate('Gallery', { index: i })}
                accessibilityRole="imagebutton"
                accessibilityLabel={photo.title}
              >
                <Image source={photo.thumb} style={styles.stripImage} resizeMode="cover" />
              </PressableScale>
            ))}
          </ScrollView>
        </>
      )}

      {contact.length > 0 && (
        <>
          <Section title="Kontakt" />
          <View style={styles.card}>
            {contact.map((item) => {
              const sadrzaj = (
                <>
                  <View style={styles.contactIcon}>
                    <Ionicons name={item.icon} size={17} color={colors.primary} />
                  </View>
                  <View style={styles.contactBody}>
                    <Text style={styles.contactLabel}>{item.label}</Text>
                    <Text style={styles.contactText}>{item.value}</Text>
                  </View>
                  {item.url ? (
                    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                  ) : null}
                </>
              );

              // Red bez linka ne sme da izgleda kao dugme, pa se ne umotava u
              // PressableScale.
              return item.url ? (
                <PressableScale
                  key={item.key}
                  style={styles.contactRow}
                  onPress={() => otvori(item.url, item.label, item.value, item.cantOpen)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label}: ${item.value}`}
                >
                  {sadrzaj}
                </PressableScale>
              ) : (
                <View key={item.key} style={styles.contactRow}>
                  {sadrzaj}
                </View>
              );
            })}

            {mapa ? (
              <PressableScale
                style={styles.mapButton}
                onPress={() =>
                  otvori(
                    mapa,
                    'Adresa',
                    settings.club_address || settings.club_name,
                    'Ovaj uredjaj nema aplikaciju za mape.'
                  )
                }
                accessibilityRole="button"
                accessibilityLabel="Prikazi igraonicu na mapi"
              >
                <Ionicons name="map-outline" size={18} color={colors.textOnPrimary} />
                <Text style={styles.mapButtonText}>Prikazi na mapi</Text>
              </PressableScale>
            ) : null}
          </View>
        </>
      )}
    </ScrollView>

      {/* Promocija se prvi put pokazuje preko celog ekrana; komponenta sama
          pamti sta je uredjaj vec video, pa se posle toga ne vraca. */}
      <PromoPopup promocije={promoBanners} />
    </>
  );
}

function Section({ title, action, onPress }) {

  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <PressableScale onPress={onPress}>
          <Text style={styles.link}>{action}</Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxxl * 2 },

  // Boju, saru i zaobljeno dno crta Banner; ovde ostaje samo vazduh oko teksta.
  header: {
    // paddingTop dolazi iz sigurne zone (vidi Banner) - sistemska traka nije
    // svuda iste visine.
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  headerRed: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  headerTekst: { flex: 1, minWidth: 0 },
  zvono: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.onPrimaryVeil,
  },
  zvonoBroj: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zvonoBrojTekst: { ...type.caption, fontSize: 11, color: '#fff' },

  greeting: { ...type.body, color: colors.onPrimaryMuted },
  name: { ...type.display, fontSize: 30, color: colors.textOnPrimary, marginTop: 2 },
  club: { ...type.label, color: colors.onPrimaryMuted, marginTop: spacing.xs },

  hoursCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: -spacing.xxl,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.card,
  },
  hoursLeft: { flex: 1 },
  hoursLabel: {
    ...type.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hoursValue: { ...type.display, fontSize: 34, color: colors.primaryDarker, marginTop: 2 },
  hoursValueMinus: { color: colors.danger },
  hoursSub: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  // Tezina ide preko fontFamily: `fontWeight` uz Montserrat radi samo na
  // iOS-u, a na Androidu bi red ostao tanak (vidi theme.js).
  hoursDebt: { ...type.caption, color: colors.danger, fontFamily: font.semibold, marginTop: 2 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  sectionTitle: { ...type.heading, color: colors.text },
  link: { ...type.label, color: colors.primaryDarker },

  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { ...type.heading, fontSize: 16, color: colors.text, flex: 1 },

  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lineLabel: { ...type.caption, color: colors.textFaint, width: 96 },
  lineValue: { ...type.body, color: colors.text, flex: 1 },
  emptyLine: { ...type.body, color: colors.textMuted },

  strip: { paddingHorizontal: spacing.xl, gap: spacing.md },
  stripImage: {
    width: 128,
    height: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  contactIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactBody: { flex: 1 },
  contactLabel: {
    ...type.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  contactText: { ...type.body, color: colors.text },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  mapButtonText: { ...type.heading, fontSize: 15, color: colors.textOnPrimary },
});
