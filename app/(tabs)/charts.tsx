import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text,
  TextInput, View, KeyboardAvoidingView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type AccountConfig, type ManualTradeRequest } from '../../lib/api';
import { Colors } from '../../constants/colors';

// ─── Constants ────────────────────────────────────────────────────────────────

const { height: SCREEN_H } = Dimensions.get('window');
const CHART_RATIO = 0.52;   // chart gets ~52% of screen height

const TV_SYMBOL_MAP: Record<string, string> = {
  XAUUSD: 'OANDA:XAUUSD',
  US30:   'FOREXCOM:DJI',
  NAS100: 'FOREXCOM:NAS100',
  BTCUSD: 'COINBASE:BTCUSD',
  EURUSD: 'FX:EURUSD',
  GBPUSD: 'FX:GBPUSD',
  USDJPY: 'FX:USDJPY',
};

function toTvSymbol(sym: string): string {
  const upper = sym.toUpperCase().trim();
  return TV_SYMBOL_MAP[upper] ?? upper;
}

function buildChartUrl(tvSymbol: string): string {
  const config = {
    autosize:            true,
    symbol:              tvSymbol,
    interval:            '15',
    timezone:            'Etc/UTC',
    theme:               'dark',
    style:               '1',
    locale:              'en',
    backgroundColor:     'rgba(9,9,9,1)',
    gridColor:           'rgba(255,255,255,0.04)',
    hide_top_toolbar:    false,
    hide_side_toolbar:   false,
    hide_legend:         false,
    allow_symbol_change: true,
    withdateranges:      true,
    save_image:          false,
    calendar:            false,
    hide_volume:         false,
    support_host:        'https://www.tradingview.com',
  };
  return `https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=en#${encodeURIComponent(JSON.stringify(config))}`;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChartsScreen() {
  const insets = useSafeAreaInsets();

  const [symbol,      setSymbol]      = useState('XAUUSD');
  const [symEditing,  setSymEditing]  = useState(false);
  const [symDraft,    setSymDraft]    = useState('');
  const [chartLoaded, setChartLoaded] = useState(false);
  const [accounts,    setAccounts]    = useState<AccountConfig[]>([]);
  const [acctModal,   setAcctModal]   = useState(false);

  // Trade form
  const [action,      setAction]      = useState<'buy' | 'sell'>('buy');
  const [lot,         setLot]         = useState('0.01');
  const [slMode,      setSlMode]      = useState<'pips' | 'price'>('pips');
  const [sl,          setSl]          = useState('');
  const [tp,          setTp]          = useState('');
  const [slPips,      setSlPips]      = useState('');
  const [tpPips,      setTpPips]      = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [trading,     setTrading]     = useState(false);
  const [tradeMsg,    setTradeMsg]    = useState<{ ok: boolean; text: string } | null>(null);

  const tvSymbol = toTvSymbol(symbol);
  const chartUrl = buildChartUrl(tvSymbol);
  const urlRef   = useRef(chartUrl);
  const [liveUrl, setLiveUrl] = useState(chartUrl);

  // Only update WebView when symbol actually changes
  useEffect(() => {
    if (chartUrl !== urlRef.current) {
      urlRef.current = chartUrl;
      setLiveUrl(chartUrl);
      setChartLoaded(false);
    }
  }, [chartUrl]);

  useEffect(() => {
    api.getAccounts().then(setAccounts).catch(() => {});
  }, []);

  const connectedAccounts = accounts.filter(a => a.enabled && a.connected !== false);

  function commitSymbol() {
    const s = symDraft.trim().toUpperCase();
    if (s) setSymbol(s);
    setSymEditing(false);
    setSymDraft('');
  }

  function toggleAccount(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const execTrade = useCallback(async (action: 'buy' | 'sell' | 'close') => {
    if (action !== 'close') {
      const lotNum = parseFloat(lot);
      if (!lotNum || lotNum <= 0) {
        setTradeMsg({ ok: false, text: 'Invalid lot size' });
        return;
      }
    }
    const req: ManualTradeRequest = {
      action,
      symbol,
      lot:      action !== 'close' ? parseFloat(lot) : undefined,
      comment:  'Growr Manual',
      accounts: selectedIds,
    };
    if (action !== 'close') {
      if (slMode === 'pips') {
        if (slPips) req.slPips = parseFloat(slPips);
        if (tpPips) req.tpPips = parseFloat(tpPips);
      } else {
        if (sl) req.sl = parseFloat(sl);
        if (tp) req.tp = parseFloat(tp);
      }
    }
    setTrading(true);
    setTradeMsg(null);
    try {
      const res = await api.trade(req);
      const ok  = res.accountsFailed === 0;
      setTradeMsg({
        ok,
        text: ok
          ? `✓ ${res.accountsSuccess} account(s) filled`
          : `${res.accountsSuccess} filled · ${res.accountsFailed} failed`,
      });
    } catch (e) {
      setTradeMsg({ ok: false, text: e instanceof Error ? e.message : 'Failed' });
    } finally {
      setTrading(false);
    }
  }, [action, symbol, lot, sl, tp, slPips, tpPips, slMode, selectedIds]);

  const CHART_H = SCREEN_H * CHART_RATIO;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Symbol header ── */}
      <View style={styles.symHeader}>
        {symEditing ? (
          <View style={styles.symEditRow}>
            <TextInput
              style={styles.symEditInput}
              value={symDraft}
              onChangeText={t => setSymDraft(t.toUpperCase())}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={commitSymbol}
              placeholder="e.g. EURUSD"
              placeholderTextColor={Colors.textDim}
            />
            <Pressable style={styles.symDoneBtn} onPress={commitSymbol}>
              <Text style={styles.symDoneTxt}>Done</Text>
            </Pressable>
            <Pressable onPress={() => setSymEditing(false)} hitSlop={8}>
              <Ionicons name="close" size={18} color={Colors.textMuted} />
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.symDisplay} onPress={() => { setSymDraft(symbol); setSymEditing(true); }}>
            <Text style={styles.symName}>{symbol}</Text>
            <Ionicons name="pencil-outline" size={13} color={Colors.textMuted} style={{ marginLeft: 6 }} />
          </Pressable>
        )}
      </View>

      {/* ── Chart ── */}
      <View style={[styles.chartWrap, { height: CHART_H }]}>
        {!chartLoaded && (
          <View style={styles.chartLoader}>
            <ActivityIndicator color={Colors.brand} size="large" />
            <Text style={styles.chartLoaderTxt}>Loading {symbol}…</Text>
          </View>
        )}
        <WebView
          key={liveUrl}
          source={{ uri: liveUrl }}
          style={[styles.webview, !chartLoaded && { opacity: 0 }]}
          onLoad={() => setChartLoaded(true)}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          scrollEnabled={false}
        />
      </View>

      {/* ── Trade panel (always visible) ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.tradePanel}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.tradePanelContent, { paddingBottom: insets.bottom + 80 }]}
        >
          {/* Buy / Sell */}
          <View style={styles.bsRow}>
            <Pressable
              style={[styles.bsBtn, action === 'buy' && styles.bsBuy]}
              onPress={() => setAction('buy')}
            >
              <Ionicons name="trending-up" size={15} color={action === 'buy' ? '#000' : Colors.brand} />
              <Text style={[styles.bsTxt, action === 'buy' && { color: '#000' }]}>BUY</Text>
            </Pressable>
            <Pressable
              style={[styles.bsBtn, action === 'sell' && styles.bsSell]}
              onPress={() => setAction('sell')}
            >
              <Ionicons name="trending-down" size={15} color={action === 'sell' ? '#fff' : Colors.red} />
              <Text style={[styles.bsTxt, action === 'sell' && { color: '#fff' }]}>SELL</Text>
            </Pressable>
          </View>

          {/* Lot + SL/TP mode */}
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>LOT SIZE</Text>
              <TextInput
                style={styles.inputField}
                value={lot}
                onChangeText={setLot}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
            </View>
            <View style={styles.modeToggle}>
              {(['pips', 'price'] as const).map(m => (
                <Pressable
                  key={m}
                  style={[styles.modeBtn, slMode === m && styles.modeBtnOn]}
                  onPress={() => setSlMode(m)}
                >
                  <Text style={[styles.modeTxt, slMode === m && styles.modeTxtOn]}>
                    {m === 'pips' ? 'Pips' : 'Price'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* SL / TP */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>{slMode === 'pips' ? 'SL PIPS' : 'STOP LOSS'}</Text>
              <TextInput
                style={styles.inputField}
                value={slMode === 'pips' ? slPips : sl}
                onChangeText={slMode === 'pips' ? setSlPips : setSl}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={Colors.textDim}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>{slMode === 'pips' ? 'TP PIPS' : 'TAKE PROFIT'}</Text>
              <TextInput
                style={styles.inputField}
                value={slMode === 'pips' ? tpPips : tp}
                onChangeText={slMode === 'pips' ? setTpPips : setTp}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={Colors.textDim}
              />
            </View>
          </View>

          {/* Account selector */}
          <Pressable style={styles.acctPill} onPress={() => setAcctModal(true)}>
            <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.acctPillTxt}>
              {selectedIds.length === 0
                ? `All accounts (${connectedAccounts.length})`
                : `${selectedIds.length} account${selectedIds.length !== 1 ? 's' : ''} selected`}
            </Text>
            <Ionicons name="chevron-down" size={13} color={Colors.textMuted} />
          </Pressable>

          {/* Result */}
          {tradeMsg && (
            <Pressable
              style={[styles.resultBar, { borderColor: tradeMsg.ok ? Colors.brand : Colors.red }]}
              onPress={() => setTradeMsg(null)}
            >
              <Text style={{ color: tradeMsg.ok ? Colors.brand : Colors.red, fontSize: 13, fontWeight: '500' }}>
                {tradeMsg.text}
              </Text>
            </Pressable>
          )}

          {/* Execute */}
          <Pressable
            style={[
              styles.execBtn,
              action === 'buy' ? styles.execBuy : styles.execSell,
              (trading || connectedAccounts.length === 0) && { opacity: 0.5 },
            ]}
            onPress={() => execTrade(action)}
            disabled={trading || connectedAccounts.length === 0}
          >
            {trading
              ? <ActivityIndicator color={action === 'buy' ? '#000' : '#fff'} size="small" />
              : <Text style={[styles.execTxt, { color: action === 'buy' ? '#000' : '#fff' }]}>
                  {action.toUpperCase()} {symbol}
                </Text>
            }
          </Pressable>

          <Pressable
            style={[styles.closeBtn, (trading || connectedAccounts.length === 0) && { opacity: 0.5 }]}
            onPress={() => execTrade('close')}
            disabled={trading || connectedAccounts.length === 0}
          >
            <Text style={styles.closeTxt}>Close {symbol}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Account picker modal ── */}
      <Modal visible={acctModal} transparent animationType="slide" onRequestClose={() => setAcctModal(false)}>
        <Pressable style={styles.modalBg} onPress={() => setAcctModal(false)} />
        <View style={[styles.acctSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Select Accounts</Text>

          <Pressable
            style={[styles.acctRow, selectedIds.length === 0 && styles.acctRowOn]}
            onPress={() => setSelectedIds([])}
          >
            <Text style={[styles.acctId, selectedIds.length === 0 && { color: Colors.brand }]}>
              All Accounts
            </Text>
            <Text style={styles.acctCount}>{connectedAccounts.length}</Text>
          </Pressable>

          {connectedAccounts.map(a => (
            <Pressable
              key={a.id}
              style={[styles.acctRow, selectedIds.includes(a.id) && styles.acctRowOn]}
              onPress={() => toggleAccount(a.id)}
            >
              <Text style={[styles.acctId, selectedIds.includes(a.id) && { color: Colors.brand }]}>
                {a.id}
              </Text>
              <Text style={styles.acctPlatformTxt}>{a.platform?.toUpperCase()}</Text>
            </Pressable>
          ))}

          {connectedAccounts.length === 0 && (
            <Text style={styles.noAccts}>No connected accounts</Text>
          )}

          <Pressable style={styles.doneBtn} onPress={() => setAcctModal(false)}>
            <Text style={styles.doneBtnTxt}>Done</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090909' },

  // Symbol header
  symHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#0d0d0d', borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  symDisplay:   { flexDirection: 'row', alignItems: 'center' },
  symName:      { fontSize: 20, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  symEditRow:   { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  symEditInput: { flex: 1, backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.brand, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, fontWeight: '600', color: Colors.text },
  symDoneBtn:   { backgroundColor: Colors.brand, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  symDoneTxt:   { color: '#000', fontWeight: '700', fontSize: 13 },

  // Chart
  chartWrap:    { backgroundColor: '#090909', borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  chartLoader:  { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 1 },
  chartLoaderTxt: { color: Colors.textMuted, fontSize: 13 },
  webview:      { flex: 1, backgroundColor: '#090909' },

  // Trade panel
  tradePanel:        { flex: 1, backgroundColor: Colors.bg },
  tradePanelContent: { padding: 14, gap: 12 },

  // Buy / Sell
  bsRow:  { flexDirection: 'row', gap: 10 },
  bsBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12, backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.cardBorder },
  bsBuy:  { backgroundColor: Colors.brand, borderColor: Colors.brand },
  bsSell: { backgroundColor: Colors.red, borderColor: Colors.red },
  bsTxt:  { fontSize: 14, fontWeight: '800', color: Colors.textMuted, letterSpacing: 0.3 },

  // Inputs
  row:        { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  inputGroup: { gap: 5 },
  inputLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600', letterSpacing: 0.7, textTransform: 'uppercase' },
  inputField: { backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.cardBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, fontWeight: '500', minWidth: 80 },

  // SL/TP mode toggle
  modeToggle:  { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: 10, borderWidth: 0.5, borderColor: Colors.cardBorder, padding: 3, gap: 3, alignSelf: 'flex-end' },
  modeBtn:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7 },
  modeBtnOn:   { backgroundColor: Colors.cardElevated },
  modeTxt:     { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  modeTxtOn:   { color: Colors.text },

  // Account pill
  acctPill:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 0.5, borderColor: Colors.cardBorder },
  acctPillTxt: { flex: 1, fontSize: 13, color: Colors.textMuted, fontWeight: '400' },

  // Result
  resultBar: { borderWidth: 0.5, borderRadius: 10, padding: 10, alignItems: 'center' },

  // Execute
  execBtn: { paddingVertical: 15, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  execBuy: { backgroundColor: Colors.brand },
  execSell:{ backgroundColor: Colors.red },
  execTxt: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  closeBtn:{ paddingVertical: 12, borderRadius: 14, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.cardBorder },
  closeTxt:{ fontSize: 14, fontWeight: '600', color: Colors.textMuted },

  // Account modal
  modalBg:      { flex: 1 },
  acctSheet:    { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 12 },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.separator, alignSelf: 'center', marginBottom: 14 },
  sheetTitle:   { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 14 },
  acctRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, borderWidth: 0.5, borderColor: Colors.cardBorder, backgroundColor: Colors.card, marginBottom: 8 },
  acctRowOn:    { borderColor: Colors.brand, backgroundColor: Colors.brandDim },
  acctId:       { fontSize: 14, fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'] },
  acctCount:    { fontSize: 13, color: Colors.textMuted },
  acctPlatformTxt: { fontSize: 11, color: Colors.textMuted, letterSpacing: 0.4 },
  noAccts:      { color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginVertical: 16 },
  doneBtn:      { backgroundColor: Colors.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  doneBtnTxt:   { color: '#000', fontWeight: '700', fontSize: 15 },
});
