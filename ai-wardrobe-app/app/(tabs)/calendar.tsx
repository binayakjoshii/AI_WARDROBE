import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { decode } from 'base64-arraybuffer';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Modal, 
  TextInput, 
  Alert, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import * as ImagePicker from 'expo-image-picker';
import { Camera, X, BarChart2, Search, CloudSun, Trash2, AlertTriangle } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabaseClient'; // Adjust path as needed

interface OutfitLog {
  id: string;
  date: string;
  occasion: string;
  outfitDetails: string;
  imageUri?: string | null;
  rating?: string;
  weather?: string;
}

const RATINGS = [
  { emoji: '🔥', label: 'Amazing' },
  { emoji: '👍', label: 'Good' },
  { emoji: '😐', label: 'Okay' },
];

const QUICK_FILTERS = ['All', 'Office', 'Date', 'Casual', 'Party'];

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState('');
  
  // Modals & Loaders
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [insightsVisible, setInsightsVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Form State
  const [occasion, setOccasion] = useState('');
  const [outfitDetails, setOutfitDetails] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null); 
  const [selectedRating, setSelectedRating] = useState<string>('👍');

  // List State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [logs, setLogs] = useState<OutfitLog[]>([]); 

  // ========================================================
  // CLOUD SYNC: FETCH LOGS FROM SUPABASE
  // ========================================================
  const fetchOutfitLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('outfit_calendar')
        .select('*')
        .order('event_date', { ascending: false });

      if (error) throw error;

      if (data) {
        const loadedLogs: OutfitLog[] = data.map((row: any) => ({
          id: row.id.toString(),
          date: row.event_date,
          occasion: row.event_name,
          outfitDetails: row.outfit_blueprint,
          imageUri: row.image_url,
          rating: row.rating || '👍',
          weather: row.weather || '28°C, Clear',
        }));
        setLogs(loadedLogs);
      }
    } catch (error) {
      console.error("Failed to load calendar data:", error);
      Alert.alert("Sync Error", "Could not load your wardrobe calendar.");
    } finally {
      setIsFetching(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOutfitLogs();
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchOutfitLogs();
  }, []);

  // ========================================================
  // DATA LIFECYCLE: DELETION HANDLERS
  // ========================================================
  const handleDeleteSingleLog = (logItem: OutfitLog) => {
    Alert.alert(
      "Delete Outfit",
      "Are you sure you want to remove this look from your calendar?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              // 1. Delete from Database
              const { error: dbError } = await supabase.from('outfit_calendar').delete().eq('id', logItem.id);
              if (dbError) throw dbError;

              // 2. Cleanup Cloud Storage (Delete the image file to save space)
              if (logItem.imageUri && logItem.imageUri.includes('ootd_logs/')) {
                const fileName = logItem.imageUri.split('ootd_logs/')[1];
                await supabase.storage.from('wardrobe').remove([`ootd_logs/${fileName}`]);
              }

              // 3. Update UI
              setLogs(prev => prev.filter(l => l.id !== logItem.id));
            } catch (error) {
              console.error("Delete failed:", error);
              Alert.alert("Error", "Could not delete the outfit.");
            }
          }
        }
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      "DANGER: Clear All Data",
      "This will permanently delete every outfit logged in your calendar. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Wipe Calendar", 
          style: "destructive", 
          onPress: async () => {
            try {
              // Delete all rows in the table
              const { error } = await supabase.from('outfit_calendar').delete().not('id', 'is', null);
              if (error) throw error;
              
              setLogs([]); // Clear UI
              setInsightsVisible(false); // Close Modal
              Alert.alert("Success", "Your calendar has been wiped clean.");
            } catch (error) {
              console.error("Bulk delete failed:", error);
              Alert.alert("Error", "Could not clear database.");
            }
          }
        }
      ]
    );
  };

  // --- LOGIC: CALENDAR MARKS ---
  const markedDates = useMemo(() => {
    const marks: any = {};
    logs.forEach(log => {
      marks[log.date] = { marked: true, dotColor: '#111827' };
    });
    if (selectedDate) {
      marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: '#111827' };
    }
    return marks;
  }, [logs, selectedDate]);

  // --- LOGIC: FILTERING & SEARCH ---
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = log.occasion.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            log.outfitDetails.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = activeFilter === 'All' || log.occasion.toLowerCase().includes(activeFilter.toLowerCase());
      return matchesSearch && matchesFilter;
    });
  }, [logs, searchQuery, activeFilter]);

  const totalLogs = logs.length;
  const bestOutfits = logs.filter(l => l.rating === '🔥').length;
  
  // --- HANDLERS ---
  const handleDatePress = (day: any) => {
    setSelectedDate(day.dateString);
    setLogModalVisible(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.5, 
      base64: true, 
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
    }
  };

  const handleManualLog = async () => {
    if (!occasion || !outfitDetails) return Alert.alert("Missing Details", "Please fill out the occasion and details.");

    setIsUploading(true);
    let finalImageUrl = null;
    const mockedWeather = "28°C, Clear";

    try {
      if (imageUri && imageBase64) {
        const fileName = `ootd_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('wardrobe') 
          .upload(`ootd_logs/${fileName}`, decode(imageBase64), { contentType: 'image/jpeg' });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('wardrobe').getPublicUrl(`ootd_logs/${fileName}`);
        finalImageUrl = publicUrlData.publicUrl;
      }

      const { data: dbData, error: dbError } = await supabase
        .from('outfit_calendar') 
        .insert({
          event_date: selectedDate,
          event_name: occasion.trim(),
          outfit_blueprint: outfitDetails.trim(),
          image_url: finalImageUrl,
          rating: selectedRating,
          weather: mockedWeather
        })
        .select()
        .single();

      if (dbError) throw dbError;

      const newLog: OutfitLog = {
        id: dbData.id.toString(),
        date: dbData.event_date,
        occasion: dbData.event_name,
        outfitDetails: dbData.outfit_blueprint,
        imageUri: dbData.image_url,
        rating: dbData.rating,
        weather: dbData.weather,
      };

      setLogs(prev => [...prev, newLog].sort((a, b) => (a.date > b.date ? -1 : 1)));
      
      setOccasion(''); setOutfitDetails(''); setImageUri(null); setImageBase64(null); setSelectedRating('👍');
      setLogModalVisible(false);

    } catch (error: any) {
      console.error("Upload Error:", error);
      Alert.alert("Upload Failed", error.message || "Something went wrong saving your log.");
    } finally {
      setIsUploading(false);
    }
  };

  // --- RENDERERS ---
  const renderLogItem = ({ item }: { item: OutfitLog }) => (
    <View style={styles.logCard}>
      {item.imageUri && (
        <Image source={{ uri: item.imageUri }} style={styles.logImage} />
      )}
      <View style={styles.logContent}>
        <View style={styles.logHeader}>
          <Text style={styles.logOccasion}>{item.occasion}</Text>
          <View style={styles.logActions}>
            <Text style={styles.logEmoji}>{item.rating}</Text>
            <Pressable onPress={() => handleDeleteSingleLog(item)} style={styles.trashBtn}>
              <Trash2 color="#EF4444" size={18} />
            </Pressable>
          </View>
        </View>
        <Text style={styles.logDate}>{item.date} • {item.weather}</Text>
        <Text style={styles.logDetails}>{item.outfitDetails}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 1. CALENDAR WIDGET */}
      <View style={styles.calendarContainer}>
        {isFetching ? (
          <View style={styles.calendarLoader}>
            <ActivityIndicator size="large" color="#111827" />
            <Text style={styles.loaderText}>Syncing with Cloud...</Text>
          </View>
        ) : (
          <Calendar 
            style={styles.calendarWidget}
            onDayPress={handleDatePress}
            markedDates={markedDates}
            theme={{
              backgroundColor: '#ffffff',
              calendarBackground: '#ffffff',
              selectedDayBackgroundColor: '#111827',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#3B82F6',
              dayTextColor: '#111827',
              arrowColor: '#111827',
            }}
          />
        )}
      </View>

      {/* 2. SEARCH & FILTERS */}
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Search color="#9CA3AF" size={18} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search logs..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <Pressable style={styles.insightBtn} onPress={() => setInsightsVisible(true)}>
            <BarChart2 color="#111827" size={20} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {QUICK_FILTERS.map(filter => (
            <Pressable 
              key={filter} 
              style={[styles.chip, activeFilter === filter && styles.chipActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.chipText, activeFilter === filter && styles.chipTextActive]}>{filter}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* 3. SCROLLABLE LOG LIST WITH PULL-TO-REFRESH */}
      <FlatList
        data={filteredLogs}
        keyExtractor={(item) => item.id}
        renderItem={renderLogItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#111827" />
        }
        ListEmptyComponent={
          !isFetching ? <Text style={styles.emptyText}>No outfits planned yet. Tap a date to start.</Text> : null
        }
      />

      {/* --- MODAL 1: ADD LOG --- */}
      <Modal visible={logModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Log Outfit</Text>
                <Pressable onPress={() => setLogModalVisible(false)} disabled={isUploading}>
                  <X color="#111827" size={24} />
                </Pressable>
              </View>
              <Text style={styles.modalSubtitle}>{selectedDate}</Text>

              {imageUri ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                  <Pressable style={styles.removeImageBtn} onPress={() => { setImageUri(null); setImageBase64(null); }}>
                    <X color="#FFF" size={16} />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.photoBtn} onPress={pickImage}>
                  <Camera color="#6B7280" size={24} />
                  <Text style={styles.photoBtnText}>Add OOTD Photo</Text>
                </Pressable>
              )}

              <TextInput 
                style={styles.input} 
                placeholder="Occasion (e.g., Office Party)" 
                placeholderTextColor="#9CA3AF"
                value={occasion}
                onChangeText={setOccasion} 
              />
              <TextInput 
                style={[styles.input, styles.textArea]} 
                placeholder="What did you wear? (e.g., Black Chinos, White Oxford)" 
                placeholderTextColor="#9CA3AF"
                multiline
                value={outfitDetails}
                onChangeText={setOutfitDetails} 
              />

              <Text style={styles.label}>How did you feel?</Text>
              <View style={styles.ratingRow}>
                {RATINGS.map(rate => (
                  <Pressable 
                    key={rate.emoji}
                    style={[styles.ratingBtn, selectedRating === rate.emoji && styles.ratingBtnActive]}
                    onPress={() => setSelectedRating(rate.emoji)}
                  >
                    <Text style={styles.ratingEmoji}>{rate.emoji}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable 
                style={[styles.primaryBtn, isUploading && styles.primaryBtnDisabled]} 
                onPress={handleManualLog}
                disabled={isUploading}
              >
                {isUploading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Save to Logbook</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- MODAL 2: AURA INSIGHTS & SETTINGS --- */}
      <Modal visible={insightsVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayCentered}>
          <View style={styles.insightsCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Aura Insights</Text>
              <Pressable onPress={() => setInsightsVisible(false)}><X color="#111827" size={24} /></Pressable>
            </View>
            
            <View style={styles.statRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{totalLogs}</Text>
                <Text style={styles.statLabel}>Total Logs</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{bestOutfits}</Text>
                <Text style={styles.statLabel}>Fire 🔥 Outfits</Text>
              </View>
            </View>
            
            <View style={styles.insightAlert}>
              <CloudSun color="#3B82F6" size={24} />
              <Text style={styles.insightAlertText}>You favor light colors when the weather is above 25°C.</Text>
            </View>

            {/* THE NUCLEAR OPTION: BULK DELETE */}
            <Pressable style={styles.bulkDeleteBtn} onPress={handleClearAllData}>
              <AlertTriangle color="#EF4444" size={18} />
              <Text style={styles.bulkDeleteText}>Wipe Calendar Data</Text>
            </Pressable>

          </View>
        </View>
      </Modal>

    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  
  calendarContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, backgroundColor: '#F3F4F6', minHeight: 360 },
  calendarWidget: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  calendarLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  loaderText: { marginTop: 12, color: '#6B7280', fontWeight: '600' },
  
  toolbar: { padding: 16, backgroundColor: '#F3F4F6', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 8, paddingHorizontal: 12, height: 40, marginRight: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#111827' },
  insightBtn: { width: 40, height: 40, backgroundColor: '#FFF', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  filterScroll: { flexDirection: 'row' },
  chip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#FFF', marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 13, color: '#4B5563', fontWeight: '600' },
  chipTextActive: { color: '#FFF' },

  listContent: { padding: 16, paddingBottom: 80 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 14, fontWeight: '500' },
  
  logCard: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  logImage: { width: '100%', height: 250, resizeMode: 'cover' },
  logContent: { padding: 16 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  logOccasion: { fontSize: 16, fontWeight: '800', color: '#111827', flex: 1 },
  logActions: { flexDirection: 'row', alignItems: 'center' },
  logEmoji: { fontSize: 18, marginRight: 12 },
  trashBtn: { padding: 4 },
  logDate: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
  logDetails: { fontSize: 14, color: '#4B5563', lineHeight: 22 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalOverlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  insightsCard: { backgroundColor: '#FFF', padding: 24, borderRadius: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20, marginTop: 2 },
  
  photoBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 20, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  photoBtnText: { marginLeft: 8, color: '#6B7280', fontWeight: '600' },
  imagePreviewContainer: { position: 'relative', marginBottom: 16 },
  imagePreview: { width: '100%', height: 200, borderRadius: 12 },
  removeImageBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 20 },
  
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', padding: 16, borderRadius: 12, marginBottom: 12, fontSize: 15, color: '#111827' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  
  label: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 10, marginTop: 4 },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  ratingBtn: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: '#F9FAFB', borderRadius: 12, marginHorizontal: 4, borderWidth: 1, borderColor: 'transparent' },
  ratingBtnActive: { backgroundColor: '#FFF', borderColor: '#111827' },
  ratingEmoji: { fontSize: 24 },
  
  primaryBtn: { backgroundColor: '#111827', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  primaryBtnDisabled: { backgroundColor: '#4B5563' },
  primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  statBox: { flex: 1, backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, alignItems: 'center', marginHorizontal: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  statNumber: { fontSize: 24, fontWeight: '900', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4, fontWeight: '600' },
  insightAlert: { flexDirection: 'row', backgroundColor: '#EFF6FF', padding: 16, borderRadius: 12, marginTop: 20, alignItems: 'center' },
  insightAlertText: { marginLeft: 12, flex: 1, color: '#1E3A8A', fontWeight: '500', lineHeight: 20 },

  bulkDeleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 30, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  bulkDeleteText: { color: '#EF4444', fontWeight: '700', fontSize: 14, marginLeft: 8 }
});