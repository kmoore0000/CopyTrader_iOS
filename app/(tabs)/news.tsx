import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Linking, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchNews, timeAgo, type NewsItem } from '../../lib/news';
import { Colors } from '../../constants/colors';

const ALL_SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'US30', 'NAS100', 'BTCUSD', 'AUDUSD'];

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const [news,       setNews]       = useState<NewsItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected,   setSelected]   = useState<string[]>(['XAUUSD', 'EURUSD']);

  const load = useCallback(async () => {
    try {
      const items = await fetchNews(selected.length > 0 ? selected : []);
      setNews(items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load news');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selected]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  function toggleSymbol(sym: string) {
    setSelected(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Symbol filter strip */}
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {ALL_SYMBOLS.map(sym => {
            const active = selected.includes(sym);
            return (
              <Pressable
                key={sym}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleSymbol(sym)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{sym}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading && news.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.brand} size="large" />
          <Text style={styles.loadingText}>Fetching latest news…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={news}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>📰</Text>
              <Text style={styles.emptyTitle}>No news found</Text>
              <Text style={styles.emptyText}>Try selecting more symbols above.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <NewsCard item={item} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  function open() {
    if (item.link) Linking.openURL(item.link).catch(() => {});
  }

  return (
    <Pressable style={({ pressed }) => [styles.newsCard, pressed && { opacity: 0.75 }]} onPress={open}>
      {/* Source + time */}
      <View style={styles.meta}>
        <View style={styles.sourcePill}>
          <Text style={styles.sourceText}>{item.source}</Text>
        </View>
        <Text style={styles.timeText}>{timeAgo(item.pubDate)}</Text>
      </View>

      <Text style={styles.title} numberOfLines={3}>{item.title}</Text>

      {item.description !== '' && (
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      )}

      {/* Tag pills */}
      {item.tags.length > 0 && (
        <View style={styles.tagRow}>
          {item.tags.slice(0, 4).map(tag => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, marginTop: 60 },
  loadingText:{ color: Colors.textMuted, fontSize: 14, marginTop: 8 },
  errorText:  { color: Colors.red, fontSize: 14, textAlign: 'center' },
  retryBtn:   { marginTop: 8, backgroundColor: Colors.brand, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  retryText:  { color: '#000', fontWeight: '700' },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  emptyText:  { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },

  filterWrap:   { borderBottomWidth: 1, borderBottomColor: Colors.separator },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  chip:         { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  chipActive:   { backgroundColor: Colors.brandDim, borderColor: Colors.brand },
  chipText:     { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.3 },
  chipTextActive: { color: Colors.brand },

  separator:  { height: 1, backgroundColor: Colors.separator, marginHorizontal: 16 },

  newsCard:   { padding: 16 },
  meta:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sourcePill: { backgroundColor: Colors.card, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: Colors.cardBorder },
  sourceText: { fontSize: 11, fontWeight: '700', color: Colors.brand, letterSpacing: 0.3 },
  timeText:   { fontSize: 11, color: Colors.textMuted },
  title:      { fontSize: 15, fontWeight: '700', color: Colors.text, lineHeight: 21, marginBottom: 6 },
  description:{ fontSize: 13, color: Colors.textMuted, lineHeight: 18, marginBottom: 8 },
  tagRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagPill:    { backgroundColor: Colors.card, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagText:    { fontSize: 10, color: Colors.textMuted, fontWeight: '600', letterSpacing: 0.4 },
});
