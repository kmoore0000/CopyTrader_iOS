import { XMLParser } from 'fast-xml-parser';

export interface NewsItem {
  id:          string;
  title:       string;
  description: string;
  link:        string;
  pubDate:     Date;
  source:      string;
  tags:        string[];
}

// ─── RSS sources ─────────────────────────────────────────────────────────────
// Forex Factory economic calendar (community-maintained mirror)
// FXStreet and Kitco for symbol-specific news

const FEEDS: { url: string; source: string; tags: string[] }[] = [
  {
    url:    'https://www.forexlive.com/feed/news',
    source: 'ForexLive',
    tags:   ['FOREX', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD'],
  },
  {
    url:    'https://www.kitco.com/rss/ListArtNight.xml',
    source: 'Kitco',
    tags:   ['XAUUSD', 'GOLD', 'SILVER', 'XAGUSD'],
  },
  {
    url:    'https://www.fxstreet.com/rss/news',
    source: 'FXStreet',
    tags:   ['FOREX', 'EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY'],
  },
  {
    url:    'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC%3DF&region=US&lang=en-US',
    source: 'Yahoo Finance',
    tags:   ['XAUUSD', 'GOLD'],
  },
];

// Symbol → relevant tags to score relevance
const SYMBOL_TAGS: Record<string, string[]> = {
  XAUUSD: ['gold', 'xauusd', 'precious metal', 'bullion', 'fed', 'inflation', 'dollar'],
  EURUSD: ['euro', 'eurusd', 'ecb', 'europe', 'eurozone'],
  GBPUSD: ['pound', 'gbpusd', 'boe', 'bank of england', 'uk', 'britain'],
  USDJPY: ['yen', 'usdjpy', 'boj', 'japan', 'japanese'],
  US30:   ['dow', 'djia', 'wall street', 'stocks', 'equities'],
  NAS100: ['nasdaq', 'tech', 'technology', 'stocks'],
  BTCUSD: ['bitcoin', 'btc', 'crypto', 'cryptocurrency'],
};

const parser = new XMLParser({
  ignoreAttributes:   false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['item', 'entry'].includes(name),
});

async function fetchFeed(url: string, source: string, feedTags: string[]): Promise<NewsItem[]> {
  try {
    const res  = await fetch(url, { headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
    const text = await res.text();
    const xml  = parser.parse(text);

    // Handle both RSS 2.0 and Atom feeds
    const items: any[] =
      xml?.rss?.channel?.item ??
      xml?.feed?.entry ??
      [];

    return items.slice(0, 30).map((item: any, idx: number) => {
      const title       = item.title?.['#text'] ?? item.title ?? '';
      const description = item.description ?? item.summary?.['#text'] ?? item.summary ?? '';
      const link        = item.link?.['@_href'] ?? item.link ?? '';
      const rawDate     = item.pubDate ?? item.published ?? item.updated ?? '';
      const pubDate     = rawDate ? new Date(rawDate) : new Date();

      return {
        id:          `${source}-${idx}-${pubDate.getTime()}`,
        title:       stripHtml(title).trim(),
        description: stripHtml(description).trim().slice(0, 200),
        link,
        pubDate,
        source,
        tags:        feedTags,
      } satisfies NewsItem;
    });
  } catch (err) {
    console.warn(`[news] Failed to fetch ${url}:`, err);
    return [];
  }
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
}

/** Fetch news from all feeds, optionally filtered by active symbols. */
export async function fetchNews(symbols: string[] = []): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    FEEDS.map(f => fetchFeed(f.url, f.source, f.tags))
  );

  let items: NewsItem[] = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  // Score and sort by relevance if symbols selected
  if (symbols.length > 0) {
    const keywords = symbols.flatMap(s => SYMBOL_TAGS[s.toUpperCase()] ?? [s.toLowerCase()]);

    items = items
      .map(item => ({
        item,
        score: scoreRelevance(item, keywords),
      }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.item.pubDate.getTime() - a.item.pubDate.getTime();
      })
      .map(({ item }) => item);
  } else {
    // No filter — just sort by date
    items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  }

  // Deduplicate by title similarity
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreRelevance(item: NewsItem, keywords: string[]): number {
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (haystack.includes(kw)) score++;
  }
  return score;
}

export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60)  return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
