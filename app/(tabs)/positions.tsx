import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, formatCurrency, formatPnl, pnlColor, type OpenPosition } from '../../lib/api';
import { Colors } from '../../constants/colors';

const POLL_MS = 2000;   // 2s — as close to real-time as polling allows

export default function PositionsScreen() {
  const insets = useSafeAreaInsets();
  const [positions,  setPositions]  = useState<OpenPosition[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [flattening, setFlattening] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      const res = await api.getPositions();
      setPositions(res.positions);
      setError(null);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Failed to load positions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(true), POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const flattenAll = useCallback(() => {
    if (positions.length === 0) return;
    Alert.alert(
      'Flatten All Positions',
      `Close all ${positions.length} open position${positions.length !== 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Flatten All',
          style: 'destructive',
          onPress: async () => {
            setFlattening(true);
            try {
              await api.closeAll();
              // Reload immediately after close
              await load();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to close all');
            } finally {
              setFlattening(false);
            }
          },
        },
      ],
    );
  }, [positions.length, load]);

  const totalPnl  = positions.reduce((s, p) => s + p.profit, 0);
  const totalSwap = positions.reduce((s, p) => s + p.swap, 0);
  const netTotal  = totalPnl + totalSwap;

  return (
    <View style={styles.root}>
      {loading && positions.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.brand} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="wifi-outline" size={44} color={Colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={positions}
          keyExtractor={p => `${p.accountId}-${p.positionId}`}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand} />
          }
          ListHeaderComponent={
            positions.length > 0 ? (
              <View style={styles.header}>
                {/* Summary row */}
                <View style={styles.summaryRow}>
                  <View>
                    <Text style={styles.summaryLabel}>OPEN POSITIONS</Text>
                    <Text style={styles.summaryCount}>{positions.length}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.summaryLabel}>NET P&L</Text>
                    <Text style={[styles.summaryPnl, { color: pnlColor(netTotal) }]}>
                      {formatPnl(netTotal)}
                    </Text>
                  </View>
                  {totalSwap !== 0 && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.summaryLabel}>SWAP</Text>
                      <Text style={[styles.summarySwap, { color: pnlColor(totalSwap) }]}>
                        {formatPnl(totalSwap)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Live indicator */}
                <View style={styles.liveRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveTxt}>Live · updates every 2s</Text>
                </View>

                {/* Flatten All button */}
                <Pressable
                  style={[styles.flattenBtn, flattening && { opacity: 0.6 }]}
                  onPress={flattenAll}
                  disabled={flattening}
                >
                  {flattening ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={16} color="#fff" />
                      <Text style={styles.flattenTxt}>Flatten All Positions</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="pulse-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No open positions</Text>
              <Text style={styles.emptyText}>All markets are flat.</Text>
            </View>
          }
          renderItem={({ item }) => <PositionCard position={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

// ─── Position card ────────────────────────────────────────────────────────────

function PositionCard({ position: p }: { position: OpenPosition }) {
  const isBuy  = p.type.toLowerCase() === 'buy';
  const netPnl = p.profit + p.swap;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.symbolRow}>
          <Text style={styles.symbol}>{p.symbol}</Text>
          <View style={[styles.sideBadge, isBuy ? styles.buyBadge : styles.sellBadge]}>
            <Text style={[styles.sideText, { color: isBuy ? Colors.brand : Colors.red }]}>
              {p.type.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={[styles.pnl, { color: pnlColor(netPnl) }]}>{formatPnl(netPnl)}</Text>
      </View>

      <Text style={styles.accountLabel}>{p.accountId} · {p.platform}</Text>

      <View style={styles.statsRow}>
        <Stat label="Lots"    value={p.volume.toString()} />
        <Stat label="Open"    value={p.openPrice.toString()}    center />
        <Stat label="Current" value={p.currentPrice.toString()} right />
      </View>

      {p.swap !== 0 && (
        <View style={styles.swapRow}>
          <Text style={styles.swapLabel}>Gross</Text>
          <Text style={[styles.swapValue, { color: pnlColor(p.profit) }]}>{formatPnl(p.profit)}</Text>
          <Text style={[styles.swapLabel, { marginLeft: 10 }]}>Swap</Text>
          <Text style={[styles.swapValue, { color: pnlColor(p.swap) }]}>{formatPnl(p.swap)}</Text>
        </View>
      )}

      {!!p.comment && p.comment !== '' && (
        <Text style={styles.comment} numberOfLines={1}>{p.comment}</Text>
      )}
    </View>
  );
}

function Stat({ label, value, center, right }: {
  label: string; value: string; center?: boolean; right?: boolean;
}) {
  return (
    <View style={{ flex: 1, alignItems: center ? 'center' : right ? 'flex-end' : 'flex-start' }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32, marginTop: 60 },
  errorText:    { color: Colors.red, fontSize: 14, textAlign: 'center' },
  retryBtn:     { backgroundColor: Colors.brand, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10 },
  retryTxt:     { color: '#000', fontWeight: '600' },

  // Header
  header:       { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  summaryLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 3 },
  summaryCount: { fontSize: 22, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  summaryPnl:   { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  summarySwap:  { fontSize: 14, fontWeight: '600' },

  // Live indicator
  liveRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  liveDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.brand },
  liveTxt:      { fontSize: 11, color: Colors.textMuted, fontWeight: '400' },

  // Flatten button
  flattenBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.red, borderRadius: 14, paddingVertical: 13, marginBottom: 14 },
  flattenTxt:   { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },

  // Cards
  card:         { marginHorizontal: 16, backgroundColor: Colors.card, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: Colors.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6 },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  symbolRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  symbol:       { fontSize: 17, fontWeight: '800', color: Colors.text },
  sideBadge:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  buyBadge:     { backgroundColor: Colors.brandDim },
  sellBadge:    { backgroundColor: Colors.redDim },
  sideText:     { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  pnl:          { fontSize: 18, fontWeight: '800' },
  accountLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 12, fontWeight: '500' },
  statsRow:     { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: Colors.separator, paddingTop: 12 },
  statLabel:    { fontSize: 11, color: Colors.textMuted, marginBottom: 3, fontWeight: '500' },
  statValue:    { fontSize: 13, fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'] },
  swapRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  swapLabel:    { fontSize: 11, color: Colors.textMuted },
  swapValue:    { fontSize: 11, fontWeight: '600', marginLeft: 4 },
  comment:      { marginTop: 8, fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },

  // Empty
  emptyTitle:   { color: Colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  emptyText:    { color: Colors.textMuted, fontSize: 14 },
});
