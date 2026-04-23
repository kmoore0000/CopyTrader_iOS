import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Dimensions, FlatList, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  api, formatPnl, pnlColor,
  type JournalTrade, type JournalResponse,
} from '../../lib/api';
import { Colors } from '../../constants/colors';

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_W   = Dimensions.get('window').width;
const GRID_PAD   = 16;
const CELL_GAP   = 3;
const CELL_W     = Math.floor((SCREEN_W - GRID_PAD * 2 - CELL_GAP * 6) / 7);
const CELL_H     = 72;

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DOW_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByDay(trades: JournalTrade[]): Map<string, JournalTrade[]> {
  const map = new Map<string, JournalTrade[]>();
  for (const t of trades) {
    const day = t.exitTime?.slice(0, 10);
    if (!day) continue;
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(t);
  }
  return map;
}

function monthRange(year: number, month: number) {
  const from = new Date(year, month, 1).toISOString().slice(0, 10);
  const to   = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

function fmtDuration(mins: number): string {
  if (mins < 60)   return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${Math.floor(mins / 1440)}d`;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const now    = new Date();

  const [year,        setYear]        = useState(now.getFullYear());
  const [month,       setMonth]       = useState(now.getMonth());
  const [stats,       setStats]       = useState<JournalResponse | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = monthRange(year, month);
      const res = await api.getJournal(from, to);
      setStats(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load journal');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => groupByDay(stats?.trades ?? []), [stats]);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  function prevMonth() {
    setSelectedDay(null);
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (isCurrentMonth) return;
    setSelectedDay(null);
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  // ── Day detail ──
  if (selectedDay) {
    const dayTrades = byDay.get(selectedDay) ?? [];
    return (
      <DayDetailView
        day={selectedDay}
        trades={dayTrades}
        insets={insets}
        onBack={() => setSelectedDay(null)}
      />
    );
  }

  // ── Calendar view ──
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* Month navigator */}
      <View style={styles.monthNav}>
        <Pressable onPress={prevMonth} hitSlop={14} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.brand} />
        </Pressable>
        <Text style={styles.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
        <Pressable
          onPress={nextMonth}
          hitSlop={14}
          style={styles.navBtn}
          disabled={isCurrentMonth}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={isCurrentMonth ? Colors.textDim : Colors.brand}
          />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.brand} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="wifi-outline" size={44} color={Colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Monthly summary */}
          {stats && stats.totalTrades > 0 && (
            <MonthlySummary stats={stats} />
          )}

          {/* Day-of-week headers */}
          <View style={styles.dowRow}>
            {DOW_LABELS.map(d => (
              <Text key={d} style={styles.dowLabel}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <CalendarGrid
            year={year}
            month={month}
            byDay={byDay}
            onDayPress={setSelectedDay}
          />

          {/* Empty state */}
          {stats?.totalTrades === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📓</Text>
              <Text style={styles.emptyTitle}>No trades this month</Text>
              <Text style={styles.emptyMuted}>Try navigating to another month.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Monthly summary ──────────────────────────────────────────────────────────

function MonthlySummary({ stats }: { stats: JournalResponse }) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryRow}>
        <SumBox
          label="Net P&L"
          value={formatPnl(stats.totalNet)}
          color={pnlColor(stats.totalNet)}
        />
        <SumBox label="Trades" value={stats.totalTrades.toString()} />
        <SumBox
          label="Win Rate"
          value={`${Math.round(stats.winRate)}%`}
          color={stats.winRate >= 50 ? Colors.brand : Colors.red}
        />
        <SumBox
          label="P. Factor"
          value={stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—'}
        />
      </View>
    </View>
  );
}

function SumBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.sumBox}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={[styles.sumValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

function CalendarGrid({
  year, month, byDay, onDayPress,
}: {
  year: number;
  month: number;
  byDay: Map<string, JournalTrade[]>;
  onDayPress: (day: string) => void;
}) {
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today       = new Date().toISOString().slice(0, 10);

  // Build flat cell array: nulls for leading blanks, then day numbers
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Chunk into rows of 7
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={styles.grid}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.gridRow}>
          {row.map((day, ci) => {
            if (day === null) {
              return <View key={ci} style={styles.emptyCell} />;
            }
            const key    = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const trades = byDay.get(key);
            return (
              <DayCell
                key={ci}
                day={day}
                dayKey={key}
                trades={trades}
                isToday={key === today}
                onPress={trades && trades.length > 0 ? () => onDayPress(key) : undefined}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

function DayCell({
  day, dayKey: _dayKey, trades, isToday, onPress,
}: {
  day: number;
  dayKey: string;
  trades?: JournalTrade[];
  isToday: boolean;
  onPress?: () => void;
}) {
  const hasTrades = !!(trades && trades.length > 0);
  const net    = hasTrades ? trades!.reduce((s, t) => s + t.netProfit, 0) : 0;
  const wins   = hasTrades ? trades!.filter(t => t.netProfit > 0).length : 0;
  const losses = hasTrades ? trades!.filter(t => t.netProfit < 0).length : 0;

  const isProfit    = hasTrades && net > 0;
  const isLoss      = hasTrades && net < 0;
  const isBreakeven = hasTrades && net === 0;

  const borderColor = !hasTrades
    ? Colors.cardBorder
    : isProfit    ? Colors.brand
    : isLoss      ? Colors.red
    : Colors.amber;

  const bgColor = !hasTrades
    ? 'transparent'
    : isProfit    ? Colors.brandDim
    : isLoss      ? Colors.redDim
    : 'rgba(255,214,10,0.1)';

  const netColor = !hasTrades
    ? Colors.textMuted
    : isProfit    ? Colors.brand
    : isLoss      ? Colors.red
    : Colors.amber;

  // Format net P&L compactly — no $ sign, rounded
  const netStr = hasTrades
    ? `${net >= 0 ? '+' : ''}${Math.round(net)}`
    : '';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.dayCell,
        { borderColor, backgroundColor: bgColor },
        isToday && styles.todayRing,
      ]}
    >
      <Text style={[
        styles.dayNum,
        isToday && { color: Colors.brand },
        !hasTrades && { color: Colors.textMuted },
      ]}>
        {day}
      </Text>

      {hasTrades && (
        <>
          <Text style={[styles.dayPnl, { color: netColor }]} numberOfLines={1}>
            {netStr}
          </Text>
          <Text style={styles.dayCount}>{trades!.length}t</Text>
          <View style={styles.dotsRow}>
            {Array.from({ length: Math.min(wins,   4) }).map((_, i) => (
              <View key={`w${i}`} style={[styles.dot, { backgroundColor: Colors.brand }]} />
            ))}
            {Array.from({ length: Math.min(losses, 4) }).map((_, i) => (
              <View key={`l${i}`} style={[styles.dot, { backgroundColor: Colors.red }]} />
            ))}
            {isBreakeven && (
              <View style={[styles.dot, { backgroundColor: Colors.amber }]} />
            )}
          </View>
        </>
      )}
    </Pressable>
  );
}

// ─── Day detail view ──────────────────────────────────────────────────────────

function DayDetailView({
  day, trades, insets, onBack,
}: {
  day: string;
  trades: JournalTrade[];
  insets: { top: number; bottom: number };
  onBack: () => void;
}) {
  const date      = new Date(day + 'T12:00:00');
  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const net         = trades.reduce((s, t) => s + t.netProfit, 0);
  const wins        = trades.filter(t => t.netProfit > 0).length;
  const losses      = trades.filter(t => t.netProfit < 0).length;
  const winRate     = trades.length > 0 ? (wins / trades.length) * 100 : 0;
  const grossProfit = trades
    .filter(t => t.grossProfit > 0)
    .reduce((s, t) => s + t.grossProfit, 0);
  const grossLoss   = Math.abs(trades
    .filter(t => t.grossProfit < 0)
    .reduce((s, t) => s + t.grossProfit, 0));
  const pf          = grossLoss > 0
    ? grossProfit / grossLoss
    : grossProfit > 0 ? 99.0 : 0;

  const bestTrade  = trades.length > 0 ? Math.max(...trades.map(t => t.netProfit)) : 0;
  const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.netProfit)) : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.detailHeader}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.brand} />
          <Text style={styles.backTxt}>Calendar</Text>
        </Pressable>
        <Text style={styles.detailDate} numberOfLines={1}>{dateLabel}</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={trades}
        keyExtractor={t => `${t.accountId}-${t.positionId}-${t.exitTime}`}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Day stats */}
            <View style={styles.statsCard}>
              <View style={styles.statsRow}>
                <StatBox label="Net P&L"   value={formatPnl(net)}         color={pnlColor(net)} />
                <StatBox label="Trades"    value={trades.length.toString()} />
                <StatBox label="Win Rate"  value={`${Math.round(winRate)}%`}
                  color={winRate >= 50 ? Colors.brand : Colors.red} />
                <StatBox label="P. Factor" value={pf > 0 ? pf.toFixed(2) : '—'} />
              </View>
              <View style={styles.statsDivider} />
              <View style={styles.statsRow}>
                <StatBox label="Wins"   value={wins.toString()}          color={Colors.brand} />
                <StatBox label="Losses" value={losses.toString()}        color={Colors.red} />
                <StatBox label="Best"   value={formatPnl(bestTrade)}     color={Colors.brand} />
                <StatBox label="Worst"  value={formatPnl(worstTrade)}    color={Colors.red} />
              </View>
            </View>

            <Text style={styles.sectionLabel}>TRADES</Text>
          </>
        }
        renderItem={({ item }) => <TradeCard trade={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>📓</Text>
            <Text style={styles.emptyTitle}>No trades on this day</Text>
          </View>
        }
      />
    </View>
  );
}

// ─── Trade card ───────────────────────────────────────────────────────────────

function TradeCard({ trade: t }: { trade: JournalTrade }) {
  const isBuy = t.direction?.toLowerCase() === 'buy';

  function fmtTime(iso: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
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
          <Text style={styles.volTxt}>{t.volume} lot{t.volume !== 1 ? 's' : ''}</Text>
        </View>
        <Text style={[styles.pnl, { color: pnlColor(t.netProfit) }]}>
          {formatPnl(t.netProfit)}
        </Text>
      </View>

      <Text style={styles.accountLabel}>{t.accountId} · {t.platform}</Text>

      <View style={styles.priceRow}>
        <PriceStat label="Entry"    value={t.entryPrice?.toString() ?? '—'} />
        <PriceStat label="Exit"     value={t.exitPrice?.toString()  ?? '—'} center />
        <PriceStat label="Duration" value={fmtDuration(t.durationMinutes)} right />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {fmtTime(t.entryTime)} → {fmtTime(t.exitTime)}
        </Text>
        {(t.swap !== 0 || t.commission !== 0) && (
          <Text style={styles.metaText}>
            {t.swap !== 0 ? `swap ${formatPnl(t.swap)}` : ''}
            {t.commission !== 0 ? `  comm ${formatPnl(t.commission)}` : ''}
          </Text>
        )}
      </View>

      {!!t.comment && t.comment !== '' && (
        <Text style={styles.comment} numberOfLines={2}>{t.comment}</Text>
      )}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

function PriceStat({
  label, value, center, right,
}: {
  label: string; value: string; center?: boolean; right?: boolean;
}) {
  return (
    <View style={{ flex: 1, alignItems: center ? 'center' : right ? 'flex-end' : 'flex-start' }}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={styles.priceValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, marginTop: 40 },

  errorText: { color: Colors.red, fontSize: 14, textAlign: 'center' },
  retryBtn:  { backgroundColor: Colors.brand, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10 },
  retryTxt:  { color: '#000', fontWeight: '600' },

  // ── Month navigator
  monthNav:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  navBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 18, fontWeight: '600', color: Colors.text, letterSpacing: -0.5 },

  // ── Monthly summary card
  summaryCard: { marginHorizontal: 16, marginBottom: 14, backgroundColor: Colors.card, borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: Colors.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  summaryRow:  { flexDirection: 'row' },
  sumBox:      { flex: 1, alignItems: 'center' },
  sumLabel:    { fontSize: 9, color: Colors.textMuted, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  sumValue:    { fontSize: 15, fontWeight: '600', color: Colors.text, letterSpacing: -0.3 },

  // ── Day-of-week row
  dowRow:   { flexDirection: 'row', paddingHorizontal: GRID_PAD, marginBottom: 5 },
  dowLabel: { width: CELL_W, textAlign: 'center', fontSize: 10, color: Colors.textMuted, fontWeight: '500', letterSpacing: 0.3 },

  // ── Calendar grid
  grid:      { paddingHorizontal: GRID_PAD },
  gridRow:   { flexDirection: 'row', gap: CELL_GAP, marginBottom: CELL_GAP },
  emptyCell: { width: CELL_W, height: CELL_H },
  dayCell:   { width: CELL_W, height: CELL_H, borderRadius: 10, borderWidth: 1, padding: 6 },
  todayRing: { borderWidth: 1.5 },

  dayNum:   { fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  dayPnl:   { fontSize: 10, fontWeight: '700', letterSpacing: -0.4, marginBottom: 1 },
  dayCount: { fontSize: 9, color: Colors.textMuted },
  dotsRow:  { flexDirection: 'row', gap: 2, marginTop: 3, flexWrap: 'wrap' },
  dot:      { width: 4, height: 4, borderRadius: 2 },

  // ── Empty state
  emptyBox:   { alignItems: 'center', marginTop: 48, gap: 8 },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { color: Colors.textMuted, fontSize: 15, fontWeight: '500' },
  emptyMuted: { color: Colors.textDim, fontSize: 13 },

  // ── Day detail header
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 2, width: 80 },
  backTxt:      { color: Colors.brand, fontSize: 15 },
  detailDate:   { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text, textAlign: 'center', letterSpacing: -0.3 },

  // ── Stats card
  statsCard:    { margin: 16, backgroundColor: Colors.card, borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: Colors.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10 },
  statsRow:     { flexDirection: 'row' },
  statsDivider: { height: 0.5, backgroundColor: Colors.separator, marginVertical: 12 },
  statBox:      { flex: 1, alignItems: 'center' },
  statLabel:    { fontSize: 9, color: Colors.textMuted, marginBottom: 4, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue:    { fontSize: 14, fontWeight: '600', color: Colors.text, letterSpacing: -0.3 },

  sectionLabel: { fontSize: 11, fontWeight: '500', color: Colors.textMuted, letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 8, textTransform: 'uppercase' },

  // ── Trade card
  card:         { marginHorizontal: 16, backgroundColor: Colors.card, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: Colors.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6 },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  symbolRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  symbol:       { fontSize: 15, fontWeight: '700', color: Colors.text, letterSpacing: -0.3 },
  volTxt:       { fontSize: 11, color: Colors.textMuted },
  badge:        { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  buyBadge:     { backgroundColor: Colors.brandDim },
  sellBadge:    { backgroundColor: Colors.redDim },
  badgeTxt:     { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  pnl:          { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  accountLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 12 },
  priceRow:     { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: Colors.separator, paddingTop: 12 },
  priceLabel:   { fontSize: 10, color: Colors.textMuted, marginBottom: 3, fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.4 },
  priceValue:   { fontSize: 13, fontWeight: '500', color: Colors.text },
  metaRow:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 4 },
  metaText:     { fontSize: 11, color: Colors.textMuted },
  comment:      { marginTop: 6, fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
});
