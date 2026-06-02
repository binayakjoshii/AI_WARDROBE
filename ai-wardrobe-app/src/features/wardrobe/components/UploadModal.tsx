import React, { useState } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  TouchableWithoutFeedback, 
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface ManualTags {
  category: string;
  colorName: string;
  subcategory: string;
}

interface UploadModalProps {
  isVisible: boolean;
  onClose: () => void;
  onImageSelected: (uri: string, status: 'clean' | 'dirty', tags: ManualTags) => void;
}

const CATEGORIES = ['tops', 'bottoms', 'shoes', 'outerwear', 'accessories'];

export default function UploadModal({ isVisible, onClose, onImageSelected }: UploadModalProps) {
  const [garmentStatus, setGarmentStatus] = useState<'clean' | 'dirty'>('clean');
  const [category, setCategory] = useState<string>('tops');
  const [colorName, setColorName] = useState('');
  const [subcategory, setSubcategory] = useState('');

  const validateForm = () => {
    if (!colorName.trim() || !subcategory.trim()) {
      Alert.alert('Missing Details', 'Please enter the color and item type so Aura can recommend it later.');
      return false;
    }
    return true;
  };

  const handleCameraLaunch = async () => {
    if (!validateForm()) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert('Permission Denied', 'We need camera access to capture your clothing items.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], 
      quality: 0.8,  
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      onImageSelected(result.assets[0].uri, garmentStatus, {
        category,
        colorName: colorName.trim(),
        subcategory: subcategory.trim()
      });
      resetAndClose();
    }
  };

  const handleGalleryLaunch = async () => {
    if (!validateForm()) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert('Permission Denied', 'We need access to your photo library to pick images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      onImageSelected(result.assets[0].uri, garmentStatus, {
        category,
        colorName: colorName.trim(),
        subcategory: subcategory.trim()
      });
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setColorName('');
    setSubcategory('');
    setCategory('tops');
    setGarmentStatus('clean');
    onClose();
  };

  return (
    <Modal visible={isVisible} animationType="slide" transparent={true} onRequestClose={resetAndClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <TouchableWithoutFeedback onPress={resetAndClose}>
          <View style={styles.overlayBackground}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.dragHandle} />
                <Text style={styles.title}>Digitize Your Closet</Text>
                <Text style={styles.subtitle}>Tag your item below before snapping a photo.</Text>

                <Text style={styles.inputLabel}>CATEGORY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipContainer}>
                  {CATEGORIES.map((cat) => (
                    <Pressable key={cat} style={[styles.chip, category === cat && styles.chipActive]} onPress={() => setCategory(cat)}>
                      <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <View style={styles.row}>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>COLOR</Text>
                    <TextInput style={styles.input} placeholder="e.g. Black" placeholderTextColor="#9CA3AF" value={colorName} onChangeText={setColorName} />
                  </View>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>TYPE</Text>
                    <TextInput style={styles.input} placeholder="e.g. T-Shirt" placeholderTextColor="#9CA3AF" value={subcategory} onChangeText={setSubcategory} />
                  </View>
                </View>

                <Text style={styles.inputLabel}>STATUS</Text>
                <View style={styles.toggleContainer}>
                  <Pressable style={[styles.toggleBtn, garmentStatus === 'clean' && styles.toggleBtnActive]} onPress={() => setGarmentStatus('clean')}>
                    <Text style={[styles.toggleText, garmentStatus === 'clean' && styles.toggleTextActive]}>✨ Clean</Text>
                  </Pressable>
                  <Pressable style={[styles.toggleBtn, garmentStatus === 'dirty' && styles.toggleBtnActive]} onPress={() => setGarmentStatus('dirty')}>
                    <Text style={[styles.toggleText, garmentStatus === 'dirty' && styles.toggleTextActive]}>🧺 In Laundry</Text>
                  </Pressable>
                </View>
                
                <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} onPress={handleCameraLaunch}>
                  <Text style={styles.buttonText}>Take Photo</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.button, styles.secondaryButton, pressed && styles.secondaryButtonPressed]} onPress={handleGalleryLaunch}>
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>Choose from Gallery</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  overlayBackground: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 10 },
  dragHandle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20, lineHeight: 20, paddingHorizontal: 10 },
  inputLabel: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 8 },
  chipScroll: { width: '100%', flexGrow: 0, marginBottom: 16 },
  chipContainer: { flexDirection: 'row', paddingRight: 20 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  chipTextActive: { color: '#FFFFFF' },
  row: { flexDirection: 'row', width: '100%', gap: 12, marginBottom: 16 },
  inputWrapper: { flex: 1 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827' },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, marginBottom: 24, width: '100%' },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  toggleTextActive: { color: '#111827' },
  button: { width: '100%', backgroundColor: '#111827', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  secondaryButton: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 0 },
  secondaryButtonPressed: { backgroundColor: '#F3F4F6', transform: [{ scale: 0.98 }] },
  secondaryButtonText: { color: '#111827' },
});