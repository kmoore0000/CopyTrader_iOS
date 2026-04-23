import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, formatCurrency, formatPnl, pnlColor, type OpenPosition } from '../../lib/api';
import { Colors } from '../../constants/colors';

const POLL_MS = 5000;

export default function PositionsScreen() {
  const insets = useSafeAreaInsets();
  const [positions,  setPositions]  = useState<OpenPosition[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getPositions();
      setPositions(res.positions);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load positions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  // Totals
  const totalPnl  = positions.reduce((s, p) => s + p.profit, 0);
  const totalSwap = positions.reduce((s, p) => s + p.swap, 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {loading && positions.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.brand} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={positions}
          keyExtractor={p => `${p.accountId}-${p.positionId}`}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand} />
          }
          ListHeaderComponent={
            positions.length > 0 ? (
              <View style={styles.summaryBar}>
                <Text style={styles.summaryCount}>{positions.length} open</Text>
                <View style={styles.summaryRight}>
                  {totalSwap !== 0 && (
                    <Text style={[styles.summarySwap, { color: pnlColor(totalSwap) }]}>
                      swap {formatPnl(totalSwap)}
                    </Text>
                  )}
                  <Text style={[styles.summaryPnl, { color: pnlColor(totalPnl) }]}>
                    {formatPnl(totalPnl)}
                  </Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>No open positions</Text>
              <Text style={styles.emptyText}>All markets are flat right now.</Text>
            </View>
          }
          renderItem={({ item }) => <PositionCard position={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

function PositionCard({ position: p }: { position: OpenPosition }) {
  const isBuy  = p.type.toLowerCase() === 'buy';
  const netPnl = p.profit + p.swap;

  return (
    <View style={styles.card}>
      {/* Top row */}
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

      {/* Account */}
      <Text style={styles.accountLabel}>{p.accountId} · {p.platform}</Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Stat label="Lots"    value={p.volume.toString()} />
        <Stat label="Open"    value={p.openPrice.toString()}    center />
        <Stat label="Current" value={p.currentPrice.toString()} right />
      </View>

      {/* Swap if nonzero */}
      {p.swap !== 0 && (
        <View style={styles.swapRow}>
          <Text style={styles.swapLabel}>Gross P&L</Text>
          <Text style={[styles.swapValue, { color: pnlColor(p.profit) }]}>{formatPnl(p.profit)}</Text>
          <Text style={styles.swapLabel}>  Swap</Text>
          <Text style={[styles.swapValue, { color: pnlColor(p.swap) }]}>{formatPnl(p.swap)}</Text>
        </View>
      )}

      {p.comment && p.comment !== '' && (
        <Text style={styles.comment} numberOfLines={1}>{p.comment}</Text>
      )}
    </View>
  );
}

function Stat({
  label, value, center, right,
}: {
  label: string; value: string; center?: boolean; right?: boolean;
}) {
  return (
    <View style={{ flex: 1, alignItems: center ? 'center' : right ? 'flex-end' : 'flex-start' }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, marginTop: 60 },
  errorText:   { color: Colors.red, fontSize: 14, textAlign: 'center' },
  emptyIcon:   { fontSize: 40 },
  emptyTitle:  { color: Colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  emptyText:   { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  summaryBar:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  summaryCount:{ color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  summaryRight:{ flexDirection: 'row', alignItems: 'center', gap: 12 },
  summarySwap: { fontSize: 13, fontWeight: '600' },
  summaryPnl:  { fontSize: 16, fontWeight: '800' },
  card:        { marginHorizontal: 16, backgroundColor: Colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.cardBorder },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  symbolRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  symbol:      { fontSize: 17, fontWeight: '800', color: Colors.text },
  sideBadge:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  buyBadge:    { backgroundColor: Colors.brandDim },
  sellBadge:   { backgroundColor: Colors.redDim },
  sideText:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  pnl:         { fontSize: 18, fontWeight: '800' },
  accountLabel:{ fontSize: 11, color: Colors.textMuted, marginBottom: 12, fontWeight: '500' },
  statsRow:    { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.separator, paddingTop: 12 },
  statLabel:   { fontSize: 11, color: Colors.textMuted, marginBottom: 3, fontWeight: '500' },
  statValue:   { fontSize: 13, fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'] },
  swapRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  swapLabel:   { fontSize: 11, color: Colors.textMuted },
  swapValue:   { fontSize: 11, fontWeight: '600' },
  comment:     { marginTop: 8, fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
});
