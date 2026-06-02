import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabaseClient';

export default function ProfileScreen() {
  const [stats, setStats] = useState({ total: 0, clean: 0, dirty: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('clothing_items').select('wear_status');
    if (!error && data) {
      setStats({
        total: data.length,
        clean: data.filter(item => item.wear_status === 'clean').length,
        dirty: data.filter(item => item.wear_status === 'dirty').length,
      });
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  const handleLaundryDay = async () => {
    if (stats.dirty === 0) return Alert.alert('All Clean', 'Your closet is already fresh!');
    
    Alert.alert('Laundry Day 🧺', 'Reset all dirty items to clean?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Wash All', onPress: async () => {
        const { error } = await supabase.from('clothing_items')
          .update({ wear_status: 'clean' }).eq('wear_status', 'dirty');
        if (!error) { fetchStats(); Alert.alert('Success', 'Wardrobe refreshed.'); }
      }}
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrapper}>
          <Text style={styles.initials}>BJ</Text>
        </View>
        <Text style={styles.name}>Binayak Joshi</Text>
        <Text style={styles.bio}>Full-Stack Developer • Calisthenics</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={[styles.statVal, { color: '#111827' }]}>{stats.total}</Text><Text style={styles.statLabel}>Total</Text></View>
        <View style={styles.statCard}><Text style={[styles.statVal, { color: '#10B981' }]}>{stats.clean}</Text><Text style={styles.statLabel}>Ready</Text></View>
        <View style={styles.statCard}><Text style={[styles.statVal, { color: '#EF4444' }]}>{stats.dirty}</Text><Text style={styles.statLabel}>Laundry</Text></View>
      </View>

      <View style={styles.menuSection}>
        <MenuButton icon="tint" label="Refresh Laundry" color="#3B82F6" onPress={handleLaundryDay} />
        <MenuButton icon="cog" label="Account Settings" color="#6B7280" />
        <MenuButton icon="sign-out" label="Sign Out" color="#EF4444" isLast />
      </View>
    </ScrollView>
  );
}

const MenuButton = ({ icon, label, color, onPress, isLast }: any) => (
  <Pressable style={[styles.menuItem, isLast && { borderBottomWidth: 0 }]} onPress={onPress}>
    <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
      <FontAwesome name={icon} size={18} color={color} />
    </View>
    <Text style={styles.menuLabel}>{label}</Text>
    <FontAwesome name="chevron-right" size={14} color="#D1D5DB" />
  </Pressable>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 20, paddingTop: 60 },
  profileHeader: { alignItems: 'center', marginBottom: 30 },
  avatarWrapper: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  initials: { fontSize: 32, fontWeight: '800', color: '#FFF' },
  name: { fontSize: 24, fontWeight: '800', color: '#111827' },
  bio: { fontSize: 14, color: '#6B7280', marginTop: 5 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  statCard: { flex: 1, backgroundColor: '#FFF', padding: 20, marginHorizontal: 5, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginTop: 5 },
  menuSection: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: '#374151' }
});