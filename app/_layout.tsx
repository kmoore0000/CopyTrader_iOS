import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/colors';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle:      { backgroundColor: Colors.card },
          headerTintColor:  Colors.text,
          contentStyle:     { backgroundColor: Colors.bg },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{
            title:          'Settings',
            presentation:   'modal',
            headerStyle:    { backgroundColor: Colors.card },
            headerTintColor: Colors.text,
          }}
        />
      </Stack>
    </>
  );
}
