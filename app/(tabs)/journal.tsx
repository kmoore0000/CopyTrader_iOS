import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, formatPnl, pnlColor, type JournalTrade, type JournalResponse } from '../../lib/api';
import { Colors } from '../../constants/colors';

type Preset = '1D' | '1W' | '1M' | '3M' | 'ALL' | 'CUSTOM';
const PRESETS: Preset[] = ['1D', '1W', '1M', '3M', 'ALL', 'CUSTOM'];

function presetRange(p: Preset): { from: Date; to: Date } {
  const to   = new Date();
  const from = new Date();
  to.setHours(23, 59, 59, 999);
  if (p === '1D') from.setDate(from.getDate() - 1);
  else if (p === '1W') from.setDate(from.getDate() - 7);
  else if (p === '1M') from.setMonth(from.getMonth() - 1);
  else if (p === '3M') from.setMonth(from.getMonth() - 3);
  else if (p === 'ALL') from.setFullYear(2000, 0, 1);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDuration(mins: number): string {
  if (mins < 60)   return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${Math.floor(mins / 1440)}d`;
}

export default function JournalScreen() {
  const insets = useSafeAreaInsets();

  const [preset,     setPreset]     = useState<Preset>('1W');
  const [fromDate,   setFromDate]   = useState(() => presetRange('1W').from);
  const [toDate,     setToDate]     = useState(() => presetRange('1W').to);

  // date picker modal state
  const [picking,    setPicking]    = useState<'from' | 'to' | null>(null);
  const [tempDate,   setTempDate]   = useState<Date>(new Date());

  const [stats,      setStats]      = useState<JournalResponse | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const from = fromDate.toISOString().slice(0, 10);
      const to   = toDate.toISOString().slice(0, 10);
      const res  = await api.getJournal(from, to);
      setStats(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load journal');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== 'CUSTOM') {
      const { from, to } = presetRange(p);
      setFromDate(from);
      setToDate(to);
    }
  }

  function openPicker(which: 'from' | 'to') {
    setTempDate(which === 'from' ? fromDate : toDate);
    setPicking(which);
  }

  function confirmPicker() {
    if (picking === 'from') setFromDate(tempDate);
    if (picking === 'to')   setToDate(tempDate);
    setPicking(null);
  }

  const trades = stats?.trades ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Preset chips ── */}
      <View style={styles.presetBar}>
        {PRESETS.map(p => (
          <Pressable
            key={p}
            style={[styles.chip, preset === p && styles.chipActive]}
            onPress={() => applyPreset(p)}
          >
            <Text style={[styles.chipTxt, preset === p && styles.chipTxtActive]}>
              {p === 'CUSTOM' ? '📅' : p}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Date range row (always visible) ── */}
      <View style={styles.dateRangeRow}>
        <Pressable
          style={[styles.dateBtn, preset === 'CUSTOM' && styles.dateBtnActive]}
          onPress={() => { setPreset('CUSTOM'); openPicker('from'); }}
        >
          <Text style={styles.dateBtnLabel}>FROM</Text>
          <Text style={styles.dateBtnValue}>{fmtDate(fromDate)}</Text>
        </Pressable>

        <View style={styles.dateArrow}><Text style={styles.dateArrowTxt}>→</Text></View>

        <Pressable
          style={[styles.dateBtn, preset === 'CUSTOM' && styles.dateBtnActive]}
          onPress={() => { setPreset('CUSTOM'); openPicker('to'); }}
        >
          <Text style={styles.dateBtnLabel}>TO</Text>
          <Text style={styles.dateBtnValue}>{fmtDate(toDate)}</Text>
        </Pressable>
      </View>

      {/* ── Native date picker modal ── */}
      <Modal
        visible={picking !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicking(null)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Pressable onPress={() => setPicking(null)}>
                <Text style={styles.pickerCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.pickerTitle}>
                {picking === 'from' ? 'From Date' : 'To Date'}
              </Text>
              <Pressable onPress={confirmPicker}>
                <Text style={styles.pickerDone}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="inline"
              maximumDate={new Date()}
              themeVariant="dark"
              accentColor={Colors.brand}
              onChange={(_: DateTimePickerEvent, d?: Date) => {
                if (d) setTempDate(d);
              }}
              style={styles.picker}
            />
          </View>
        </View>
      </Modal>

      {/* ── Content ── */}
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
                <View style={styles.statsRow}>
                  <StatBox label="Trades"   value={stats.totalTrades.toString()} />
                  <StatBox label="Win Rate" value={`${Math.round(stats.winRate)}%`}
                    color={stats.winRate >= 50 ? Colors.brand : Colors.red} />
                  <StatBox label="Net P&L"  value={formatPnl(stats.totalNet)}
                    color={pnlColor(stats.totalNet)} />
                </View>
                <View style={styles.statsDivider} />
                <View style={styles.statsRow}>
                  <StatBox label="Profit Factor"
                    value={stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—'} />
                  <StatBox label="Best"  value={formatPnl(stats.bestTrade)}  color={Colors.brand} />
                  <StatBox label="Worst" value={formatPnl(stats.worstTrade)} color={Colors.red} />
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

// ─── Trade card ──────────────────────────────────────────────────────────────

function TradeCard({ trade: t }: { trade: JournalTrade }) {
  const isBuy = t.direction?.toLowerCase() === 'buy';

  function fmtTime(iso: string) {
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

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{fmtTime(t.exitTime)}</Text>
        <Text style={styles.metaText}>{fmtDuration(t.durationMinutes)}</Text>
      </View>

      {(t.swap !== 0 || t.commission !== 0) && (
        <View style={styles.feesRow}>
          {t.swap !== 0 && (
            <Text style={[styles.feeText, { color: pnlColor(t.swap) }]}>swap {formatPnl(t.swap)}</Text>
          )}
          {t.commission !== 0 && (
            <Text style={[styles.feeText, { color: pnlColor(t.commission) }]}>
              comm {formatPnl(t.commission)}
            </Text>
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, marginTop: 40 },
  errorText: { color: Colors.red, fontSize: 14, textAlign: 'center' },
  emptyIcon: { fontSize: 40 },
  emptyTitle:{ color: Colors.text, fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },

  // Preset chips
  presetBar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 6 },
  chip:      { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.cardBorder },
  chipActive:{ backgroundColor: Colors.brandDim, borderColor: Colors.brand },
  chipTxt:   { fontSize: 11, fontWeight: '500', color: Colors.textMuted },
  chipTxtActive: { color: Colors.brand },

  // Date range row
  dateRangeRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  dateBtn:       { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 10, borderWidth: 0.5, borderColor: Colors.cardBorder },
  dateBtnActive: { borderColor: Colors.brand },
  dateBtnLabel:  { fontSize: 9, color: Colors.textMuted, fontWeight: '500', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 },
  dateBtnValue:  { fontSize: 13, color: Colors.text, fontWeight: '500' },
  dateArrow:     { alignItems: 'center' },
  dateArrowTxt:  { color: Colors.textMuted, fontSize: 14 },

  // Picker modal
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  pickerSheet:   { backgroundColor: '#1c1c1e', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  pickerHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.separator },
  pickerTitle:   { fontSize: 15, fontWeight: '600', color: Colors.text },
  pickerCancel:  { fontSize: 15, color: Colors.textMuted },
  pickerDone:    { fontSize: 15, fontWeight: '600', color: Colors.brand },
  picker:        { alignSelf: 'center' },

  // Stats card
  statsCard:    { margin: 16, backgroundColor: Colors.card, borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: Colors.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10 },
  statsRow:     { flexDirection: 'row' },
  statsDivider: { height: 0.5, backgroundColor: Colors.separator, marginVertical: 12 },
  statLabel:    { fontSize: 10, color: Colors.textMuted, marginBottom: 4, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue:    { fontSize: 17, fontWeight: '600', color: Colors.text, letterSpacing: -0.3 },

  // Trade card
  card:        { marginHorizontal: 16, backgroundColor: Colors.card, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: Colors.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  symbolRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  symbol:      { fontSize: 16, fontWeight: '700', color: Colors.text, letterSpacing: -0.3 },
  badge:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  buyBadge:    { backgroundColor: Colors.brandDim },
  sellBadge:   { backgroundColor: Colors.redDim },
  badgeTxt:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  pnl:         { fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },
  accountLabel:{ fontSize: 11, color: Colors.textMuted, marginBottom: 12, fontWeight: '400' },
  priceRow:    { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: Colors.separator, paddingTop: 12 },
  priceLabel:  { fontSize: 10, color: Colors.textMuted, marginBottom: 3, fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.4 },
  priceValue:  { fontSize: 13, fontWeight: '500', color: Colors.text, fontVariant: ['tabular-nums'] },
  metaRow:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  metaText:    { fontSize: 11, color: Colors.textMuted },
  feesRow:     { flexDirection: 'row', gap: 10, marginTop: 6 },
  feeText:     { fontSize: 11, color: Colors.textMuted },
  comment:     { marginTop: 6, fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
});
