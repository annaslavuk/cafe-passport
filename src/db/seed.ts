import { db } from './db';
import type { Shop, Run, Quest } from './types';

const SEED_SHOPS: Omit<Shop, 'id'>[] = [
  {
    name: 'The Daily Grind',
    neighborhood: 'Downtown',
    accentColor: '#C27D38',
    emoji: '☕',
    firstVisitedAt: new Date('2024-01-15'),
    visitCount: 12,
    tier: 'gold',
    avgRatings: { coffee: 4.5, vibe: 4.2, comfort: 3.8, wifi: 4.0, outlets: 3.5, quietness: 3.2 },
    notes: 'Great espresso, gets busy midday. Best window seat on the left.',
    goodFor: ['working', 'casual-reading'],
  },
  {
    name: 'Foggy Bean',
    neighborhood: 'Arts District',
    accentColor: '#708090',
    emoji: '🌫️',
    firstVisitedAt: new Date('2024-02-20'),
    visitCount: 7,
    tier: 'silver',
    avgRatings: { coffee: 4.8, vibe: 4.9, comfort: 4.2, wifi: 3.5, outlets: 2.8, quietness: 4.5 },
    notes: 'The pour-over is transcendent. Very artsy crowd.',
    goodFor: ['casual-reading', 'writing', 'dates'],
  },
  {
    name: 'Watershed Coffee',
    neighborhood: 'Riverside',
    accentColor: '#6B8E23',
    emoji: '🌿',
    firstVisitedAt: new Date('2024-03-01'),
    visitCount: 3,
    tier: 'bronze',
    avgRatings: { coffee: 4.0, vibe: 4.5, comfort: 4.8, wifi: 4.5, outlets: 4.2, quietness: 4.0 },
    notes: 'Super productive. Huge tables, fast wifi.',
    goodFor: ['deep-work', 'meetings', 'studying'],
  },
  {
    name: 'Cozy Corner',
    neighborhood: 'Midtown',
    accentColor: '#CD853F',
    emoji: '🏡',
    firstVisitedAt: new Date('2024-03-10'),
    visitCount: 1,
    tier: 'bronze',
    avgRatings: { coffee: 3.8, vibe: 4.6, comfort: 4.9, wifi: 3.8, outlets: 3.0, quietness: 4.8 },
    notes: 'Perfect for reading. Warm and very quiet.',
    goodFor: ['casual-reading', 'writing'],
  },
  {
    name: 'High Roast',
    neighborhood: 'Uptown',
    accentColor: '#8B4513',
    emoji: '🌄',
    firstVisitedAt: new Date('2024-04-02'),
    visitCount: 22,
    tier: 'regular',
    avgRatings: { coffee: 4.9, vibe: 4.3, comfort: 4.0, wifi: 3.2, outlets: 2.5, quietness: 3.8 },
    notes: 'My home base. The baristas know my order.',
    goodFor: ['deep-work', 'casual-reading', 'writing'],
  },
  {
    name: 'Perch & Press',
    neighborhood: 'West End',
    accentColor: '#9370DB',
    emoji: '🦜',
    firstVisitedAt: new Date('2024-04-10'),
    visitCount: 2,
    tier: 'bronze',
    avgRatings: { coffee: 4.2, vibe: 4.7, comfort: 4.4, wifi: 4.0, outlets: 3.5, quietness: 4.2 },
    notes: 'Cool vibe, great natural light upstairs.',
    goodFor: ['casual-reading', 'dates'],
  },
];

const SEED_RUNS: Omit<Run, 'id'>[] = [
  {
    shopId: 1,
    date: new Date('2024-04-01'),
    startTime: '09:00',
    durationMinutes: 120,
    activities: ['working', 'reading'],
    drinkOrdered: 'Double espresso',
    ratings: { coffee: 5, vibe: 4, comfort: 4, wifi: 4, outlets: 4, quietness: 3 },
    sessionQuest: 'Finish the project proposal',
    sessionQuestDone: true,
    pomodorosCompleted: 4,
    notes: 'Super productive morning!',
  },
  {
    shopId: 1,
    date: new Date('2024-04-05'),
    startTime: '14:00',
    durationMinutes: 90,
    activities: ['working'],
    drinkOrdered: 'Cappuccino',
    ratings: { coffee: 4, vibe: 4, comfort: 4, wifi: 4, outlets: 3, quietness: 3 },
    sessionQuestDone: false,
    pomodorosCompleted: 3,
  },
  {
    shopId: 2,
    date: new Date('2024-04-08'),
    startTime: '10:00',
    durationMinutes: 70,
    activities: ['writing', 'vibing'],
    drinkOrdered: 'Oat milk pour-over',
    ratings: { coffee: 5, vibe: 5, comfort: 4, wifi: 3, outlets: 3, quietness: 5 },
    sessionQuest: 'Write 1000 words',
    sessionQuestDone: true,
    pomodorosCompleted: 2,
    notes: 'The pour-over was stunning.',
  },
  {
    shopId: 3,
    date: new Date('2024-04-10'),
    startTime: '08:30',
    durationMinutes: 180,
    activities: ['studying', 'working'],
    drinkOrdered: 'Cold brew',
    ratings: { coffee: 4, vibe: 4, comfort: 5, wifi: 5, outlets: 5, quietness: 4 },
    sessionQuest: 'Review chapters 3–5',
    sessionQuestDone: false,
    pomodorosCompleted: 5,
  },
  {
    shopId: 5,
    date: new Date('2024-04-12'),
    startTime: '07:45',
    durationMinutes: 60,
    activities: ['working'],
    drinkOrdered: 'Flat white',
    ratings: { coffee: 5, vibe: 4, comfort: 4, wifi: 3, outlets: 2, quietness: 4 },
    sessionQuestDone: false,
    pomodorosCompleted: 2,
  },
];

const SEED_QUESTS: Omit<Quest, 'id'>[] = [
  {
    title: 'Stamp Collector',
    description: 'Visit 10 new shops for the first time',
    type: 'campaign',
    kind: 'visits',
    target: 10,
    progress: 6,
    status: 'active',
    createdAt: new Date('2024-01-01'),
  },
  {
    title: 'Flavor Explorer',
    description: 'Try a new drink at 5 different shops',
    type: 'campaign',
    kind: 'custom',
    target: 5,
    progress: 3,
    status: 'active',
    createdAt: new Date('2024-01-01'),
  },
  {
    title: 'Focus Master',
    description: 'Log 20 hours across café sessions',
    type: 'campaign',
    kind: 'hours',
    target: 1200,
    progress: 430,
    status: 'active',
    createdAt: new Date('2024-01-01'),
  },
  {
    title: 'Century Run',
    description: 'Log 100 café runs total',
    type: 'campaign',
    kind: 'runs',
    target: 100,
    progress: 5,
    status: 'active',
    createdAt: new Date('2024-01-01'),
  },
];

export async function hasSeedData(): Promise<boolean> {
  return (await db.shops.count()) > 0;
}

export async function seedDemoData(): Promise<void> {
  await db.transaction('rw', db.shops, db.runs, db.quests, async () => {
    await db.shops.clear();
    await db.runs.clear();
    await db.quests.clear();
    await db.shops.bulkAdd(SEED_SHOPS);
    await db.runs.bulkAdd(SEED_RUNS);
    await db.quests.bulkAdd(SEED_QUESTS);
  });
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.shops, db.runs, db.quests, db.settings, async () => {
    await db.shops.clear();
    await db.runs.clear();
    await db.quests.clear();
  });
}
