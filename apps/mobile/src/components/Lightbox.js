import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, type } from '../theme';

// Pregled slike preko celog ekrana. `startIndex` je null kada je zatvoren.
export default function Lightbox({ photos, startIndex, onClose }) {
  const visible = startIndex !== null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Viewer se montira iznova pri svakom otvaranju, pa `current` uvek
          krece od slike koju je korisnik dodirnuo. */}
      {visible && (
        <Viewer photos={photos} startIndex={startIndex} onClose={onClose} />
      )}
    </Modal>
  );
}

function Viewer({ photos, startIndex, onClose }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(startIndex);
  const photo = photos[current];

  function onSettled(e) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== current && photos[i]) setCurrent(i);
  }

  return (
    <View style={styles.backdrop}>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={startIndex}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(p) => p.id}
        onMomentumScrollEnd={onSettled}
        renderItem={({ item }) => (
          <View style={[styles.page, { width, height }]}>
            <Image
              source={item.full}
              style={{ width, height: height * 0.7 }}
              resizeMode="contain"
            />
          </View>
        )}
      />

      <Pressable
        style={[styles.close, { top: insets.top + spacing.md }]}
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Zatvori"
      >
        <Ionicons name="close" size={22} color="#fff" />
      </Pressable>

      <View style={[styles.counter, { top: insets.top + spacing.md }]}>
        <Text style={styles.counterText}>
          {current + 1} / {photos.length}
        </Text>
      </View>

      <View style={[styles.caption, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Text style={styles.captionTitle}>{photo.title}</Text>
        <Text style={styles.captionText}>{photo.caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,15,20,0.97)' },
  page: { alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute',
    right: spacing.xl,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    left: spacing.xl,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  counterText: { ...type.label, color: '#fff' },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  captionTitle: { ...type.heading, color: '#fff' },
  captionText: {
    ...type.body,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.xs,
  },
});
