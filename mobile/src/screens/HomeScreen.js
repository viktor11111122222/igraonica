import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import PressableScale from '../components/PressableScale';
import { colors, radius, spacing, type, shadow } from '../theme';

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [packages, setPackages] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    try {
      const data = await apiRequest('/packages/my');
      setPackages(data.userPackages || []);
    } catch {}
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  const activePackage = packages.find(
    (p) =>
      p.isActive &&
      new Date(p.expiresAt) > new Date() &&
      Number(p.remainingHours) > 0
  );

  const remaining = activePackage ? Number(activePackage.remainingHours) : 0;
  const total = activePackage ? Number(activePackage.package.totalHours) : 0;
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Zdravo,</Text>
            <Text style={styles.name}>
              {user?.firstName} {user?.lastName}
            </Text>
          </View>
          <PressableScale
            style={styles.logoutBtn}
            onPress={logout}
            accessibilityLabel="Odjava"
          >
            <Ionicons name="log-out-outline" size={20} color={colors.textOnPrimary} />
          </PressableScale>
        </View>
      </View>

      {activePackage ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Preostali sati</Text>
          <View style={styles.hoursRow}>
            <Text style={styles.hours}>{remaining.toFixed(1)}</Text>
            <Text style={styles.hoursUnit}>/ {total}h</Text>
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct * 100}%` }]} />
          </View>

          <Text style={styles.packageName}>{activePackage.package.name}</Text>
          <View style={styles.expiryRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textFaint} />
            <Text style={styles.expiry}>
              Vazi do{' '}
              {new Date(activePackage.expiresAt).toLocaleDateString('sr-RS')}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.card, styles.emptyCard]}>
          <View style={styles.emptyIcon}>
            <Ionicons name="albums-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Nemate aktivan paket</Text>
          <Text style={styles.emptyText}>
            Kontaktirajte igraonicu za kupovinu paketa.
          </Text>
        </View>
      )}

      <PressableScale
        style={styles.menuItem}
        onPress={() => navigation.navigate('Children')}
      >
        <View style={styles.menuIcon}>
          <Ionicons name="people" size={22} color={colors.primaryDarker} />
        </View>
        <View style={styles.menuBody}>
          <Text style={styles.menuTitle}>Moja deca</Text>
          <Text style={styles.menuSub}>Pregled i dodavanje dece</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxxl },
  header: {
    paddingTop: 64,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: { flex: 1 },
  greeting: { ...type.body, color: 'rgba(255,255,255,0.85)' },
  name: { ...type.title, color: colors.textOnPrimary, marginTop: 2 },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: -spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    ...shadow.card,
  },
  cardLabel: {
    ...type.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xs,
  },
  hours: { ...type.display, color: colors.primaryDarker },
  hoursUnit: {
    ...type.heading,
    color: colors.textFaint,
    marginLeft: spacing.sm,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  packageName: {
    ...type.heading,
    color: colors.text,
    marginTop: spacing.lg,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  expiry: { ...type.caption, color: colors.textFaint },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  menuBody: { flex: 1 },
  menuTitle: { ...type.heading, color: colors.text },
  menuSub: { ...type.caption, color: colors.textMuted, marginTop: 2 },
});
