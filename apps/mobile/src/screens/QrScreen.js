import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { apiRequest } from '../utils/api';
import { colors, radius, spacing, type, motion, shadow } from '../theme';

// Rucni citac (onaj sa kase) trazi belu marginu oko koda - "quiet zone" - od
// bar cetiri modula. Bez nje mnogi imageri ne nadju ivicu i kod prosto ne
// procitaju, dok ga kamera telefona jos uvek uhvati; zato je do sada izgledalo
// da je sve u redu.
//
// Kod je uvek 12 znakova, sto na nivou ispravke Q staje u verziju 1, mrezu od
// 21 modula. Modul je (QR_SIZE - 2 * QR_QUIET) / 21 = 9.5px, pa je 40px
// margine oko 4.2 modula - taman iznad praga. Bela podloga kartice dolazi
// povrh toga.
//
// Nivo ispravke Q umesto podrazumevanog M je besplatan: mreza ostaje ista
// (21 modul), a kod podnosi 25% ostecenja umesto 15% - odsjaj i otisci prstiju
// na ekranu su upravo to.
const QR_SIZE = 280;
const QR_QUIET = 40;
const QR_ECL = 'Q';

export default function QrScreen({ navigation, route }) {
  const [children, setChildren] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sa "Moj paket" se dolazi sa konkretnim detetom - odmah ga izaberi i
  // ocisti parametar, da sledeci ulazak u tab ne bude zakljucan na njega.
  const requestedId = route.params?.childId;
  useEffect(() => {
    if (!requestedId) return;
    setSelectedId(requestedId);
    navigation.setParams({ childId: undefined });
  }, [requestedId, navigation]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        setLoading(true);
        try {
          const data = await apiRequest('/children');
          if (cancelled) return;
          const list = data.children || [];
          setChildren(list);
          // Ne gazimo izbor koji je stigao kroz parametar. Jedno dete -
          // preskoci izbor.
          setSelectedId((prev) => prev ?? (list.length === 1 ? list[0].id : null));
        } catch {
          if (!cancelled) setChildren([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      load();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (children.length === 0) {
    return (
      <View style={styles.centered}>
        <View style={styles.emptyIcon}>
          <Ionicons name="qr-code-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Nemate dodatu decu</Text>
        <Text style={styles.emptyText}>
          Dodajte dete da biste dobili QR kod za prijavu.
        </Text>
        <PressableScale
          style={styles.cta}
          onPress={() => navigation.navigate('AddChild')}
        >
          <Text style={styles.ctaText}>Dodaj dete</Text>
        </PressableScale>
      </View>
    );
  }

  const selected = children.find((c) => c.id === selectedId);

  if (!selected) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ko ulazi?</Text>
          <Text style={styles.headerSub}>Izaberite dete za QR kod</Text>
        </View>
        <ScrollView contentContainerStyle={styles.pickerList}>
          {children.map((child, i) => (
            <PickerRow
              key={child.id}
              child={child}
              index={i}
              onPress={() => setSelectedId(child.id)}
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {selected.firstName} {selected.lastName}
        </Text>
        <Text style={styles.headerSub}>Pokazite kod na recepciji</Text>
      </View>

      {/* Ono zbog cega se alergije i unose - osoblje ih vidi tacno u trenutku
          prijave, dok jos nema admin panela. */}
      {selected.allergies ? (
        <View style={styles.alertCard}>
          <Ionicons name="alert-circle" size={20} color={colors.danger} />
          <View style={styles.alertBody}>
            <Text style={styles.alertTitle}>Alergije</Text>
            <Text style={styles.alertText}>{selected.allergies}</Text>
          </View>
        </View>
      ) : null}

      {selected.notes ? (
        <View style={[styles.alertCard, styles.noteCard]}>
          <Ionicons name="document-text-outline" size={20} color={colors.primaryDarker} />
          <View style={styles.alertBody}>
            <Text style={styles.alertTitle}>Napomena</Text>
            <Text style={styles.alertText}>{selected.notes}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.qrWrap}>
        <View style={styles.qrCard}>
          <QRCode
            value={selected.qrCode}
            size={QR_SIZE}
            quietZone={QR_QUIET}
            ecl={QR_ECL}
          />
        </View>
        <Text style={styles.qrCode}>{selected.qrCode}</Text>
      </View>

      {children.length > 1 && (
        <PressableScale
          style={styles.switchBtn}
          onPress={() => setSelectedId(null)}
        >
          <Ionicons name="swap-horizontal" size={18} color={colors.primaryDarker} />
          <Text style={styles.switchText}>Promeni dete</Text>
        </PressableScale>
      )}
    </View>
  );
}

function PickerRow({ child, index, onPress }) {
  const enter = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      Animated.timing(enter, {
        toValue: 1,
        duration: motion.enter,
        delay: index * motion.stagger,
        useNativeDriver: true,
      }).start();
    }, [index])
  );

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
        ],
      }}
    >
      <PressableScale style={styles.pickerRow} onPress={onPress}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {child.firstName[0]}
            {child.lastName[0]}
          </Text>
        </View>
        <Text style={styles.pickerName}>
          {child.firstName} {child.lastName}
        </Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
      </PressableScale>
    </Animated.View>
  );
}

// Pressable sa scale feedbackom - koristi se svuda gde se pritiska.
function PressableScale({ children, style, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.timing(scale, {
          toValue: 0.96,
          duration: motion.press,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.timing(scale, {
          toValue: 1,
          duration: motion.exit,
          useNativeDriver: true,
        }).start()
      }
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  headerTitle: {
    ...type.title,
    color: colors.textOnPrimary,
  },
  headerSub: {
    ...type.body,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.xs,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSoft,
  },
  noteCard: { backgroundColor: colors.primarySoft },
  alertBody: { flex: 1 },
  alertTitle: {
    ...type.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  alertText: { ...type.body, color: colors.text, marginTop: 2 },
  qrWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCard: {
    backgroundColor: colors.surface,
    padding: spacing.xxl,
    borderRadius: radius.xl,
    ...shadow.card,
  },
  qrCode: {
    ...type.label,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginTop: spacing.xl,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    // QR dugme vise ne strci iz trake (stoji u njenoj kupoli), pa navigator
    // sam odvaja sadrzaj - dodatni razmak nije potreban.
    marginBottom: spacing.xxl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  switchText: {
    ...type.label,
    color: colors.primaryDarker,
  },
  pickerList: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  avatarText: {
    ...type.heading,
    color: colors.textOnPrimary,
  },
  pickerName: {
    ...type.heading,
    color: colors.text,
    flex: 1,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    ...type.heading,
    color: colors.text,
  },
  emptyText: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  cta: {
    marginTop: spacing.xxl,
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
  },
  ctaText: {
    ...type.heading,
    color: colors.textOnAccent,
  },
});
