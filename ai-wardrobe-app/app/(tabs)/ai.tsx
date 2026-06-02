import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, Pressable, FlatList, 
  KeyboardAvoidingView, Platform, SafeAreaView, Image, Alert
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; // <-- Added AsyncStorage

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string; 
}

export default function AIScreen() {
  const navigation = useNavigation();
  const [inputText, setInputText] = useState('');
  const [demoTemp, setDemoTemp] = useState<number>(28); 
  const [isRaining, setIsRaining] = useState<boolean>(false);
  const flatListRef = useRef<FlatList>(null);

  // Core System Lifecycle Lock
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const formatCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const initialGreeting: Message = { 
    id: '1', 
    text: "Hi! I'm your AI Stylist Aura. Tell me where you're heading, and I'll compile a premium outfit silhouette using only your clean wardrobe items.", 
    sender: 'ai',
    timestamp: formatCurrentTime()
  };

  const [messages, setMessages] = useState<Message[]>([initialGreeting]);

  // ========================================================
  // 💾 1. LOAD CHATS WHEN SCREEN OPENS
  // ========================================================
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const savedHistory = await AsyncStorage.getItem('@aura_chat_history');
        if (savedHistory !== null) {
          setMessages(JSON.parse(savedHistory));
        }
      } catch (e) {
        console.error("Failed to load history", e);
      }
    };
    loadChatHistory();
  }, []);

  // ========================================================
  // 💾 2. HELPER: UPDATE STATE AND SAVE TO PHONE
  // ========================================================
  const updateMessagesAndSave = async (newMessagesArray: Message[]) => {
    setMessages(newMessagesArray); // Instantly update UI
    try {
      await AsyncStorage.setItem('@aura_chat_history', JSON.stringify(newMessagesArray)); // Save to storage
    } catch (e) {
      console.error("Failed to save history", e);
    }
  };

  // ========================================================
  // CORE NETWORK LOGIC & EMBEDDED RETRY DISPATCH HANDLERS
  // ========================================================
  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userText = inputText.trim();
    const currentTimestamp = formatCurrentTime();
    
    const newUserMessage: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: 'user',
      timestamp: currentTimestamp
    };

    const loadingMessageId = (Date.now() + 1).toString();
    const loadingMessage: Message = { 
      id: loadingMessageId, 
      text: `Scanning closet inventory and tracking current conditions (${demoTemp}°C, ${isRaining ? 'Raining' : 'Clear'})...`, 
      sender: 'ai',
      timestamp: formatCurrentTime()
    };

    // 1. Add User Message and Loading Message simultaneously
    const updatedWithLoading = [...messages, newUserMessage, loadingMessage];
    await updateMessagesAndSave(updatedWithLoading);
    setInputText('');

    // Auto-scroll layout to latest chat position
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const backendUrl = `${process.env.EXPO_PUBLIC_API_URL}/api/recommend`;
      
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: userText,
          current_temp: demoTemp,
          is_raining: isRaining
        }), 
      });

      if (!response.ok) throw new Error('Network response drop.');

      const data = await response.json();

      // 2. Replace loading message with actual AI response and SAVE
      const finalMessages = updatedWithLoading.map(msg => 
        msg.id === loadingMessageId 
          ? { ...msg, text: data.recommendation || "I found a great combination for you." } 
          : msg
      );
      
      await updateMessagesAndSave(finalMessages);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    } catch (error) {
      console.error("Chat API Error:", error);
      
      // 3. Replace loading message with error message and SAVE
      const errorMessages = updatedWithLoading.map(msg => 
        msg.id === loadingMessageId 
          ? { ...msg, text: "I'm having trouble reaching the styling engine. Make sure the Python server is running!" } 
          : msg
      );
      await updateMessagesAndSave(errorMessages);
    }
  };

  const clearChatHistory = () => {
    Alert.alert('Clear Conversation', 'Are you sure you want to flush all chat logs?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Clear All', 
        style: 'destructive',
        onPress: async () => {
          const resetMessage: Message = { 
            id: Date.now().toString(), 
            text: "Conversation refreshed. Let me know what profile look you need.", 
            sender: 'ai',
            timestamp: formatCurrentTime()
          };
          // Clear UI and overwrite the saved phone storage
          await updateMessagesAndSave([resetMessage]);
        }
      }
    ]);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAI]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextAI]}>
            {item.text}
          </Text>
          <Text style={[styles.timestampText, isUser ? styles.timestampUser : styles.timestampAI]}>
            {item.timestamp}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Premium WhatsApp-Style Custom Header Component */}
      <View style={styles.appBar}>
        <View style={styles.appBarProfile}>
          <View style={styles.avatarWrapper}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150' }} 
              style={styles.aiAvatar} 
            />
            <View style={styles.activeIndicator} />
          </View>
          <View style={styles.profileTextMetaData}>
            <Text style={styles.profileName}>Aura Stylist</Text>
            <Text style={styles.profileSubtext}>AI Wardrobe Assistant • Online</Text>
          </View>
        </View>
        <Pressable onPress={clearChatHistory} style={styles.clearBtn}>
          <FontAwesome name="trash-o" size={20} color="#6B7280" />
        </Pressable>
      </View>

      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Presentation Controls HUD Panel */}
        <View style={styles.hudContainer}>
          <Text style={styles.hudTitle}>Presentation Controls HUD</Text>
          <View style={styles.hudRow}>
            <View style={styles.tempControl}>
              <Pressable onPress={() => setDemoTemp(prev => Math.max(5, prev - 5))} style={styles.hudBtn}>
                <FontAwesome name="minus" size={10} color="#111827" />
              </Pressable>
              <View style={styles.tempDisplayWrapper}>
                <FontAwesome name="thermometer-half" size={12} color="#111827" style={{ marginRight: 4 }} />
                <Text style={styles.hudValueText}>{demoTemp}°C</Text>
              </View>
              <Pressable onPress={() => setDemoTemp(prev => Math.min(45, prev + 5))} style={styles.hudBtn}>
                <FontAwesome name="plus" size={10} color="#111827" />
              </Pressable>
            </View>

            <Pressable 
              onPress={() => setIsRaining(prev => !prev)} 
              style={[styles.rainBtn, isRaining && styles.rainBtnActive]}
            >
              <View style={styles.rainBtnContent}>
                <FontAwesome 
                  name={isRaining ? "cloud" : "sun-o"} 
                  size={12} 
                  color={isRaining ? "#2563EB" : "#4B5563"} 
                  style={{ marginRight: 6 }} 
                />
                <Text style={[styles.rainBtnText, isRaining && styles.rainBtnTextActive]}>
                  {isRaining ? 'Raining' : 'Clear'}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Chat History Area */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatPadding}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask Aura to generate an outfit look..."
            placeholderTextColor="#9CA3AF"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <Pressable 
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]} 
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <FontAwesome name="paper-plane" size={16} color="#FFFFFF" style={styles.sendIcon} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ========================================================
// PREMIUM MINIMALIST DESIGN SYSTEM STYLING SPECIFICATIONS
// ========================================================
const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#FAFAFA' 
  },
  container: { 
    flex: 1 
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 48, 
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
  },
  appBarProfile: { flexDirection: 'row', alignItems: 'center' },
  avatarWrapper: { position: 'relative' },
  aiAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F3F4F6' },
  activeIndicator: { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#FFFFFF' },
  profileTextMetaData: { marginLeft: 12 },
  profileName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  profileSubtext: { fontSize: 11, fontWeight: '500', color: '#6B7280', marginTop: 1 },
  clearBtn: { padding: 8, borderRadius: 8 },

  hudContainer: { backgroundColor: '#FFFFFF', padding: 14, marginHorizontal: 20, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', marginTop: 14, marginBottom: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  hudTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  hudRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tempControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, padding: 2 },
  tempDisplayWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  hudBtn: { backgroundColor: '#FFFFFF', width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  hudValueText: { fontSize: 14, fontWeight: '700', color: '#111827', minWidth: 42, textAlign: 'center' },
  rainBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  rainBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  rainBtnContent: { flexDirection: 'row', alignItems: 'center' },
  rainBtnText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  rainBtnTextActive: { color: '#2563EB' },

  chatPadding: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  messageRow: { width: '100%', marginBottom: 12, flexDirection: 'row' },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowAI: { justifyContent: 'flex-start' },
  
  bubble: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, position: 'relative' },
  bubbleUser: { backgroundColor: '#111827', borderBottomRightRadius: 2 }, 
  bubbleAI: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: '#E5E7EB' }, 
  messageText: { fontSize: 15, lineHeight: 21 },
  messageTextUser: { color: '#FFFFFF' },
  messageTextAI: { color: '#111827' },
  timestampText: { fontSize: 9, marginTop: 4, alignSelf: 'flex-end', fontWeight: '500' },
  timestampUser: { color: '#9CA3AF' },
  timestampAI: { color: '#9CA3AF' },

  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  textInput: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 15, maxHeight: 90, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  sendButton: { backgroundColor: '#111827', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 1 },
  sendButtonDisabled: { backgroundColor: '#E5E7EB' },
  sendIcon: { marginLeft: 2 }, 
});