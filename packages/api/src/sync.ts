export const SYNC_PROTOCOL_VERSION = 1;

export interface SyncCapabilities {
  protocolVersion: number;
  features: {
    articles: boolean;
    pull: boolean;
    push: boolean;
    softDelete: boolean;
  };
  maxPageSize: number;
}

export interface SyncArticle {
  id: number;
  alias: string | null;
  title: string | null;
  summary: string;
  content: string;
  listed: boolean;
  draft: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SyncPullResponse {
  items: SyncArticle[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SyncPushArticle {
  id?: number;
  alias?: string | null;
  title: string;
  summary?: string;
  content: string;
  listed?: boolean;
  draft?: boolean;
  tags?: string[];
  createdAt?: string;
}

export interface SyncPushResponse {
  items: SyncArticle[];
}
