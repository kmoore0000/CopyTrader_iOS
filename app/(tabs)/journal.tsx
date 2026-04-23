import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, formatCurrency, formatPnl, pnlColor, type JournalTrade } from '../../lib/api';
import { Colors } from '../../constants/colors';

type Range = '1D' | '1W' | '1M' | '3M' | 'ALL';

const RANGES: Range[] = ['1D', '1W', '1M', '3M', 'ALL'];

function rangeStart(r: Range): string | undefined {
  const now = new Date();
  switch (r) {
    case '1D':  now.setDate(now.getDate() - 1);   break;
    case '1W':  now.setDate(now.getDate() - 7);   break;
    case '1M':  now.setMonth(now.getMonth() - 1); break;
    case '3M':  now.setMonth(now.getMonth() - 3); break;
    case 'ALL': return undefined;
  }
  return now.toISOString().slice(0, 10);
}

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const [trades,     setTrades]     = useState<JournalTrade[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [range,      setRange]      = useState<Range>('1W');

  const load = useCallback(async () => {
    try {
      const from = rangeStart(range);
      const res  = await api.getJournal(from);
      setTrades(res.trades);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load journal');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  // Stats
  const winners   = trades.filter(t => t.profit > 0);
  const losers    = trades.filter(t => t.profit < 0);
  const totalPnl  = trades.reduce((s, t) => s + t.profit, 0);
  const totalSwap = trades.reduce((s, t) => s + (t.swap ?? 0), 0);
  const netPnl    = totalPnl + totalSwap;
  const winRate   = trades.length > 0
    ? Math.round((winners.length / trades.length) * 100)
    : 0;

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

      {loading && trades.length === 0 ? (
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
          keyExtractor={t => `${t.accountId}-${t.positionId}-${t.closeTime}`}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand} />
          }
          ListHeaderComponent={
            trades.length > 0 ? (
              <View style={styles.statsCard}>
                <View style={styles.statsRow}>
                  <StatBox label="Trades"  value={trades.length.toString()} />
                  <StatBox label="Win Rate" value={`${winRate}%`} color={winRate >= 50 ? Colors.brand : Colors.red} />
                  <StatBox label="Net P&L"  value={formatPnl(netPnl)} color={pnlColor(netPnl)} />
                </View>
                <View style={[styles.statsRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.separator }]}>
                  <StatBox label="Winners" value={`${winners.length}`} color={Colors.brand} />
                  <StatBox label="Losers"  value={`${losers.length}`}  color={Colors.red} />
                  {totalSwap !== 0 && (
                    <StatBox label="Swap" value={formatPnl(totalSwap)} color={pnlColor(totalSwap)} />
                  )}
                  {totalSwap === 0 && (
                    <StatBox label="Gross P&L" value={formatPnl(totalPnl)} color={pnlColor(totalPnl)} />
                  )}
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>📓</Text>
              <Text style={styles.emptyTitle}>No trades in this period</Text>
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
  const isBuy  = t.type?.toLowerCase() === 'buy';
  const netPnl = t.profit + (t.swap ?? 0);

  function fmtDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
           '  ' +
           d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={styles.symbolRow}>
          <Text style={styles.symbol}>{t.symbol}</Text>
          {t.type && (
            <View style={[styles.badge, isBuy ? styles.buyBadge : styles.sellBadge]}>
              <Text style={[styles.badgeTxt, { color: isBuy ? Colors.brand : Colors.red }]}>
                {t.type.toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.pnl, { color: pnlColor(netPnl) }]}>{formatPnl(netPnl)}</Text>
      </View>

      <Text style={styles.accountLabel}>{t.accountId} · {t.platform}</Text>

      {/* Price row */}
      <View style={styles.priceRow}>
        <PriceStat label="Open"   value={t.openPrice?.toString()  ?? '—'} />
        <PriceStat label="Close"  value={t.closePrice?.toString() ?? '—'} center />
        <PriceStat label="Volume" value={t.volume?.toString()     ?? '—'} right />
      </View>

      {/* Date row */}
      <View style={styles.dateRow}>
        <Text style={styles.dateText}>{fmtDate(t.closeTime)}</Text>
        {(t.swap ?? 0) !== 0 && (
          <Text style={[styles.swapText, { color: pnlColor(t.swap!) }]}>
            swap {formatPnl(t.swap!)}
          </Text>
        )}
      </View>

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
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  emptyText:  { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },

  rangeBar:       { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  rangeBtn:       { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  rangeBtnActive: { backgroundColor: Colors.brandDim, borderColor: Colors.brand },
  rangeTxt:       { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  rangeTxtActive: { color: Colors.brand },

  statsCard:  { margin: 16, backgroundColor: Colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.cardBorder },
  statsRow:   { flexDirection: 'row' },
  statLabel:  { fontSize: 11, color: Colors.textMuted, marginBottom: 4, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue:  { fontSize: 18, fontWeight: '700', color: Colors.text },

  card:       { marginHorizontal: 16, backgroundColor: Colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.cardBorder },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  symbolRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  symbol:     { fontSize: 16, fontWeight: '800', color: Colors.text },
  badge:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  buyBadge:   { backgroundColor: Colors.brandDim },
  sellBadge:  { backgroundColor: Colors.redDim },
  badgeTxt:   { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  pnl:        { fontSize: 17, fontWeight: '800' },
  accountLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 12, fontWeight: '500' },

  priceRow:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.separator, paddingTop: 12 },
  priceLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 3, fontWeight: '500' },
  priceValue: { fontSize: 13, fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'] },

  dateRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  dateText:   { fontSize: 11, color: Colors.textMuted },
  swapText:   { fontSize: 11, fontWeight: '600' },
  comment:    { marginTop: 8, fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
});
