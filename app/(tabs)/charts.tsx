import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Dimensions, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type AccountConfig, type ManualTradeRequest } from '../../lib/api';
import { Colors } from '../../constants/colors';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'US30', 'NAS100', 'BTCUSD'];

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

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChartsScreen() {
  const insets = useSafeAreaInsets();

  const [symbol,      setSymbol]      = useState('XAUUSD');
  const [customSym,   setCustomSym]   = useState('');
  const [chartLoaded, setChartLoaded] = useState(false);
  const [tradeOpen,   setTradeOpen]   = useState(false);
  const [accounts,    setAccounts]    = useState<AccountConfig[]>([]);

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

  const activeSymbol = (customSym.trim() || symbol).toUpperCase();
  const tvSymbol     = toTvSymbol(activeSymbol);
  const chartUrl     = buildChartUrl(tvSymbol);

  // Keep a stable ref to avoid reloading chart on re-renders
  const chartUrlRef = useRef(chartUrl);
  const [currentUrl, setCurrentUrl] = useState(chartUrl);

  useEffect(() => {
    if (chartUrl !== chartUrlRef.current) {
      chartUrlRef.current = chartUrl;
      setCurrentUrl(chartUrl);
      setChartLoaded(false);
    }
  }, [chartUrl]);

  // Load accounts
  useEffect(() => {
    api.getAccounts().then(setAccounts).catch(() => {});
  }, []);

  const connectedAccounts = accounts.filter(a => a.enabled && a.connected !== false);

  function toggleAccount(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const handleTrade = useCallback(async () => {
    const lotNum = parseFloat(lot);
    if (!lotNum || lotNum <= 0) {
      setTradeMsg({ ok: false, text: 'Invalid lot size' });
      return;
    }
    const req: ManualTradeRequest = {
      action:   action,
      symbol:   activeSymbol,
      lot:      lotNum,
      comment:  'Growr Manual',
      accounts: selectedIds,
    };
    if (slMode === 'pips') {
      if (slPips) req.slPips = parseFloat(slPips);
      if (tpPips) req.tpPips = parseFloat(tpPips);
    } else {
      if (sl) req.sl = parseFloat(sl);
      if (tp) req.tp = parseFloat(tp);
    }
    setTrading(true);
    setTradeMsg(null);
    try {
      const res = await api.trade(req);
      if (res.accountsFailed === 0) {
        setTradeMsg({ ok: true, text: `✓ ${res.accountsSuccess} account(s) filled` });
      } else {
        setTradeMsg({ ok: false, text: `${res.accountsSuccess} filled · ${res.accountsFailed} failed` });
      }
    } catch (e) {
      setTradeMsg({ ok: false, text: e instanceof Error ? e.message : 'Trade failed' });
    } finally {
      setTrading(false);
    }
  }, [action, activeSymbol, lot, sl, tp, slPips, tpPips, slMode, selectedIds]);

  const handleClose = useCallback(async () => {
    setTrading(true);
    setTradeMsg(null);
    try {
      const res = await api.trade({ action: 'close', symbol: activeSymbol, accounts: selectedIds });
      setTradeMsg({ ok: true, text: `✓ Closed on ${res.accountsSuccess} account(s)` });
    } catch (e) {
      setTradeMsg({ ok: false, text: e instanceof Error ? e.message : 'Close failed' });
    } finally {
      setTrading(false);
    }
  }, [activeSymbol, selectedIds]);

  return (
    <View style={styles.root}>

      {/* ── Symbol bar ── */}
      <View style={styles.symBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.symScroll}
        >
          {QUICK_SYMBOLS.map(s => (
            <Pressable
              key={s}
              style={[styles.symChip, activeSymbol === s && styles.symChipActive]}
              onPress={() => { setSymbol(s); setCustomSym(''); setChartLoaded(false); }}
            >
              <Text style={[styles.symTxt, activeSymbol === s && styles.symTxtActive]}>{s}</Text>
            </Pressable>
          ))}

          {/* Custom symbol input */}
          <TextInput
            style={styles.symInput}
            value={customSym}
            onChangeText={t => setCustomSym(t.toUpperCase())}
            placeholder="Symbol…"
            placeholderTextColor={Colors.textDim}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
          />
        </ScrollView>
      </View>

      {/* ── Chart ── */}
      <View style={styles.chartContainer}>
        {!chartLoaded && (
          <View style={styles.chartLoader}>
            <ActivityIndicator color={Colors.brand} size="large" />
            <Text style={styles.chartLoaderTxt}>Loading {activeSymbol} chart…</Text>
          </View>
        )}
        <WebView
          key={currentUrl}
          source={{ uri: currentUrl }}
          style={[styles.webview, !chartLoaded && { opacity: 0 }]}
          onLoad={() => setChartLoaded(true)}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          scrollEnabled={false}
        />
      </View>

      {/* ── Quick trade bar (always visible) ── */}
      <View style={[styles.tradeBar, { paddingBottom: insets.bottom + 4 }]}>
        {/* Buy / Sell toggle */}
        <View style={styles.actionToggle}>
          <Pressable
            style={[styles.actionBtn, action === 'buy' && styles.buyActive]}
            onPress={() => setAction('buy')}
          >
            <Ionicons name="trending-up" size={14} color={action === 'buy' ? '#000' : Colors.brand} />
            <Text style={[styles.actionTxt, action === 'buy' && styles.buyActiveTxt]}>BUY</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, action === 'sell' && styles.sellActive]}
            onPress={() => setAction('sell')}
          >
            <Ionicons name="trending-down" size={14} color={action === 'sell' ? '#fff' : Colors.red} />
            <Text style={[styles.actionTxt, action === 'sell' && styles.sellActiveTxt]}>SELL</Text>
          </Pressable>
        </View>

        {/* Lot input */}
        <View style={styles.lotWrap}>
          <Text style={styles.lotLabel}>LOT</Text>
          <TextInput
            style={styles.lotInput}
            value={lot}
            onChangeText={setLot}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
        </View>

        {/* Execute */}
        <Pressable
          style={[
            styles.execBtn,
            action === 'buy' ? styles.execBuy : styles.execSell,
            (trading || connectedAccounts.length === 0) && { opacity: 0.5 },
          ]}
          onPress={handleTrade}
          disabled={trading || connectedAccounts.length === 0}
        >
          {trading
            ? <ActivityIndicator color={action === 'buy' ? '#000' : '#fff'} size="small" />
            : <Text style={[styles.execTxt, action === 'buy' ? { color: '#000' } : { color: '#fff' }]}>
                {action === 'buy' ? 'BUY' : 'SELL'} {activeSymbol}
              </Text>
          }
        </Pressable>

        {/* More options */}
        <Pressable style={styles.moreBtn} onPress={() => setTradeOpen(true)} hitSlop={8}>
          <Ionicons name="options-outline" size={20} color={Colors.textMuted} />
        </Pressable>
      </View>

      {/* ── Trade result toast ── */}
      {tradeMsg && (
        <Pressable
          style={[styles.toastBar, { bottom: insets.bottom + 64 }]}
          onPress={() => setTradeMsg(null)}
        >
          <Text style={[styles.toastTxt, { color: tradeMsg.ok ? Colors.brand : Colors.red }]}>
            {tradeMsg.text}
          </Text>
        </Pressable>
      )}

      {/* ── Full trade panel modal ── */}
      <TradePanelModal
        visible={tradeOpen}
        onClose={() => setTradeOpen(false)}
        symbol={activeSymbol}
        action={action}
        setAction={setAction}
        lot={lot}
        setLot={setLot}
        slMode={slMode}
        setSlMode={setSlMode}
        sl={sl} setSl={setSl}
        tp={tp} setTp={setTp}
        slPips={slPips} setSlPips={setSlPips}
        tpPips={tpPips} setTpPips={setTpPips}
        accounts={connectedAccounts}
        selectedIds={selectedIds}
        toggleAccount={toggleAccount}
        trading={trading}
        tradeMsg={tradeMsg}
        onTrade={handleTrade}
        onClose={handleClose}
        insets={insets}
      />
    </View>
  );
}

