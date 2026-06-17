import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import PageShell from '../components/layout/PageShell';
import { db } from '../db/db';
import type { NavFn } from '../App';
import type { Shop } from '../db/types';
import { ACTIVITY_OPTIONS } from '../db/types';

interface Props { navigate: NavFn; }

// ── Data ───────────────────────────────────────────────────────────────────

interface StatsData {
  totalRuns:         number;
  stampCount:        number;
  totalMinutes:      number;
  totalPomodoros:    number;
  avgSessionMinutes: number;
  streak:            number;
  longestStreak:     number;
  last14:            number[];
  dayLabels:         string[];
  topShops:          Shop[];
  actBreakdown:      { id: string; label: string; emoji: string; count: number }[];
}

function toDateStr(d: Date): string { return new Date(d).toISOString().slice(0, 10); }

function computeStreak(dateSet: Set<string>, todayStr: string): number {
  let n = 0;
  const cur = new Date(todayStr);
  while (dateSet.has(cur.toISOString().slice(0, 10))) { n++; cur.setDate(cur.getDate() - 1); }
  return n;
}

function computeLongestStreak(allDates: string[]): number {
  const sorted = [...new Set(allDates)].sort();
  if (!sorted.length) return 0;
  let max = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86_400_000;
    cur = diff === 1 ? cur + 1 : 1;
    if (cur > max) max = cur;
  }
  return max;
}

async function loadStats(): Promise<StatsData> {
  const [runs, stampCount, topShops] = await Promise.all([
    db.runs.toArray(),
    db.shops.count(),
    db.shops.where('visitCount').above(0).toArray()
      .then(s => s.sort((a, b) => b.visitCount - a.visitCount).slice(0, 5)),
  ]);

  const today   = new Date();
  const todayMs = today.getTime();

  const totalMinutes   = runs.reduce((s, r) => s + r.durationMinutes, 0);
  const totalPomodoros = runs.reduce((s, r) => s + r.pomodorosCompleted, 0);
  const avgSession     = runs.length > 0 ? Math.round(totalMinutes / runs.length) : 0;

  const dateSet = new Set(runs.map(r => toDateStr(new Date(r.date))));
  const streak  = computeStreak(dateSet, toDateStr(today));
  const longestStreak = computeLongestStreak([...dateSet]);

  const last14: number[] = Array(14).fill(0);
  const dayLabels: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    dayLabels[13 - i] = 'SMTWTFS'[d.getDay()];
  }
  runs.forEach(r => {
    const diff = Math.floor((todayMs - new Date(r.date).getTime()) / 86_400_000);
    if (diff >= 0 && diff < 14) last14[13 - diff]++;
  });

  const actCounts: Record<string, number> = {};
  runs.forEach(r => r.activities.forEach(a => { actCounts[a] = (actCounts[a] ?? 0) + 1; }));
  const actBreakdown = ACTIVITY_OPTIONS
    .map(o => ({ ...o, count: actCounts[o.id] ?? 0 }))
    .filter(o => o.count > 0)
    .sort((a, b) => b.count - a.count);

  return { totalRuns: runs.length, stampCount, totalMinutes, totalPomodoros,
    avgSessionMinutes: avgSession, streak, longestStreak,
    last14, dayLabels, topShops, actBreakdown };
}

// ── Canvas share card ──────────────────────────────────────────────────────

