// ── Shared rating dimensions ──────────────────────────────────────────────────
export interface RatingsSnapshot {
  coffee:    number; // 1–5
  vibe:      number;
  comfort:   number;
  wifi:      number;
  outlets:   number;
  quietness: number;
}

export const EMPTY_RATINGS: RatingsSnapshot = {
  coffee: 0, vibe: 0, comfort: 0, wifi: 0, outlets: 0, quietness: 0,
};

export const RATING_FIELDS: { key: keyof RatingsSnapshot; label: string; emoji: string }[] = [
  { key: 'coffee',    label: 'Coffee',    emoji: '☕' },
  { key: 'vibe',      label: 'Vibe',      emoji: '✨' },
  { key: 'comfort',   label: 'Comfort',   emoji: '🪑' },
  { key: 'wifi',      label: 'Wi-Fi',     emoji: '📶' },
  { key: 'outlets',   label: 'Outlets',   emoji: '🔌' },
  { key: 'quietness', label: 'Quietness', emoji: '🔇' },
];

// ── Shop ─────────────────────────────────────────────────────────────────────
export type ShopTier = 'bronze' | 'silver' | 'gold' | 'regular';

export type GoodForTag = 'deep-work' | 'casual-reading' | 'meetings' | 'dates' | 'writing' | string;

export interface Shop {
  id?:            number;
  name:           string;
  address?:       string;
  neighborhood?:  string;
  accentColor:    string;
  emoji?:         string;
  lat?:           number;
  lng?:           number;
  firstVisitedAt: Date;
  visitCount:     number;
  tier:           ShopTier;
  avgRatings:     RatingsSnapshot;
  notes?:         string;
  goodFor:        GoodForTag[];
}

export function computeTier(visitCount: number): ShopTier {
  if (visitCount >= 20) return 'regular';
  if (visitCount >= 10) return 'gold';
  if (visitCount >= 5)  return 'silver';
  return 'bronze';
}

export const TIER_META: Record<ShopTier, { label: string; color: string; minVisits: number; next?: number }> = {
  bronze:  { label: 'Bronze',  color: '#CD7F32', minVisits: 1,  next: 5  },
  silver:  { label: 'Silver',  color: '#A8A9AD', minVisits: 5,  next: 10 },
  gold:    { label: 'Gold',    color: '#D4AF37', minVisits: 10, next: 20 },
  regular: { label: 'Regular', color: '#E91E8C', minVisits: 20 },
};

export const GOOD_FOR_OPTIONS: { id: GoodForTag; label: string; emoji: string }[] = [
  { id: 'deep-work',      label: 'Deep Work',      emoji: '🧠' },
  { id: 'casual-reading', label: 'Casual Reading', emoji: '📖' },
  { id: 'meetings',       label: 'Meetings',       emoji: '🤝' },
  { id: 'dates',          label: 'Dates',          emoji: '💛' },
  { id: 'writing',        label: 'Writing',        emoji: '✍️' },
];

// ── Run ───────────────────────────────────────────────────────────────────────
export type ActivityType =
  | 'reading' | 'working' | 'drawing' | 'writing'
  | 'studying' | 'meeting' | 'vibing' | string;

export const ACTIVITY_OPTIONS: { id: ActivityType; label: string; emoji: string }[] = [
  { id: 'reading',  label: 'Reading',            emoji: '📖' },
  { id: 'working',  label: 'Working',            emoji: '💻' },
  { id: 'drawing',  label: 'Drawing / Sketching', emoji: '🎨' },
  { id: 'writing',  label: 'Writing / Journaling', emoji: '✍️' },
  { id: 'studying', label: 'Studying',            emoji: '📚' },
  { id: 'meeting',  label: 'Meeting',             emoji: '🤝' },
  { id: 'vibing',   label: 'Just vibing',         emoji: '☁️' },
];

export interface Run {
  id?:               number;
  shopId:            number;
  date:              Date;
  startTime:         string; // "HH:MM"
  durationMinutes:   number;
  activities:        ActivityType[];
  drinkOrdered?:     string;
  ratings:           RatingsSnapshot;
  sessionQuest?:     string;
  sessionQuestDone:  boolean;
  pomodorosCompleted: number;
  notes?:            string;
}

// ── Quest ─────────────────────────────────────────────────────────────────────
export type QuestType   = 'session' | 'campaign';
export type QuestStatus = 'active' | 'completed';
export type QuestKind   = 'visits' | 'runs' | 'hours' | 'pomodoros' | 'custom';

export const QUEST_KIND_META: Record<QuestKind, { label: string; emoji: string }> = {
  visits:    { label: 'New shops',  emoji: '📍' },
  runs:      { label: 'Total runs', emoji: '☕' },
  hours:     { label: 'Time spent', emoji: '⏱️' },
  pomodoros: { label: 'Pomodoros',  emoji: '🍅' },
  custom:    { label: 'Custom',     emoji: '⚔️' },
};

export interface Quest {
  id?:          number;
  title:        string;
  description?: string;
  type:         QuestType;
  kind?:        QuestKind;
  target?:      number;
  progress:     number;
  status:       QuestStatus;
  shopId?:      number;
  createdAt:    Date;
  completedAt?: Date;
}

// ── Settings ──────────────────────────────────────────────────────────────────
export interface Settings {
  id?:               number;
  focusMinutes:      number;
  breakMinutes:      number;
  longBreakMinutes:  number;
  longBreakInterval: number;
  theme:             'warm' | 'dark';
  soundEnabled:      boolean;
}

export const DEFAULT_SETTINGS: Omit<Settings, 'id'> = {
  focusMinutes:      25,
  breakMinutes:      5,
  longBreakMinutes:  15,
  longBreakInterval: 4,
  theme:             'warm',
  soundEnabled:      true,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export function averageRatings(snapshots: RatingsSnapshot[]): RatingsSnapshot {
  if (snapshots.length === 0) return { ...EMPTY_RATINGS };
  const keys = Object.keys(EMPTY_RATINGS) as (keyof RatingsSnapshot)[];
  const sum = snapshots.reduce((acc, s) => {
    keys.forEach(k => { acc[k] = (acc[k] ?? 0) + s[k]; });
    return acc;
  }, { ...EMPTY_RATINGS });
  const result = { ...EMPTY_RATINGS };
  keys.forEach(k => { result[k] = parseFloat((sum[k] / snapshots.length).toFixed(1)); });
  return result;
}

export function overallRating(r: RatingsSnapshot): number {
  const vals = Object.values(r).filter(v => v > 0);
  if (vals.length === 0) return 0;
  return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
}
