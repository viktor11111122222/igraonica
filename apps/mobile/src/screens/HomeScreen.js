import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import PressableScale from '../components/PressableScale';
import HoursRing from '../components/HoursRing';
import { ageInYears, yearsLabel } from '../utils/date';
import { colors, radius, spacing, type, shadow } from '../theme';

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [packages, setPackages] = useState([]);
  const [children, setChildren] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [pkgs, kids] = await Promise.all([
      apiRequest('/packages/my').catch(() => null),
      apiRequest('/children').catch(() => null),
    ]);
    if (pkgs) setPackages(pkgs.userPackages || []);
    if (kids) setChildren(kids.children || []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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
  const progress = total > 0 ? remaining / total : 0;
  const spent = Math.max(0, total - remaining);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>Zdravo,</Text>
          <Text style={styles.name}>
            {user?.firstName} {user?.lastName}
          </Text>
        </View>
        <PressableScale
          style={styles.logoutBtn}
          onPress={logout}
          accessibilityRole="button"
          accessibilityLabel="Odjava"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.textOnPrimary} />
        </PressableScale>
      </View>

      {activePackage ? (
        <View style={styles.card}>
          <View style={styles.packageTop}>
            <HoursRing progress={progress}>
              <Text style={styles.ringHours}>{remaining.toFixed(1)}</Text>
              <Text style={styles.ringUnit}>sati</Text>
            </HoursRing>

            <View style={styles.packageInfo}>
              <Text style={styles.packageLabel}>Aktivan paket</Text>
              <Text style={styles.packageName}>{activePackage.package.name}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="hourglass-outline" size={14} color={colors.textFaint} />
                <Text style={styles.meta}>
                  Iskorisceno {spent.toFixed(1)} od {total}h
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color={colors.textFaint} />
                <Text style={styles.meta}>
                  Vazi do{' '}
                  {new Date(activePackage.expiresAt).toLocaleDateString('sr-RS')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.card, styles.emptyCard]}>
          <View style={styles.emptyIcon}>
            <Ionicons name="albums-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Nemate aktivan paket</Text>
          <Text style={styles.emptyText}>
            Kontaktirajte igraonicu za kupovinu paketa. Sati se trose kada dete
            prijavite QR kodom.
          </Text>
        </View>
      )}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxxl * 2 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
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
    marginTop: -spacing.xxl,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.card,
  },
  packageTop: { flexDirection: 'row', alignItems: 'center' },
  ringHours: { ...type.title, color: colors.primaryDarker },
  ringUnit: { ...type.caption, color: colors.textFaint, marginTop: -2 },
  packageInfo: { flex: 1, marginLeft: spacing.xl },
  packageLabel: {
    ...type.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  packageName: { ...type.heading, color: colors.text, marginTop: 2 },
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
