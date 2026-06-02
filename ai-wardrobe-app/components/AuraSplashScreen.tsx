import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface AuraSplashScreenProps {
  onFinish: () => void;
}

export default function AuraSplashScreen({ onFinish }: AuraSplashScreenProps) {
  // Animation Values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringOpacityAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // 1. Entrance Animation: Fade in and scale up smoothly
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    // 2. The "Aura" Pulse: Infinite breathing effect
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.5,
            duration: 1500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacityAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          })
        ]),
        // Reset instantly for the next loop
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacityAnim, {
          toValue: 0.8,
          duration: 0,
          useNativeDriver: true,
        })
      ])
    ).start();

    // 3. Exit Animation: Wait 3 seconds, fade out, and tell the app to load
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        onFinish(); // Triggers the transition to the main app
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      
      {/* The Pulsing Aura Graphic */}
      <View style={styles.graphicContainer}>
        {/* Outer expanding ring */}
        <Animated.View 
          style={[
            styles.auraRing, 
            { 
              transform: [{ scale: pulseAnim }],
              opacity: ringOpacityAnim 
            }
          ]} 
        />
        {/* Inner solid core */}
        <Animated.View 
          style={[styles.auraCore, { transform: [{ scale: scaleAnim }] }]} 
        />
      </View>

      {/* Typography */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Text style={styles.title}>AURA</Text>
        <Text style={styles.subtitle}>STUDIO</Text>
      </Animated.View>

      {/* Loading Indicator at bottom */}
      <View style={styles.footer}>
        <Text style={styles.loadingText}>Initializing Neural Network...</Text>
      </View>
      
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject, // Fills the entire screen
    backgroundColor: '#0F172A', // Deep slate/black premium background
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999, // Stays on top of everything
  },
  graphicContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  auraCore: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#38BDF8', // Vivid Sky Blue
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  auraRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#94A3B8',
    letterSpacing: 12,
    textAlign: 'center',
    marginTop: 8,
    marginLeft: 12, // Offset for the heavy letter spacing to keep it centered
  },
  footer: {
    position: 'absolute',
    bottom: 50,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
  }
});