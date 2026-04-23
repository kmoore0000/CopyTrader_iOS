import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL_KEY = 'growr_base_url';
const DEFAULT_URL  = 'http://localhost:8080';

export async function getBaseUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(BASE_URL_KEY);
    return stored ?? DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

export async function setBaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(BASE_URL_KEY, url.replace(/\/$/, ''));
}

export async function resetBaseUrl(): Promise<void> {
  await AsyncStorage.removeItem(BASE_URL_KEY);
}
