import { useCallback, useEffect, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl, setBaseUrl } from '../lib/storage';
import { Colors } from '../constants/colors';

const PRESETS = [
  { label: 'Local (same WiFi)',  hint: 'Replace x.x.x.x with your PC\'s IP', value: 'http://192.168.1.x:8080' },
  { label: 'Localhost (emulator)', hint: 'Android emulator only',            value: 'http://10.0.2.2:8080'    },
  { label: 'Custom / Cloud',    hint: 'Your deployed server URL',            value: ''                         },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [url,   setUrl]   = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getBaseUrl().then(setUrl);
  }, []);

  const save = useCallback(async () => {
    const trimmed = url.trim().replace(/\/$/, '');
    if (!trimmed.startsWith('http')) {
      Alert.alert('Invalid URL', 'URL must start with http:// or https://');
      return;
    }
    await setBaseUrl(trimmed);
    setUrl(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [url]);

  function applyPreset(value: string) {
    if (value !== '') setUrl(value);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Current URL input */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BACKEND URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="http://192.168.1.x:8080"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <Text style={styles.hint}>
            The address of your Growr backend server. Use your PC's local IP when on the same WiFi network.
          </Text>
        </View>

        {/* Save button */}
        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
          onPress={save}
        >
          <Text style={styles.saveTxt}>{saved ? '✓ Saved' : 'Save'}</Text>
        </Pressable>

        {/* Presets */}
        <Text style={[styles.sectionLabel, { marginTop: 32, marginBottom: 8 }]}>QUICK PRESETS</Text>
        {PRESETS.map(p => (
          <Pressable
            key={p.label}
            style={({ pressed }) => [styles.preset, pressed && { opacity: 0.7 }]}
            onPress={() => applyPreset(p.value)}
          >
            <View style={styles.presetLeft}>
              <Text style={styles.presetLabel}>{p.label}</Text>
              <Text style={styles.presetHint}>{p.hint}</Text>
            </View>
            {p.value !== '' && (
              <Text style={styles.presetValue} numberOfLines={1}>{p.value}</Text>
            )}
          </Pressable>
        ))}

        {/* Info box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Finding your PC's IP</Text>
          <Text style={styles.infoText}>
            On Windows: open Command Prompt and run{' '}
            <Text style={styles.code}>ipconfig</Text>. Look for{' '}
            <Text style={styles.code}>IPv4 Address</Text> under your WiFi adapter —
            usually starts with 192.168.x.x or 10.0.x.x.{'\n\n'}
            Make sure your phone and PC are on the same WiFi network, and that the backend
            server is running on port 8080.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:       { padding: 20 },
  section:      { marginBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, letterSpacing: 1, marginBottom: 10 },
  input:        {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  hint:         { fontSize: 12, color: Colors.textMuted, marginTop: 8, lineHeight: 17 },
  saveBtn:      {
    marginTop: 16,
    backgroundColor: Colors.brand,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveTxt:      { color: '#000', fontWeight: '800', fontSize: 15 },

  preset:       {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  presetLeft:   { flex: 1 },
  presetLabel:  { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  presetHint:   { fontSize: 12, color: Colors.textMuted },
  presetValue:  { fontSize: 12, color: Colors.brand, fontWeight: '600', maxWidth: 160, textAlign: 'right' },

  infoBox:      {
    marginTop: 24,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  infoTitle:    { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  infoText:     { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
  code:         { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: Colors.brand },
});
