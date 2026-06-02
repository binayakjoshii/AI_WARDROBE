import React from 'react';
import { Tabs } from 'expo-router';
import { Shirt, Calendar, User, Sparkles } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // Hides the clunky native header
        tabBarActiveTintColor: '#111827', // Premium deep black for active tab
        tabBarInactiveTintColor: '#9CA3AF', // Soft grey for inactive
        tabBarStyle: {
          height: 60,
          paddingBottom: 5,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
        },
      }}>
      
      <Tabs.Screen
        name="index"
        options={{
          title: 'Closet',
          tabBarIcon: ({ color, size }) => <Shirt color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="calendar" 
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="ai" 
        options={{
          title: 'Aura AI',
          tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="profile" 
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}