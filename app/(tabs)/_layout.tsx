import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   Colors.brand,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor:  Colors.tabBar,
          borderTopColor:   Colors.separator,
          borderTopWidth:   1,
          paddingBottom:    4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        headerStyle:      { backgroundColor: Colors.card },
        headerTintColor:  Colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title:    'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="stats-chart" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="positions"
        options={{
          title:    'Positions',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="pulse" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title:    'Journal',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="journal" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title:    'News',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="newspaper" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