type Corners = number | { tl: number; tr: number; br: number; bl: number };

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: Corners) {
  const R = typeof r === 'number' ? { tl: r, tr: r, br: r, bl: r } : r;
  ctx.beginPath();
  ctx.moveTo(x + R.tl, y);
  ctx.lineTo(x + w - R.tr, y);
  ctx.arcTo(x + w, y,     x + w, y + R.tr, R.tr);
  ctx.lineTo(x + w, y + h - R.br);
  ctx.arcTo(x + w, y + h, x + w - R.br, y + h, R.br);
  ctx.lineTo(x + R.bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - R.bl, R.bl);
  ctx.lineTo(x, y + R.tl);
  ctx.arcTo(x, y, x + R.tl, y, R.tl);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

async function generateShareCard(data: StatsData): Promise<Blob> {
  await document.fonts.ready;

  const W = 375, H = 500;
  const CORNER = 20, PAD = 24, HEADER_H = 98;
  const ESPRESSO = '#2C1A0E';
  const CREAM    = '#FDF6E9';
  const AMBER    = '#C27D38';
  const TAN      = '#E8D5B0';
  const MUTED    = '#A0845C';

  const dpr = Math.min(window.devicePixelRatio ?? 2, 3);
  const canvas = document.createElement('canvas');
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // ── Card background ──
  ctx.fillStyle = CREAM;
  rrect(ctx, 0, 0, W, H, CORNER);
  ctx.fill();

  // ── Decorative faint coffee ring ──
  ctx.save();
  ctx.strokeStyle = 'rgba(194,125,56,0.08)';
  ctx.lineWidth = 16;
  ctx.beginPath(); ctx.arc(W - 52, 285, 136, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(W - 52, 285, 112, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  // ── Header strip ──
  ctx.fillStyle = ESPRESSO;
  rrect(ctx, 0, 0, W, HEADER_H, { tl: CORNER, tr: CORNER, bl: 0, br: 0 });
  ctx.fill();

  // Year — faint top-right
  ctx.fillStyle = 'rgba(253,246,233,0.25)';
  ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.font = '400 11px "Inter", system-ui, sans-serif';
  ctx.fillText(String(new Date().getFullYear()), W - PAD, 16);

  // Title
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '700 26px "Playfair Display", Georgia, serif';
  ctx.fillText('☕  Café Passport', PAD, 44);

  // Subtitle
  ctx.fillStyle = AMBER;
  ctx.font = '400 13px "Inter", system-ui, sans-serif';
  ctx.fillText('My Coffee Journey', PAD, 72);

  // ── Grid layout ──
  const GRID_TOP = HEADER_H;
  const GRID_BOT = H - 52;
  const ROW_H    = (GRID_BOT - GRID_TOP) / 3;
  const MID_X    = W / 2;
  const COL_CX   = [W / 4, (3 * W) / 4];
  const CELL_MAX = MID_X - PAD - 8; // max text width in a cell

  // Grid dividers
  ctx.strokeStyle = TAN; ctx.lineWidth = 1;
  for (let r = 1; r <= 2; r++) {
    const dy = GRID_TOP + r * ROW_H;
    ctx.beginPath(); ctx.moveTo(PAD, dy); ctx.lineTo(W - PAD, dy); ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(MID_X, GRID_TOP + 14); ctx.lineTo(MID_X, GRID_BOT - 14); ctx.stroke();

  // ── Stat cells ──
  const hours = Math.floor(data.totalMinutes / 60);
  const mins  = data.totalMinutes % 60;

  const favShop  = data.topShops[0];
  const topAct   = data.actBreakdown[0];

  const cells = [
    { emoji: '📍', value: String(data.stampCount),             label: 'stamps collected' },
    { emoji: '⏱️', value: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`, label: 'time logged' },
    { emoji: '🔥', value: `${data.streak} day${data.streak !== 1 ? 's' : ''}`, label: 'current streak' },
    { emoji: favShop?.emoji ?? '☕', value: favShop?.name ?? '—', label: 'favorite spot' },
    { emoji: '🍅', value: String(data.totalPomodoros),          label: 'pomodoros' },
    { emoji: topAct?.emoji ?? '✨', value: topAct?.label ?? '—', label: 'top activity' },
  ];

  cells.forEach(({ emoji, value, label }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx  = COL_CX[col];
    const cy  = GRID_TOP + row * ROW_H + ROW_H / 2;

    // Emoji
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '22px sans-serif';
    ctx.fillText(emoji, cx, cy - 26);

    // Value — Playfair for numbers, Inter for text
    const looksNumeric = /^\d/.test(value) || value === '—';
    if (looksNumeric) {
      ctx.fillStyle = ESPRESSO;
      ctx.font = '700 21px "Playfair Display", Georgia, serif';
    } else {
      ctx.fillStyle = ESPRESSO;
      ctx.font = '600 12px "Inter", system-ui, sans-serif';
    }
    const displayVal = fitText(ctx, value, CELL_MAX);
    ctx.fillText(displayVal, cx, cy + 4);

    // Label
    ctx.fillStyle = MUTED;
    ctx.font = '400 10.5px "Inter", system-ui, sans-serif';
    ctx.fillText(label, cx, cy + 22);
  });

  // ── Footer ──
  ctx.strokeStyle = TAN; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, GRID_BOT); ctx.lineTo(W - PAD, GRID_BOT); ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '400 11px "Inter", system-ui, sans-serif';
  ctx.fillText('Café Passport  ·  caffeinated by you ☕', W / 2, H - 26);

  // ── Card border ──
  ctx.strokeStyle = TAN; ctx.lineWidth = 1;
  rrect(ctx, 0.5, 0.5, W - 1, H - 1, CORNER);
  ctx.stroke();

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png')
  );
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function StatsPage({ navigate: _navigate }: Props) {
  const [data,    setData]    = useState<StatsData | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => { loadStats().then(setData); }, []);

  const hours = data ? Math.floor(data.totalMinutes / 60) : 0;
  const mins  = data ? data.totalMinutes % 60             : 0;

  const handleShare = async () => {
    if (!data || sharing) return;
    setSharing(true);
    let blob: Blob | null = null;
    try {
      blob = await generateShareCard(data);
      const file = new File([blob], 'my-cafe-passport.png', { type: 'image/png' });

      const canFileShare =
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

      if (canFileShare) {
        await navigator.share({
          files: [file],
          title: 'My Café Passport',
          text: `${data.stampCount} café stamps · ${hours}h logged · ${data.streak}-day streak ☕`,
        });
      } else {
        downloadBlob(blob, 'my-cafe-passport.png');
      }
    } catch (err: unknown) {
      // AbortError = user dismissed the share sheet — that's fine
      if (err instanceof Error && err.name !== 'AbortError' && blob) {
        downloadBlob(blob, 'my-cafe-passport.png');
      }
    } finally {
      setSharing(false);
    }
  };

  const shareBtn = (
    <button
      onClick={handleShare}
      disabled={!data || sharing}
      style={{
        background: sharing ? '#A0845C' : '#C27D38',
        color: '#FDF6E9', border: 'none', borderRadius: 999,
        padding: '7px 14px', cursor: data && !sharing ? 'pointer' : 'default',
        fontSize: '0.82rem', fontWeight: 700,
        fontFamily: '"Inter", system-ui, sans-serif',
        opacity: !data ? 0.5 : 1,
        transition: 'background 0.15s, opacity 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {sharing ? 'Generating…' : '↑ Share'}
    </button>
  );

  return (
    <PageShell title="Stats" subtitle="Your coffee journey" headerRight={shareBtn}>
      {!data ? (
        <div className="placeholder-page"><div className="placeholder-icon">📊</div></div>
      ) : data.totalRuns === 0 ? (
        <EmptyStats />
      ) : (
        <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatCard emoji="📍" label="Stamps"      value={String(data.stampCount)} />
            <StatCard emoji="☕" label="Runs"        value={String(data.totalRuns)} />
            <StatCard emoji="⏱️" label="Time logged" value={`${hours}h ${mins}m`} />
            <StatCard emoji="🍅" label="Pomodoros"   value={String(data.totalPomodoros)} />
          </div>

          <StreakCard streak={data.streak} longest={data.longestStreak} />

          <Section title="Last 14 days">
            <BarChart values={data.last14} labels={data.dayLabels} />
          </Section>

          {data.topShops.length > 0 && (
            <Section title="Top spots">
              {data.topShops.map((shop, i) => (
                <ShopRow key={shop.id} shop={shop} rank={i + 1} max={data.topShops[0].visitCount} />
              ))}
            </Section>
          )}

          {data.actBreakdown.length > 0 && (
            <Section title="What you do">
              {data.actBreakdown.map(a => (
                <ActivityRow key={a.id} label={a.label} emoji={a.emoji}
                  count={a.count} max={data.actBreakdown[0].count} />
              ))}
            </Section>
          )}

          <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#A0845C', paddingBottom: 4 }}>
            Average session · {data.avgSessionMinutes} min
          </div>

        </div>
      )}
    </PageShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function EmptyStats() {
  return (
    <div className="placeholder-page">
      <div className="placeholder-icon">📊</div>
      <p className="placeholder-title">No data yet</p>
      <p className="placeholder-body">Log a run to start building your stats.</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 1, background: '#E8D5B0' }} />
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#C27D38',
          letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {title}
        </span>
        <div style={{ flex: 1, height: 1, background: '#E8D5B0' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <motion.div className="card" style={{ textAlign: 'center', padding: '16px 10px' }}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div style={{ fontSize: '1.5rem' }}>{emoji}</div>
      <div style={{ fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: '1.65rem', fontWeight: 700, color: '#2C1A0E', lineHeight: 1.1, marginTop: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.68rem', color: '#C27D38', fontWeight: 700,
        marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
    </motion.div>
  );
}

function StreakCard({ streak, longest }: { streak: number; longest: number }) {
  return (
    <motion.div className="card" style={{ display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '14px 18px',
      background: streak > 0 ? '#FFF8EE' : undefined }}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '1.8rem' }}>{streak > 0 ? '🔥' : '💤'}</span>
        <div>
          <div style={{ fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: '1.5rem', fontWeight: 700, color: '#2C1A0E', lineHeight: 1 }}>
            {streak}-day streak
          </div>
          <div style={{ fontSize: '0.72rem', color: '#A0845C', marginTop: 2 }}>
            {streak > 0 ? 'Keep it going!' : 'Log a run to start one'}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#C27D38',
          fontFamily: '"Playfair Display", Georgia, serif' }}>{longest}</div>
        <div style={{ fontSize: '0.65rem', color: '#A0845C',
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>best</div>
      </div>
    </motion.div>
  );
}

function BarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70 }}>
        {values.map((v, i) => (
          <motion.div key={i} style={{ flex: 1, borderRadius: '3px 3px 0 0',
            background: v === 0 ? '#EDE3D4' : i === values.length - 1 ? '#6B3F1A' : '#C27D38',
            minHeight: 3 }}
            initial={{ height: 3 }}
            animate={{ height: v === 0 ? 3 : Math.max((v / max) * 70, 6) }}
            transition={{ duration: 0.5, delay: i * 0.03, ease: 'easeOut' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
        {labels.map((l, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.58rem',
            color: i === labels.length - 1 ? '#6B3F1A' : '#C27D38',
            fontWeight: i === labels.length - 1 ? 700 : 400 }}>{l}</div>
        ))}
      </div>
      {values[13] > 0 && (
        <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#6B3F1A',
          marginTop: 4, fontWeight: 600 }}>
          {values[13]} run{values[13] !== 1 ? 's' : ''} today
        </div>
      )}
    </div>
  );
}

function ShopRow({ shop, rank, max }: { shop: Shop; rank: number; max: number }) {
  return (
    <motion.div style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.06 }}>
      <div style={{ width: 20, textAlign: 'center', fontSize: '0.7rem',
        color: '#A0845C', fontWeight: 700, flexShrink: 0 }}>{rank}</div>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: shop.accentColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.9rem', flexShrink: 0 }}>{shop.emoji ?? '☕'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2C1A0E',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {shop.name}
        </div>
        <div style={{ height: 5, borderRadius: 3, background: '#E8D5B0', marginTop: 4 }}>
          <motion.div style={{ height: '100%', borderRadius: 3, background: shop.accentColor }}
            initial={{ width: 0 }}
            animate={{ width: `${(shop.visitCount / max) * 100}%` }}
            transition={{ duration: 0.6, delay: rank * 0.06 + 0.1, ease: 'easeOut' }} />
        </div>
      </div>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6B3F1A',
        flexShrink: 0, minWidth: 28, textAlign: 'right' }}>{shop.visitCount}</div>
    </motion.div>
  );
}

function ActivityRow({ label, emoji, count, max }: { label: string; emoji: string; count: number; max: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: '1rem', flexShrink: 0, width: 22, textAlign: 'center' }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.78rem', color: '#2C1A0E', fontWeight: 500 }}>{label}</span>
          <span style={{ fontSize: '0.75rem', color: '#6B3F1A', fontWeight: 700 }}>{count}</span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: '#E8D5B0' }}>
          <motion.div style={{ height: '100%', borderRadius: 3, background: '#C27D38' }}
            initial={{ width: 0 }}
            animate={{ width: `${(count / max) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }} />
        </div>
      </div>
    </div>
  );
}
