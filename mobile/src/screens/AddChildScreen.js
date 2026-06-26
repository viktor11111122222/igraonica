import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { apiRequest } from '../utils/api';

export default function AddChildScreen({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState(null);
  const [allergies, setAllergies] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!firstName.trim() || !lastName.trim() || !dateOfBirth.trim()) {
      Alert.alert('Greska', 'Ime, prezime i datum rodjenja su obavezni.');
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateOfBirth)) {
      Alert.alert('Greska', 'Datum mora biti u formatu YYYY-MM-DD.');
      return;
    }

    setLoading(true);
    try {
      await apiRequest('/children', {
        method: 'POST',
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth,
          gender,
          allergies: allergies.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      });

      Alert.alert('Uspeh', 'Dete je uspesno dodato!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Greska', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.form}>
        <Text style={styles.label}>Ime *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ime deteta"
          placeholderTextColor="#999"
          value={firstName}
          onChangeText={setFirstName}
        />

        <Text style={styles.label}>Prezime *</Text>
        <TextInput
          style={styles.input}
          placeholder="Prezime deteta"
          placeholderTextColor="#999"
          value={lastName}
          onChangeText={setLastName}
        />

        <Text style={styles.label}>Datum rodjenja *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#999"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
        />

        <Text style={styles.label}>Pol</Text>
        <View style={styles.genderRow}>
          <TouchableOpacity
            style={[styles.genderBtn, gender === 'MALE' && styles.genderActive]}
            onPress={() => setGender(gender === 'MALE' ? null : 'MALE')}
          >
            <Text style={[styles.genderText, gender === 'MALE' && styles.genderTextActive]}>
              Muski
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderBtn, gender === 'FEMALE' && styles.genderActive]}
            onPress={() => setGender(gender === 'FEMALE' ? null : 'FEMALE')}
          >
            <Text style={[styles.genderText, gender === 'FEMALE' && styles.genderTextActive]}>
              Zenski
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Alergije</Text>
        <TextInput
          style={styles.input}
          placeholder="npr. kikiriki, gluten"
          placeholderTextColor="#999"
          value={allergies}
          onChangeText={setAllergies}
        />

        <Text style={styles.label}>Napomene</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Dodatne napomene..."
          placeholderTextColor="#999"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Dodaj dete</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  genderActive: {
    backgroundColor: '#4A3AFF',
    borderColor: '#4A3AFF',
  },
  genderText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  genderTextActive: {
    color: '#fff',
  },
  button: {
    backgroundColor: '#4A3AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 30,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
