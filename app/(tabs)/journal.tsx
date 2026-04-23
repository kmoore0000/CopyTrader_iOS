import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, formatPnl, pnlColor, type JournalTrade, type JournalResponse } from '../../lib/api';
import { Colors } from '../../constants/colors';

type Range = '1D' | '1W' | '1M' | '3M' | 'ALL';
const RANGES: Range[] = ['1D', '1W', '1M', '3M', 'ALL'];

function rangeStart(r: Range): string | undefined {
  if (r === 'ALL') return undefined;
  const now = new Date();
  if (r === '1D') now.setDate(now.getDate() - 1);
  if (r === '1W') now.setDate(now.getDate() - 7);
  if (r === '1M') now.setMonth(now.getMonth() - 1);
  if (r === '3M') now.setMonth(now.getMonth() - 3);
  return now.toISOString().slice(0, 10);
}

function fmtDuration(mins: number): string {
  if (mins < 60)   return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${Math.floor(mins / 1440)}d`;
}

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const [stats,      setStats]      = useState<JournalResponse | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [range,      setRange]      = useState<Range>('1W');

  const load = useCallback(async () => {
    try {
      const from = rangeStart(range);
      const res  = await api.getJournal(from);
      setStats(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load journal');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const trades = stats?.trades ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Range selector */}
      <View style={styles.rangeBar}>
        {RANGES.map(r => (
          <Pressable
            key={r}
            style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
            onPress={() => setRange(r)}
          >
            <Text style={[styles.rangeTxt, range === r && styles.rangeTxtActive]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      {loading && !stats ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.brand} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={trades}
          keyExtractor={t => `${t.accountId}-${t.positionId}-${t.exitTime}`}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand} />
          }
          ListHeaderComponent={
            stats && stats.totalTrades > 0 ? (
              <View style={styles.statsCard}>
                {/* Row 1 */}
                <View style={styles.statsRow}>
                  <StatBox label="Trades"   value={stats.totalTrades.toString()} />
                  <StatBox label="Win Rate" value={`${Math.round(stats.winRate)}%`} color={stats.winRate >= 50 ? Colors.brand : Colors.red} />
                  <StatBox label="Net P&L"  value={formatPnl(stats.totalNet)} color={pnlColor(stats.totalNet)} />
                </View>
                <View style={styles.statsDivider} />
                {/* Row 2 */}
                <View style={styles.statsRow}>
                  <StatBox label="Profit Factor" value={stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—'} />
                  <StatBox label="Best"   value={formatPnl(stats.bestTrade)}  color={Colors.brand} />
                  <StatBox label="Worst"  value={formatPnl(stats.worstTrade)} color={Colors.red} />
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>📓</Text>
              <Text style={styles.emptyTitle}>No trades found</Text>
              <Text style={styles.emptyText}>Try a wider date range.</Text>
            </View>
          }
          renderItem={({ item }) => <TradeCard trade={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

function TradeCard({ trade: t }: { trade: JournalTrade }) {
  const isBuy = t.direction?.toLowerCase() === 'buy';

  function fmtDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
           '  ' +
           d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.symbolRow}>
          <Text style={styles.symbol}>{t.symbol}</Text>
          {t.direction && (
            <View style={[styles.badge, isBuy ? styles.buyBadge : styles.sellBadge]}>
              <Text style={[styles.badgeTxt, { color: isBuy ? Colors.brand : Colors.red }]}>
                {t.direction.toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.pnl, { color: pnlColor(t.netProfit) }]}>{formatPnl(t.netProfit)}</Text>
      </View>

      <Text style={styles.accountLabel}>{t.accountId} · {t.platform}</Text>

      <View style={styles.priceRow}>
        <PriceStat label="Entry"  value={t.entryPrice?.toString() ?? '—'} />
        <PriceStat label="Exit"   value={t.exitPrice?.toString()  ?? '—'} center />
        <PriceStat label="Volume" value={t.volume?.toString()     ?? '—'} right />
      </View>

      <View style={styles.dateRow}>
        <Text style={styles.dateText}>{fmtDate(t.exitTime)}</Text>
        <Text style={styles.durationText}>{fmtDuration(t.durationMinutes)}</Text>
      </View>

      {(t.swap !== 0 || t.commission !== 0) && (
        <View style={styles.feesRow}>
          {t.swap !== 0 && (
            <Text style={[styles.feeText, { color: pnlColor(t.swap) }]}>swap {formatPnl(t.swap)}</Text>
          )}
          {t.commission !== 0 && (
            <Text style={[styles.feeText, { color: pnlColor(t.commission) }]}>comm {formatPnl(t.commission)}</Text>
          )}
          <Text style={styles.feeText}>gross {formatPnl(t.grossProfit)}</Text>
        </View>
      )}

      {t.comment && t.comment !== '' && (
        <Text style={styles.comment} numberOfLines={1}>{t.comment}</Text>
      )}
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

function PriceStat({ label, value, center, right }: {
  label: string; value: string; center?: boolean; right?: boolean;
}) {
  return (
    <View style={{ flex: 1, alignItems: center ? 'center' : right ? 'flex-end' : 'flex-start' }}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={styles.priceValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: Colors.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, marginTop: 60 },
  errorText:  { color: Colors.red, fontSize: 14, textAlign: 'center' },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptyText:  { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },

  rangeBar:       { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  rangeBtn:       { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.cardBorder },
  rangeBtnActive: { backgroundColor: Colors.brandDim, borderColor: Colors.brand },
  rangeTxt:       { fontSize: 12, fontWeight: '500', color: Colors.textMuted },
  rangeTxtActive: { color: Colors.brand },

  statsCard:    { margin: 16, backgroundColor: Colors.card, borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: Colors.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10 },
  statsRow:     { flexDirection: 'row' },
  statsDivider: { height: 0.5, backgroundColor: Colors.separator, marginVertical: 12 },
  statLabel:    { fontSize: 10, color: Colors.textMuted, marginBottom: 4, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue:    { fontSize: 17, fontWeight: '600', color: Colors.text, letterSpacing: -0.3 },

  card:       { marginHorizontal: 16, backgroundColor: Colors.card, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: Colors.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6 },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  symbolRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  symbol:     { fontSize: 16, fontWeight: '700', color: Colors.text, letterSpacing: -0.3 },
  badge:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  buyBadge:   { backgroundColor: Colors.brandDim },
  sellBadge:  { backgroundColor: Colors.redDim },
  badgeTxt:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  pnl:        { fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },
  accountLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 12, fontWeight: '400' },

  priceRow:   { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: Colors.separator, paddingTop: 12 },
  priceLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 3, fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.4 },
  priceValue: { fontSize: 13, fontWeight: '500', color: Colors.text, fontVariant: ['tabular-nums'] },

  dateRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  dateText:     { fontSize: 11, color: Colors.textMuted },
  durationText: { fontSize: 11, color: Colors.textMuted },
  feesRow:      { flexDirection: 'row', gap: 10, marginTop: 6 },
  feeText:      { fontSize: 11, color: Colors.textMuted },
  comment:      { marginTop: 6, fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
});
