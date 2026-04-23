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
  positionId: string;
  accountId:  string;
  symbol:     string;
  type:       string;
  lots:       number;
  openPrice:  number;
  closePrice: number;
  openTime:   string;
  closeTime:  string;
  duration:   string;
  grossProfit:number;
  swap:       number;
  netProfit:  number;
  comment?:   string;
}

export interface AccountConfig {
  id:        string;
  platform:  string;
  enabled:   boolean;
  lot:       number;
  connected?: boolean;
}

export interface StatusResponse {
  total:     number;
  connected: number;
  failed:    number;
  accounts:  AccountStatus[];
}

export interface PositionsResponse {
  total:     number;
  positions: OpenPosition[];
}

export interface JournalResponse {
  accountId: string;
  from:      string;
  to:        string;
  trades:    JournalTrade[];
  summary: {
    totalTrades:     number;
    winningTrades:   number;
    losingTrades:    number;
    winRate:         number;
    grossProfit:     number;
    grossLoss:       number;
    netProfit:       number;
    avgWin:          number;
    avgLoss:         number;
    profitFactor:    number;
    expectancy:      number;
    largestWin:      number;
    largestLoss:     number;
  };
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

  getJournal: (accountId: string, from: string, to: string) =>
    request<JournalResponse>(
      `/api/journal/${encodeURIComponent(accountId)}?from=${from}&to=${to}`
    ),

  health: () =>
    request<{ status: string; version: string }>('/api/health'),
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
