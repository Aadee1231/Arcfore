import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Play, Video, TrendingUp, User } from 'lucide-react-native';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/theme';
import { useActiveRound } from '@/store/activeRound';
import { View, StyleSheet } from 'react-native';

export default function TabsLayout() {
  const colors = useColors();
  const hasActiveRound = useActiveRound((s) => s.round?.status === 'active');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.sansSemiBold,
          fontSize: 11,
          letterSpacing: 0.4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'HOME',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: 'PLAY',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Play color={color} size={size - 2} />
              {hasActiveRound ? <View style={[styles.dot, { backgroundColor: colors.brass }]} /> : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'COACH',
          tabBarIcon: ({ color, size }) => <Video color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'PROGRESS',
          tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'PROFILE',
          tabBarIcon: ({ color, size }) => <User color={color} size={size - 2} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
