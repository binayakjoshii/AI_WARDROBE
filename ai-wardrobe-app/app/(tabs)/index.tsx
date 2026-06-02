import React, { useEffect, useState, useLayoutEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Image, ActivityIndicator, 
  Modal, Pressable, TextInput, TouchableWithoutFeedback, Alert, Platform 
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNavigation } from 'expo-router'; 
import { supabase } from '../../src/lib/supabaseClient';
import UploadModal from '../../src/features/wardrobe/components/UploadModal';
import { useIngestionPipeline } from '../../src/features/wardrobe/hooks/seIngestionPipeline'; 

interface ClothingItem {
  id: string;
  processed_image_url: string;
  category: string;
  color_name: string;
  custom_name?: string;
  status: 'clean' | 'dirty'; 
}

export default function WardrobeScreen() {
  const navigation = useNavigation();

  const [items, setItems] = useState<ClothingItem[]>([]);
  const [isLoadingGrid, setIsLoadingGrid] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const { processImage, isProcessing, statusMessage } = useIngestionPipeline();
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [editName, setEditName] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const fetchCloset = async () => {
    setIsLoadingGrid(true);
    const { data, error } = await supabase
      .from('clothing_items')
      .select('*') 
      .order('created_at', { ascending: false });

    if (!error && data) {
      setItems(data as ClothingItem[]);
    }
    setIsLoadingGrid(false);
  };

  useEffect(() => {
    fetchCloset();
  }, []);

  // 🚨 The crucial 3-argument function block
  const handleImagePicked = async (uri: string, laundryStatus: 'clean' | 'dirty', tags: any) => {
    const result = await processImage(uri, laundryStatus, tags); 
    
    if (result.success) {
      Alert.alert('Success 🎉', 'Garment added to your closet!');
      fetchCloset(); 
    } else {
      Alert.alert('Processing Failed', result.error || 'Unknown error');
    }
  };

  const handleUpdate = async (updates: Partial<ClothingItem>) => {
    if (!selectedItem) return;
    setItems(items.map(item => item.id === selectedItem.id ? { ...item, ...updates } : item));
    setSelectedItem({ ...selectedItem, ...updates } as ClothingItem);
    const { error } = await supabase.from('clothing_items').update(updates).eq('id', selectedItem.id);
    if (error) Alert.alert('Error', 'Failed to update item state.');
  };

  const handleDelete = () => {
    Alert.alert('Delete Item', 'Are you sure you want to remove this?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          if (!selectedItem) return;
          const idToDelete = selectedItem.id;
          setSelectedItem(null);
          setItems(items.filter(item => item.id !== idToDelete));
          await supabase.from('clothing_items').delete().eq('id', idToDelete);
        }
      }
    ]);
  };

  const renderItem = ({ item }: { item: ClothingItem }) => {
    const safeColor = item.color_name || (item as any).colorName || 'Item';
    const safeImage = item.processed_image_url || (item as any).original_image_url || (item as any).image_url;
    const displayName = item.custom_name || `${safeColor} ${item.category}`;
    const rawStatus = (item as any).wear_status || item.status || 'clean';
    const safeStatus = rawStatus === 'dirty' ? 'dirty' : 'clean'; 
    
    return (
      <Pressable style={styles.card} onPress={() => {
        setSelectedItem(item);
        setEditName(item.custom_name || '');
      }}>
        <View style={styles.imageContainer}>
          {safeImage ? (
            <Image source={{ uri: safeImage }} style={styles.image} resizeMode="contain" />
          ) : (
            <FontAwesome name="picture-o" size={32} color="#D1D5DB" />
          )}
          <View style={[styles.statusDot, safeStatus === 'dirty' ? styles.statusDirty : styles.statusClean]} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.nameText} numberOfLines={1}>{displayName}</Text>
          <View style={styles.statusLabelWrapper}>
            <FontAwesome name={safeStatus === 'dirty' ? "bolt" : "check-circle"} size={10} color={safeStatus === 'dirty' ? "#EF4444" : "#10B981"} style={{ marginRight: 4 }}/>
            <Text style={styles.colorText}>{safeStatus === 'dirty' ? 'LAUNDRY' : 'READY'}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <View>
          <Text style={styles.brandTitle}>Aura Studio</Text>
          <Text style={styles.brandSubtext}>Digital Closet Ecosystem</Text>
        </View>
        <View style={styles.inventoryCounterBadge}>
          <FontAwesome name="th-large" size={12} color="#111827" style={{ marginRight: 6 }} />
          <Text style={styles.inventoryCounterText}>{items.length} Items</Text>
        </View>
      </View>

      {isProcessing ? (
        <View style={styles.centerStage}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={styles.processingText}>{statusMessage}</Text>
        </View>
      ) : isLoadingGrid ? (
        <View style={styles.centerStage}><ActivityIndicator size="large" color="#111827" /></View>
      ) : items.length === 0 ? (
        <View style={styles.centerStage}>
          <Text style={styles.emptyText}>Your wardrobe is empty.</Text>
          <Text style={styles.emptySubtext}>Tap + to digitize your first garment.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={styles.gridPadding}
          columnWrapperStyle={styles.rowSpacing}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)} disabled={isProcessing}>
        <FontAwesome name="plus" size={13} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={styles.fabText}>Add Garment</Text>
      </Pressable>

      <UploadModal isVisible={modalVisible} onClose={() => setModalVisible(false)} onImageSelected={handleImagePicked} />

      <Modal visible={!!selectedItem} animationType="slide" transparent={true} onRequestClose={() => setSelectedItem(null)}>
        <TouchableWithoutFeedback onPress={() => setSelectedItem(null)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.dragHandle} />
                {selectedItem && (
                  <>
                    <Image source={{ uri: selectedItem.processed_image_url || (selectedItem as any).original_image_url || (selectedItem as any).image_url }} style={styles.modalImage} resizeMode="contain" />
                    
                    <Text style={styles.label}>Item Name</Text>
                    <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder={`e.g. Favorite ${selectedItem.category}`} onBlur={() => handleUpdate({ custom_name: editName })} />

                    <Text style={styles.label}>Laundry Status</Text>
                    <View style={styles.statusRow}>
                      {['clean', 'dirty'].map((stateKey) => {
                        const activeStatus = selectedItem.status || (selectedItem as any).wear_status || 'clean';
                        const isMatch = (activeStatus === 'dirty' ? 'dirty' : 'clean') === stateKey;
                        return (
                          <Pressable key={stateKey} style={[styles.statusButton, isMatch && styles.statusButtonActive]} onPress={() => handleUpdate({ status: stateKey as any })}>
                            <Text style={[styles.statusButtonText, isMatch && styles.statusTextActive]}>{stateKey === 'dirty' ? '🧺 In Laundry' : '✨ Clean'}</Text>
                          </Pressable>
                        )
                      })}
                    </View>

                    <Pressable style={styles.deleteButton} onPress={handleDelete}>
                      <FontAwesome name="trash-o" size={16} color="#DC2626" style={{ marginRight: 8 }} />
                      <Text style={styles.deleteButtonText}>Delete from Closet</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  appBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 12 : 48, paddingBottom: 18, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6 },
  brandTitle: { fontSize: 22, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  brandSubtext: { fontSize: 11, fontWeight: '500', color: '#9CA3AF', marginTop: 1 },
  inventoryCounterBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  inventoryCounterText: { fontSize: 12, fontWeight: '700', color: '#111827' },
  centerStage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#111827' },
  emptySubtext: { fontSize: 14, color: '#6B7280', marginTop: 8 },
  processingText: { marginTop: 16, fontSize: 14, fontWeight: '500', color: '#4B5563' },
  gridPadding: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 130 },
  rowSpacing: { justifyContent: 'space-between', marginBottom: 16 },
  card: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 8, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  imageContainer: { backgroundColor: '#F9FAFB', borderRadius: 14, height: 160, padding: 12, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  image: { width: '100%', height: '100%' },
  cardText: { paddingTop: 10, paddingHorizontal: 4, paddingBottom: 4 },
  nameText: { fontSize: 13, fontWeight: '700', color: '#111827', textTransform: 'capitalize' },
  statusLabelWrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  colorText: { fontSize: 11, color: '#6B7280', letterSpacing: 0.3, fontWeight: '700' },
  statusDot: { position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#F9FAFB' },
  statusClean: { backgroundColor: '#10B981' },
  statusDirty: { backgroundColor: '#EF4444' },
  fab: { position: 'absolute', bottom: 32, alignSelf: 'center', backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 26, paddingVertical: 15, borderRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 },
  fabText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48, alignItems: 'center' },
  dragHandle: { width: 38, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginBottom: 20 },
  modalImage: { width: 120, height: 120, marginBottom: 24 },
  label: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { width: '100%', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 16, fontSize: 16, color: '#111827', marginBottom: 24 },
  statusRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginBottom: 32 },
  statusButton: { flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, marginHorizontal: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  statusButtonActive: { backgroundColor: '#111827', borderColor: '#111827' },
  statusButtonText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  statusTextActive: { color: '#FFFFFF' },
  deleteButton: { width: '100%', paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#FEF2F2' },
  deleteButtonText: { color: '#DC2626', fontSize: 16, fontWeight: '700' }
});