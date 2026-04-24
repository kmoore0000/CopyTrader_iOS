import { getBaseUrl } from './storage';

// ─── Types (mirrored from desktop app) ──────────────────────────────────────

export interface AccountStatus {
  accountId:     string;
  platform:      string;
  connected:     boolean;
  balance:       number;
  equity:        number;
  openPositions: number;
  error?:        string;
}

export interface OpenPosition {
  accountId:    string;
  platform:     string;
  positionId:   string;
  symbol:       string;
  type:         string;   // "buy" | "sell"
  volume:       number;
  openPrice:    number;
  currentPrice: number;
  profit:       number;
  swap:         number;
  comment?:     string;
  openTime:     string;
}

export interface HistoryDeal {
  id:         string;
  type:       string;
  entry:      string;   // DEAL_ENTRY_IN | DEAL_ENTRY_OUT
  symbol:     string;
  volume:     number;
  price:      number;
  profit:     number;
  time:       string;
  positionId: string;
  comment?:   string;
}

export interface JournalTrade {
  accountId:       string;
  platform:        string;
  positionId:      string;
  symbol:          string;
  direction:       string;   // "buy" | "sell"
  volume:          number;
  entryPrice:      number;
  exitPrice:       number;
  entryTime:       string;
  exitTime:        string;
  grossProfit:     number;
  swap:            number;
  commission:      number;
  netProfit:       number;
  durationMinutes: number;
  comment?:        string;
}

export interface AccountConfig {
  id:        string;
  platform:  string;
  enabled:   boolean;
  lot:       number;
  connected?: boolean;
}

export interface ManualTradeRequest {
  action:    string;
  symbol:    string;
  lot?:      number;
  sl?:       number;
  tp?:       number;
  slPips?:   number;
  tpPips?:   number;
  comment?:  string;
  accounts?: string[];
}

export interface TradeResponse {
  action:          string;
  symbol:          string;
  executionTimeMs: number;
  accountsSuccess: number;
  accountsFailed:  number;
}

export interface StatusResponse {
  total:     number;
  connected: number;
  failed:    number;
  accounts:  AccountStatus[];
}

export interface PositionsResponse {
  count:     number;
  positions: OpenPosition[];
}

export interface JournalResponse {
  totalTrades:        number;
  winCount:           number;
  lossCount:          number;
  breakEven:          number;
  winRate:            number;
  totalNet:           number;
  grossProfit:        number;
  grossLoss:          number;
  profitFactor:       number;
  avgWin:             number;
  avgLoss:            number;
  bestTrade:          number;
  worstTrade:         number;
  maxDrawdown:        number;
  avgDurationMinutes: number;
  trades:             JournalTrade[];
}

// ─── API client ──────────────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const base = await getBaseUrl();
  const res  = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  getStatus: () =>
    request<StatusResponse>('/api/status'),

  getPositions: () =>
    request<PositionsResponse>('/api/positions'),

  getAccounts: () =>
    request<AccountConfig[]>('/api/accounts'),

  getJournal: (from?: string, to?: string, accountId?: string) => {
    const params = new URLSearchParams();
    if (from)      params.set('from', from);
    if (to)        params.set('to', to);
    if (accountId) params.set('accountId', accountId);
    const qs = params.toString();
    return request<JournalResponse>(`/api/journal${qs ? `?${qs}` : ''}`);
  },

  health: () =>
    request<{ status: string; version: string }>('/api/health'),

  trade: (req: ManualTradeRequest) =>
    request<TradeResponse>('/api/trade', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  closeAll: () =>
    request<{ action: string; success: number; failed: number }>('/api/close_all', {
      method: 'POST',
    }),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatCurrency(value: number, decimals = 2): string {
  const abs    = Math.abs(value);
  const prefix = value < 0 ? '-$' : '$';
  return prefix + abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPnl(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatCurrency(value)}`;
}

export function pnlColor(value: number): string {
  if (value > 0) return '#22c55e';
  if (value < 0) return '#ef4444';
  return '#6b7280';
}
