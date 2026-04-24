import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors } from '../../constants/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} size={size - 1} color={color} />;
}

function FrostedBar() {
  return <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   Colors.brand,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarBackground:        () => <FrostedBar />,
        tabBarStyle: {
          backgroundColor: 'rgba(8,8,8,0.55)',
          borderTopColor:  Colors.separator,
          borderTopWidth:  0.5,
          position:        'absolute',
        },
        tabBarLabelStyle: {
          fontSize:      10,
          fontWeight:    '400',
          letterSpacing: 0.1,
        },
        tabBarIconStyle: { marginTop: 1 },
        headerStyle:     { backgroundColor: Colors.bg },
        headerTintColor: Colors.text,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight:    '500',
          fontSize:      16,
          letterSpacing: -0.2,
        },
        headerTitleAlign: 'center',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title:       'Dashboard',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="stats-chart" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="positions"
        options={{
          title: 'Positions',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="pulse" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="document-text-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="charts"
        options={{
          title:       'Charts',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="bar-chart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="newspaper-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
