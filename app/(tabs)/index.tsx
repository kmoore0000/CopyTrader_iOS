import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, formatCurrency, formatPnl, pnlColor, type AccountStatus, type StatusResponse } from '../../lib/api';
import { Colors } from '../../constants/colors';

const POLL_MS = 5000;

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [data,     setData]     = useState<StatusResponse | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getStatus();
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed');
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

  // Aggregate totals
  const connected = data?.accounts.filter(a => a.connected) ?? [];
  const totalBalance = connected.reduce((s, a) => s + a.balance, 0);
  const totalEquity  = connected.reduce((s, a) => s + a.equity,  0);
  const totalPnl     = totalEquity - totalBalance;
  const totalPos     = connected.reduce((s, a) => s + a.openPositions, 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
          <Ionicons name="settings-outline" size={22} color={Colors.textMuted} />
        </Pressable>
      </View>

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.brand} size="large" />
          <Text style={styles.loadingText}>Connecting to Growr...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="wifi-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.errorTitle}>Can't reach backend</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/settings')}>
            <Text style={styles.settingsLink}>Change server URL →</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data?.accounts ?? []}
          keyExtractor={a => a.accountId}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand} />
          }
          ListHeaderComponent={
            <>
              {/* Summary card */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Balance</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(totalBalance, 0)}</Text>
                  </View>
                  <View style={[styles.summaryItem, { alignItems: 'center' }]}>
                    <Text style={styles.summaryLabel}>Open P&L</Text>
                    <Text style={[styles.summaryValue, { color: pnlColor(totalPnl) }]}>
                      {formatPnl(totalPnl)}
                    </Text>
                  </View>
                  <View style={[styles.summaryItem, { alignItems: 'flex-end' }]}>
                    <Text style={styles.summaryLabel}>Positions</Text>
                    <Text style={styles.summaryValue}>{totalPos}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.pillRow}>
                  <View style={styles.pill}>
                    <View style={[styles.dot, { backgroundColor: Colors.brand }]} />
                    <Text style={styles.pillText}>{data?.connected ?? 0} connected</Text>
                  </View>
                  {(data?.failed ?? 0) > 0 && (
                    <View style={styles.pill}>
                      <View style={[styles.dot, { backgroundColor: Colors.red }]} />
                      <Text style={[styles.pillText, { color: Colors.red }]}>
                        {data?.failed} offline
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <Text style={styles.sectionLabel}>ACCOUNTS</Text>
            </>
          }
          renderItem={({ item }) => <AccountCard account={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

function AccountCard({ account }: { account: AccountStatus }) {
  const pnl = account.equity - account.balance;
  return (
    <View style={[
      styles.card,
      !account.connected && { opacity: 0.5 },
    ]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitle}>
          <View style={[styles.dot, { backgroundColor: account.connected ? Colors.brand : Colors.red }]} />
          <Text style={styles.accountId}>{account.accountId}</Text>
        </View>
        <Text style={styles.platform}>{account.platform}</Text>
      </View>

      {account.connected ? (
        <>
          <View style={styles.cardRow}>
            <Stat label="Balance"   value={formatCurrency(account.balance, 0)} />
            <Stat label="Equity"    value={formatCurrency(account.equity,  0)} center />
            <Stat label="Open P&L"  value={formatPnl(pnl)} color={pnlColor(pnl)} right />
          </View>
          {account.openPositions > 0 && (
            <View style={styles.posCount}>
              <Text style={styles.posCountText}>
                {account.openPositions} open position{account.openPositions !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </>
      ) : (
        <Text style={styles.errorSub}>{account.error ?? 'Disconnected'}</Text>
      )}
    </View>
  );
}

function Stat({
  label, value, color, center, right,
}: {
  label: string; value: string; color?: string; center?: boolean; right?: boolean;
}) {
  return (
    <View style={{ flex: 1, alignItems: center ? 'center' : right ? 'flex-end' : 'flex-start' }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: Colors.bg },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  logo:          { height: 28, width: 110 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  loadingText:   { color: Colors.textMuted, fontSize: 14, marginTop: 8 },
  errorTitle:    { color: Colors.text, fontSize: 17, fontWeight: '600' },
  errorSub:      { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
  retryBtn:      { marginTop: 8, backgroundColor: Colors.brand, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12 },
  retryText:     { color: '#000', fontWeight: '600' },
  settingsLink:  { color: Colors.brand, fontSize: 13, marginTop: 4 },
  summaryCard:   { margin: 16, backgroundColor: Colors.card, borderRadius: 20, padding: 20, borderWidth: 0.5, borderColor: Colors.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14 },
  summaryRow:    { flexDirection: 'row' },
  summaryItem:   { flex: 1 },
  summaryLabel:  { fontSize: 10, color: Colors.textMuted, marginBottom: 5, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryValue:  { fontSize: 20, fontWeight: '600', color: Colors.text, letterSpacing: -0.5 },
  divider:       { height: 0.5, backgroundColor: Colors.separator, marginVertical: 14 },
  pillRow:       { flexDirection: 'row', gap: 12 },
  pill:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:           { width: 6, height: 6, borderRadius: 3 },
  pillText:      { fontSize: 12, color: Colors.textMuted, fontWeight: '400' },
  sectionLabel:  { fontSize: 11, fontWeight: '500', color: Colors.textMuted, letterSpacing: 0.8, paddingHorizontal: 20, marginBottom: 8, textTransform: 'uppercase' },
  card:          { marginHorizontal: 16, backgroundColor: Colors.card, borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: Colors.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8 },
  cardHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accountId:     { fontSize: 15, fontWeight: '600', color: Colors.text },
  platform:      { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', fontWeight: '500', letterSpacing: 0.6 },
  cardRow:       { flexDirection: 'row' },
  statLabel:     { fontSize: 10, color: Colors.textMuted, marginBottom: 3, fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue:     { fontSize: 16, fontWeight: '600', color: Colors.text, letterSpacing: -0.3 },
  posCount:      { marginTop: 12, backgroundColor: Colors.brandDim, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  posCountText:  { fontSize: 11, color: Colors.brand, fontWeight: '500' },
});
