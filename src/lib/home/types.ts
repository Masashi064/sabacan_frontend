export type HomeSearchParams = {
  q?: string;
  sort?: "published_date" | "created_at";
  order?: "asc" | "desc";
  channel?: string;
  category?: string;
  level?: string;
  completion?: "all" | "complete" | "incomplete";
};

export type CategoryRow = {
  slug: string;
  video_id: string | null;
  assigned_category: string | null;
  assigned_level: string | null;
  published_date: string | null;
  created_at: string | null;
  thumbnail_url: string | null;
  channel_name: string | null;
  video_title: string | null;
  video_length: string | null;
  // Attached client-side (not a real categories column) when the
  // current user has a completed quiz_attempts row for this slug.
  is_completed?: boolean;
};

export type HomeData = {
  channelOptions: string[];
  categoryOptions: string[];
  levelOptions: string[];
  rows: CategoryRow[];
  hasMore: boolean;
  totalCount: number;
  fetchError: string | null;
};
