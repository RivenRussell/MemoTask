export const memoTaskQueryKeys = {
  auth: {
    all: ["auth"] as const,
    me: ["auth", "me"] as const
  },
  memos: {
    all: (userId: string) => ["users", userId, "memos"] as const,
    list: (userId: string) => ["users", userId, "memos", "list"] as const,
    detail: (userId: string, memoId: string) => ["users", userId, "memos", "detail", memoId] as const
  },
  drafts: {
    all: (userId: string) => ["users", userId, "drafts"] as const,
    recent: (userId: string) => ["users", userId, "drafts", "recent"] as const
  },
  history: {
    all: (userId: string) => ["users", userId, "history"] as const,
    list: (userId: string, query: string) => ["users", userId, "history", "list", query] as const
  },
  settings: {
    all: (userId: string) => ["users", userId, "settings"] as const,
    ai: (userId: string) => ["users", userId, "settings", "ai"] as const,
    sync: (userId: string) => ["users", userId, "settings", "sync"] as const
  }
};
