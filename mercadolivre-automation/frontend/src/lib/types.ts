export interface AppSettings {
  ml: {
    site: string;
    minDiscountPercent: number;
    minPrice: number | null;
    maxPrice: number | null;
    affiliateMattWord: string;
    affiliateMattTool: string;
  };
  schedule: {
    enabled: boolean;
    cron: string;
    quietStart: string | null;
    quietEnd: string | null;
    maxProductsPerRun: number;
  };
  evolution: {
    baseUrl: string;
    apiKey: string;
    instance: string;
    groupJid: string;
    sendImage: boolean;
  };
  message: {
    template: string;
  };
}

export interface RunLog {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  items_found: number;
  items_sent: number;
  trigger: string;
  message: string | null;
}

export interface StatusResponse {
  enabled: boolean;
  nextRun: string | null;
  lastLog: RunLog | null;
  sentToday: number;
  totalSent: number;
  keywordsActive: number;
}

export interface Keyword {
  id: number;
  term: string;
  active: number;
  created_at: string;
}

export interface SentProduct {
  id: number;
  ml_item_id: string;
  title: string;
  price: number;
  original_price: number | null;
  discount_percent: number;
  permalink: string;
  affiliate_link: string;
  thumbnail: string;
  keyword: string;
  sent_at: string;
  status: string;
}