// ─── Trade panel modal ────────────────────────────────────────────────────────

function TradePanelModal({
  visible, onClose, symbol, action, setAction, lot, setLot,
  slMode, setSlMode, sl, setSl, tp, setTp, slPips, setSlPips,
  tpPips, setTpPips, accounts, selectedIds, toggleAccount,
  trading, tradeMsg, onTrade, onClose: onClosePos, insets,
}: {
  visible:       boolean;
  onClose:       () => void;
  symbol:        string;
  action:        'buy' | 'sell';
  setAction:     (a: 'buy' | 'sell') => void;
  lot:           string;
  setLot:        (v: string) => void;
  slMode:        'pips' | 'price';
  setSlMode:     (m: 'pips' | 'price') => void;
  sl:            string; setSl: (v: string) => void;
  tp:            string; setTp: (v: string) => void;
  slPips:        string; setSlPips: (v: string) => void;
  tpPips:        string; setTpPips: (v: string) => void;
  accounts:      AccountConfig[];
  selectedIds:   string[];
  toggleAccount: (id: string) => void;
  trading:       boolean;
  tradeMsg:      { ok: boolean; text: string } | null;
  onTrade:       () => void;
  onClose:       () => void;
  insets:        { bottom: number };
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.panel, { paddingBottom: insets.bottom + 16 }]}>

          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Trade {symbol}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>

            {/* Buy / Sell */}
            <View style={styles.panelActionRow}>
              <Pressable
                style={[styles.panelActionBtn, action === 'buy' && styles.buyActive]}
                onPress={() => setAction('buy')}
              >
                <Ionicons name="trending-up" size={16} color={action === 'buy' ? '#000' : Colors.brand} />
                <Text style={[styles.panelActionTxt, action === 'buy' && { color: '#000' }]}>BUY</Text>
              </Pressable>
              <Pressable
                style={[styles.panelActionBtn, action === 'sell' && styles.sellActive]}
                onPress={() => setAction('sell')}
              >
                <Ionicons name="trending-down" size={16} color={action === 'sell' ? '#fff' : Colors.red} />
                <Text style={[styles.panelActionTxt, action === 'sell' && { color: '#fff' }]}>SELL</Text>
              </Pressable>
            </View>

            {/* Lot size */}
            <FieldRow label="Lot Size">
              <TextInput
                style={styles.fieldInput}
                value={lot}
                onChangeText={setLot}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
            </FieldRow>

            {/* SL/TP mode */}
            <View style={styles.modeRow}>
              {(['pips', 'price'] as const).map(m => (
                <Pressable
                  key={m}
                  style={[styles.modeBtn, slMode === m && styles.modeBtnActive]}
                  onPress={() => setSlMode(m)}
                >
                  <Text style={[styles.modeTxt, slMode === m && styles.modeTxtActive]}>
                    {m === 'pips' ? 'Pips' : 'Price'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* SL / TP inputs */}
            <View style={styles.slTpRow}>
              <FieldRow label={slMode === 'pips' ? 'SL Pips' : 'Stop Loss'} flex>
                <TextInput
                  style={styles.fieldInput}
                  value={slMode === 'pips' ? slPips : sl}
                  onChangeText={slMode === 'pips' ? setSlPips : setSl}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textDim}
                />
              </FieldRow>
              <View style={{ width: 12 }} />
              <FieldRow label={slMode === 'pips' ? 'TP Pips' : 'Take Profit'} flex>
                <TextInput
                  style={styles.fieldInput}
                  value={slMode === 'pips' ? tpPips : tp}
                  onChangeText={slMode === 'pips' ? setTpPips : setTp}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textDim}
                />
              </FieldRow>
            </View>

            {/* Accounts */}
            <Text style={styles.sectionLabel}>ACCOUNTS</Text>
            <Pressable
              style={[styles.acctRow, selectedIds.length === 0 && styles.acctRowActive]}
              onPress={() => { /* clear selection = all */ }}
            >
              <Text style={[styles.acctId, selectedIds.length === 0 && { color: Colors.brand }]}>
                All Accounts
              </Text>
              <Text style={styles.acctCount}>{accounts.length}</Text>
            </Pressable>
            {accounts.map(a => (
              <Pressable
                key={a.id}
                style={[styles.acctRow, selectedIds.includes(a.id) && styles.acctRowActive]}
                onPress={() => toggleAccount(a.id)}
              >
                <Text style={[styles.acctId, selectedIds.includes(a.id) && { color: Colors.brand }]}>
                  {a.id}
                </Text>
                <Text style={styles.acctPlatform}>{a.platform}</Text>
              </Pressable>
            ))}
            {accounts.length === 0 && (
              <Text style={styles.noAccounts}>No connected accounts</Text>
            )}

            {/* Result */}
            {tradeMsg && (
              <View style={[styles.resultBar, { borderColor: tradeMsg.ok ? Colors.brand : Colors.red }]}>
                <Text style={{ color: tradeMsg.ok ? Colors.brand : Colors.red, fontSize: 13 }}>
                  {tradeMsg.text}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Execute buttons */}
          <View style={styles.panelBtns}>
            <Pressable
              style={[
                styles.panelExec,
                action === 'buy' ? styles.execBuy : styles.execSell,
                (trading || accounts.length === 0) && { opacity: 0.5 },
              ]}
              onPress={onTrade}
              disabled={trading || accounts.length === 0}
            >
              {trading
                ? <ActivityIndicator color={action === 'buy' ? '#000' : '#fff'} size="small" />
                : <Text style={[styles.panelExecTxt, { color: action === 'buy' ? '#000' : '#fff' }]}>
                    {action.toUpperCase()} {symbol}
                  </Text>
              }
            </Pressable>
            <Pressable
              style={[styles.panelClose, (trading || accounts.length === 0) && { opacity: 0.5 }]}
              onPress={onClosePos}
              disabled={trading || accounts.length === 0}
            >
              <Text style={styles.panelCloseTxt}>Close {symbol}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FieldRow({ label, children, flex }: {
  label: string; children: React.ReactNode; flex?: boolean;
}) {
  return (
    <View style={flex ? { flex: 1 } : styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#090909' },

  // Symbol bar
  symBar:         { backgroundColor: '#0d0d0d', borderBottomWidth: 0.5, borderBottomColor: Colors.cardBorder },
  symScroll:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  symChip:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, borderWidth: 0.5, borderColor: Colors.cardBorder, backgroundColor: Colors.card },
  symChipActive:  { backgroundColor: Colors.brandDim, borderColor: Colors.brand },
  symTxt:         { fontSize: 11, fontWeight: '600', color: Colors.textMuted, fontVariant: ['tabular-nums'] },
  symTxtActive:   { color: Colors.brand },
  symInput:       { marginLeft: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, borderWidth: 0.5, borderColor: Colors.cardBorder, backgroundColor: Colors.card, fontSize: 11, color: Colors.text, fontWeight: '600', width: 80 },

  // Chart
  chartContainer: { flex: 1, backgroundColor: '#090909' },
  chartLoader:    { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 1 },
  chartLoaderTxt: { color: Colors.textMuted, fontSize: 13 },
  webview:        { flex: 1, backgroundColor: '#090909' },

  // Quick trade bar
  tradeBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, gap: 8, backgroundColor: '#0d0d0d', borderTopWidth: 0.5, borderTopColor: Colors.cardBorder },
  actionToggle:   { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.cardBorder },
  actionBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8 },
  buyActive:      { backgroundColor: Colors.brand },
  sellActive:     { backgroundColor: Colors.red },
  actionTxt:      { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  buyActiveTxt:   { color: '#000' },
  sellActiveTxt:  { color: '#fff' },
  lotWrap:        { alignItems: 'center' },
  lotLabel:       { fontSize: 9, color: Colors.textMuted, fontWeight: '500', letterSpacing: 0.5, marginBottom: 2 },
  lotInput:       { backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.cardBorder, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: Colors.text, fontWeight: '600', width: 64, textAlign: 'center' },
  execBtn:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
  execBuy:        { backgroundColor: Colors.brand },
  execSell:       { backgroundColor: Colors.red },
  execTxt:        { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  moreBtn:        { padding: 6 },

  // Toast
  toastBar:       { position: 'absolute', left: 16, right: 16, backgroundColor: Colors.card, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.cardBorder },
  toastTxt:       { fontSize: 13, fontWeight: '600' },

  // Modal overlay
  modalOverlay:   { flex: 1, justifyContent: 'flex-end' },
  panel:          { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 12, maxHeight: SCREEN_H * 0.85 },
  handle:         { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.separator, alignSelf: 'center', marginBottom: 12 },
  panelHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  panelTitle:     { fontSize: 16, fontWeight: '700', color: Colors.text, letterSpacing: -0.3 },

  // Panel trade controls
  panelActionRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  panelActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 0.5, borderColor: Colors.cardBorder, backgroundColor: Colors.card },
  panelActionTxt: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },

  fieldRow:       { marginBottom: 14 },
  fieldLabel:     { fontSize: 10, color: Colors.textMuted, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  fieldInput:     { backgroundColor: Colors.card, borderWidth: 0.5, borderColor: Colors.cardBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, fontWeight: '500' },

  modeRow:        { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: 10, borderWidth: 0.5, borderColor: Colors.cardBorder, padding: 3, marginBottom: 14, gap: 3 },
  modeBtn:        { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  modeBtnActive:  { backgroundColor: Colors.cardElevated },
  modeTxt:        { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  modeTxtActive:  { color: Colors.text },

  slTpRow:        { flexDirection: 'row', marginBottom: 14 },

  sectionLabel:   { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  acctRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 0.5, borderColor: Colors.cardBorder, backgroundColor: Colors.card, marginBottom: 6 },
  acctRowActive:  { borderColor: Colors.brand, backgroundColor: Colors.brandDim },
  acctId:         { fontSize: 13, fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'] },
  acctCount:      { fontSize: 12, color: Colors.textMuted },
  acctPlatform:   { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase' },
  noAccounts:     { color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginVertical: 12 },

  resultBar:      { borderWidth: 0.5, borderRadius: 10, padding: 12, marginVertical: 8, alignItems: 'center' },

  panelBtns:      { gap: 10, marginTop: 12 },
  panelExec:      { paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  panelExecTxt:   { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  panelClose:     { paddingVertical: 12, borderRadius: 14, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.cardBorder },
  panelCloseTxt:  { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
});
