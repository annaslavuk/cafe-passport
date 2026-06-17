import Dexie, { type Table } from 'dexie';
import type { Shop, Run, Quest, Settings, QuestKind } from './types';
import { DEFAULT_SETTINGS } from './types';

export class CafePassportDB extends Dexie {
  shops!:    Table<Shop,     number>;
  runs!:     Table<Run,      number>;
  quests!:   Table<Quest,    number>;
  settings!: Table<Settings, number>;

  constructor() {
    super('CafePassportDB');
    this.version(1).stores({
      shops:    '++id, name, visitCount, tier, firstVisitedAt',
      runs:     '++id, shopId, date',
      quests:   '++id, type, status, shopId, createdAt',
      settings: '++id',
    });
  }
}

export const db = new CafePassportDB();

export async function getSettings(): Promise<Settings> {
  let s = await db.settings.toCollection().first();
  if (!s) {
    const id = await db.settings.add({ ...DEFAULT_SETTINGS });
    s = await db.settings.get(id);
  }
  return s!;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const s = await getSettings();
  await db.settings.update(s.id!, patch);
}

/**
 * Auto-advance campaign quests after a run is saved.
 * Returns IDs of quests that just reached completion.
 */
export async function tickQuestProgress(
  run: { durationMinutes: number; pomodorosCompleted: number },
  isFirstVisit: boolean,
): Promise<number[]> {
  const active = await db.quests.where('status').equals('active').toArray();
  const campaigns = active.filter(q => q.type === 'campaign');
  const completedIds: number[] = [];
  const now = new Date();

  for (const quest of campaigns) {
    const kind: QuestKind = quest.kind ?? 'custom';
    let delta = 0;
    switch (kind) {
      case 'visits':    if (isFirstVisit) delta = 1; break;
      case 'runs':      delta = 1; break;
      case 'hours':     delta = run.durationMinutes; break;
      case 'pomodoros': delta = run.pomodorosCompleted; break;
      case 'custom':    break;
    }
    if (delta === 0) continue;

    const newProgress = quest.progress + delta;
    const isNowComplete = quest.target != null && newProgress >= quest.target;
    await db.quests.update(quest.id!, {
      progress: newProgress,
      ...(isNowComplete ? { status: 'completed' as const, completedAt: now } : {}),
    });
    if (isNowComplete) completedIds.push(quest.id!);
  }
  return completedIds;
}

/** Recompute a shop's avgRatings, visitCount, tier from all its runs. */
export async function refreshShopStats(shopId: number): Promise<void> {
  const runs = await db.runs.where('shopId').equals(shopId).toArray();
  if (runs.length === 0) return;

  const keys = ['coffee','vibe','comfort','wifi','outlets','quietness'] as const;
  const filled = runs.filter(r => r.ratings && keys.some(k => r.ratings[k] > 0));

  const avg = { coffee: 0, vibe: 0, comfort: 0, wifi: 0, outlets: 0, quietness: 0 };
  if (filled.length > 0) {
    keys.forEach(k => {
      avg[k] = parseFloat(
        (filled.reduce((sum, r) => sum + (r.ratings[k] ?? 0), 0) / filled.length).toFixed(1)
      );
    });
  }

  const visitCount = runs.length;
  const tier =
    visitCount >= 20 ? 'regular' :
    visitCount >= 10 ? 'gold' :
    visitCount >= 5  ? 'silver' : 'bronze';

  await db.shops.update(shopId, { visitCount, tier, avgRatings: avg });
}
