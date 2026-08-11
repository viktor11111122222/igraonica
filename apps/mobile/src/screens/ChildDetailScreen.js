import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { apiRequest } from '../utils/api';
import { font } from '../theme';

export default function ChildDetailScreen({ route, navigation }) {
  const { child: initialChild } = route.params;
  const [child, setChild] = useState(initialChild);
  const [visits, setVisits] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    try {
      const [childData, visitsData] = await Promise.all([
        apiRequest(`/children/${child.id}`),
        apiRequest('/visits/my?limit=5'),
      ]);
      setChild(childData.child);
      const childVisits = (visitsData.visits || []).filter((v) => v.childId === child.id);
      setVisits(childVisits);
    } catch {}
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  function getAge(dateOfBirth) {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString('sr-RS');
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' });
  }

  function handleDelete() {
    Alert.alert(
      'Potvrda',
      `Da li ste sigurni da zelite da uklonite ${child.firstName}?`,
      [
        { text: 'Ne', style: 'cancel' },
        {
          text: 'Da, ukloni',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/children/${child.id}`, { method: 'DELETE' });
              navigation.goBack();
            } catch (err) {
              Alert.alert('Greska', err.message);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {child.firstName[0]}{child.lastName[0]}
          </Text>
        </View>
        <Text style={styles.name}>{child.firstName} {child.lastName}</Text>
        <Text style={styles.age}>{getAge(child.dateOfBirth)} godina</Text>
        <Text style={styles.birthday}>Rodjendan: {formatDate(child.dateOfBirth)}</Text>
        {child.gender && (
          <Text style={styles.info}>Pol: {child.gender === 'MALE' ? 'Muski' : 'Zenski'}</Text>
        )}
        {child.allergies && (
          <View style={styles.allergyBadge}>
            <Text style={styles.allergyText}>Alergije: {child.allergies}</Text>
          </View>
        )}
        {child.notes && (
          <View style={styles.notesBadge}>
            <Text style={styles.notesText}>{child.notes}</Text>
          </View>
        )}
      </View>

      <View style={styles.qrSection}>
        <Text style={styles.sectionTitle}>QR Kod za Check-In / Check-Out</Text>
        <View style={styles.qrContainer}>
          <QRCode value={child.qrCode} size={200} />
        </View>
        <Text style={styles.qrCode}>{child.qrCode}</Text>
        <Text style={styles.qrHint}>Pokazite ovaj kod na recepciji pri dolasku i odlasku</Text>
      </View>

      {visits.length > 0 && (
        <View style={styles.visitsSection}>
          <Text style={styles.sectionTitle}>Poslednje posete</Text>
          {visits.map((visit) => (
            <View key={visit.id} style={styles.visitCard}>
              <View style={styles.visitRow}>
                <Text style={styles.visitDate}>{formatDate(visit.checkedInAt)}</Text>
                <View style={[
                  styles.statusBadge,
                  visit.status === 'CHECKED_IN' ? styles.statusActive : styles.statusDone,
                ]}>
                  <Text style={styles.statusText}>
                    {visit.status === 'CHECKED_IN' ? 'U igraonici' : 'Zavrseno'}
                  </Text>
                </View>
              </View>
              <Text style={styles.visitTime}>
                Dolazak: {formatTime(visit.checkedInAt)}
                {visit.checkedOutAt && ` — Odlazak: ${formatTime(visit.checkedOutAt)}`}
              </Text>
              {visit.durationMinutes && (
                <Text style={styles.visitDuration}>
                  Trajanje: {visit.durationMinutes} min ({Number(visit.hoursDeducted).toFixed(2)}h)
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>Ukloni dete</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7c9fc9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontFamily: font.bold,
  },
  name: {
    fontSize: 24,
    fontFamily: font.bold,
    color: '#333',
  },
  age: {
    fontSize: 16,
    color: '#888',
    marginTop: 4,
  },
  birthday: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  info: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  allergyBadge: {
    backgroundColor: '#FFF3F3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
  },
  allergyText: {
    color: '#E74C3C',
    fontSize: 13,
    fontFamily: font.medium,
  },
  notesBadge: {
    backgroundColor: '#F4F8FB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  notesText: {
    color: '#6b7a8d',
    fontSize: 13,
    fontFamily: font.medium,
    textAlign: 'center',
  },
  qrSection: {
    alignItems: 'center',
    backgroundColor: '#fff',
    marginTop: 12,
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: font.semibold,
    color: '#333',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  qrCode: {
    fontSize: 14,
    fontFamily: font.semibold,
    color: '#7c9fc9',
    marginTop: 12,
    letterSpacing: 1,
  },
  qrHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  visitsSection: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingVertical: 20,
  },
  visitCard: {
    marginHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  visitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  visitDate: {
    fontSize: 15,
    fontFamily: font.semibold,
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#E8F5E9',
  },
  statusDone: {
    backgroundColor: '#F0F0F0',
  },
  statusText: {
    fontSize: 12,
    fontFamily: font.medium,
    color: '#555',
  },
  visitTime: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  visitDuration: {
    fontSize: 13,
    color: '#7c9fc9',
    marginTop: 2,
  },
  deleteButton: {
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E74C3C',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#E74C3C',
    fontSize: 16,
    fontFamily: font.medium,
  },
});
