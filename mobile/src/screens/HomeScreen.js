import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';

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
    (p) => p.isActive && new Date(p.expiresAt) > new Date() && Number(p.remainingHours) > 0
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Zdravo,</Text>
          <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {activePackage ? (
        <View style={styles.packageCard}>
          <Text style={styles.packageLabel}>Preostali sati</Text>
          <View style={styles.hoursRow}>
            <Text style={styles.hoursNumber}>{Number(activePackage.remainingHours).toFixed(1)}</Text>
            <Text style={styles.hoursUnit}>/ {Number(activePackage.package.totalHours)}h</Text>
          </View>
          <Text style={styles.packageName}>{activePackage.package.name}</Text>
          <Text style={styles.packageExpiry}>
            Vazi do: {new Date(activePackage.expiresAt).toLocaleDateString('sr-RS')}
          </Text>
        </View>
      ) : (
        <View style={[styles.packageCard, styles.noPackageCard]}>
          <Text style={styles.noPackageText}>Nemate aktivan paket</Text>
          <Text style={styles.noPackageSubtext}>Kontaktirajte igraonicu za kupovinu paketa</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => navigation.navigate('Children')}
      >
        <View style={styles.menuIconContainer}>
          <Ionicons name="people" size={24} color="#4A3AFF" />
        </View>
        <View style={styles.menuContent}>
          <Text style={styles.menuTitle}>Moja deca</Text>
          <Text style={styles.menuSubtitle}>Pregledaj i dodaj decu, QR kodovi</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#4A3AFF',
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
  },
  packageCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  packageLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  hoursNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: '#4A3AFF',
  },
  hoursUnit: {
    fontSize: 20,
    color: '#999',
    marginLeft: 6,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  packageExpiry: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  noPackageCard: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noPackageText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
  },
  noPackageSubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EDE9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
});
