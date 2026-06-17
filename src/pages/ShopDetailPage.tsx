import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../db/db';
import type { Shop, Run } from '../db/types';
import { GOOD_FOR_OPTIONS, ACTIVITY_OPTIONS, overallRating } from '../db/types';
import RatingBars from '../components/ui/RatingBars';
import RadarChart from '../components/ui/RadarChart';
import TierBadge from '../components/ui/TierBadge';
import type { NavFn } from '../App';

interface Props {
  shopId: number;
  navigate: NavFn;
}

function fmt(d: Date) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
}
function fmtShort(d: Date) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(d));
}
function fmtDur(mins: number) {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

type ChartMode = 'radar' | 'bars';

export default function ShopDetailPage({ shopId, navigate }: Props) {
  const [shop, setShop]         = useState<Shop | null>(null);
  const [runs, setRuns]         = useState<Run[]>([]);
  const [chartMode, setChart]   = useState<ChartMode>('radar');

  useEffect(() => {
    db.shops.get(shopId).then(s => setShop(s ?? null));
    db.runs.where('shopId').equals(shopId).reverse().sortBy('date').then(setRuns);
  }, [shopId]);

  if (!shop) return (
    <div style={{ padding: 24, textAlign: 'center', color: '#C27D38' }}>Loading…</div>
  );

  const overall       = overallRating(shop.avgRatings);
  const textOnAccent  = lightBg(shop.accentColor) ? '#2C1A0E' : '#FDF6E9';
  const hasRatings    = Object.values(shop.avgRatings).some(v => v > 0);

  return (
    <div style={{ paddingBottom: 88 }}>

      {/* ── Hero ── */}
      <div style={{ background: shop.accentColor, padding: '16px 20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={() => navigate({ to: 'back' })} style={actionBtn(textOnAccent)}>
            ← Back
          </button>
          <button onClick={() => navigate({ to: 'edit-shop', shopId })} style={actionBtn(textOnAccent)}>
            Edit
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {shop.emoji && (
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              style={{ fontSize: '3rem', lineHeight: 1, flexShrink: 0 }}
            >
              {shop.emoji}
            </motion.div>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              margin: 0,
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: '1.5rem', fontWeight: 700, color: textOnAccent, lineHeight: 1.15,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {shop.name}
            </h1>
            {shop.neighborhood && (
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: textOnAccent, opacity: 0.75 }}>
                {shop.neighborhood}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <HeroChip color={textOnAccent}>
            {shop.visitCount} visit{shop.visitCount !== 1 ? 's' : ''}
          </HeroChip>
          {overall > 0 && (
            <HeroChip color={textOnAccent}>★ {overall} overall</HeroChip>
          )}
          <HeroChip color={textOnAccent}>
            Since {fmtShort(shop.firstVisitedAt)}
          </HeroChip>
        </div>

        <div style={{ marginTop: 14 }}>
          <TierBadge tier={shop.tier} visitCount={shop.visitCount} />
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Ratings with Radar / Bars toggle */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={sectionLabel}>Ratings</span>
            {hasRatings && (
              <div style={{ display: 'flex', gap: 4 }}>
                {(['radar', 'bars'] as ChartMode[]).map(mode => (
                  <button key={mode} onClick={() => setChart(mode)} style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem',
                    fontWeight: 700, border: 'none', cursor: 'pointer',
                    background: chartMode === mode ? '#6B3F1A' : '#E8D5B0',
                    color: chartMode === mode ? '#FDF6E9' : '#6B3F1A',
                    transition: 'background 0.15s',
                  }}>
                    {mode === 'radar' ? '⬡ Radar' : '≡ Bars'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={chartMode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {chartMode === 'radar' ? (
                <div style={{ maxWidth: 300, margin: '0 auto' }}>
                  <RadarChart ratings={shop.avgRatings} animate />
                </div>
              ) : (
                <RatingBars ratings={shop.avgRatings} animate />
              )}
            </motion.div>
          </AnimatePresence>

          {hasRatings && (
            <p style={{ margin: '10px 0 0', fontSize: '0.72rem', color: '#C27D38', textAlign: 'center' }}>
              Average across {runs.filter(r => Object.values(r.ratings).some(v => v > 0)).length} rated visit{runs.filter(r => Object.values(r.ratings).some(v => v > 0)).length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Good for */}
        {shop.goodFor.length > 0 && (
          <Section title="Good for">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {shop.goodFor.map(id => {
                const opt = GOOD_FOR_OPTIONS.find(o => o.id === id);
                return (
                  <span key={id} style={{
                    background: '#E8D5B0', color: '#6B3F1A',
                    borderRadius: 999, padding: '4px 11px',
                    fontSize: '0.78rem', fontWeight: 600,
                  }}>
                    {opt ? `${opt.emoji} ${opt.label}` : id}
                  </span>
                );
              })}
            </div>
          </Section>
        )}

        {/* Notes */}
        {shop.notes && (
          <Section title="Notes">
            <p style={{ margin: 0, fontSize: '0.87rem', color: '#2C1A0E', lineHeight: 1.55, fontStyle: 'italic' }}>
              "{shop.notes}"
            </p>
          </Section>
        )}

        {/* Visit history */}
        <Section title={`Visits (${runs.length})`}>
          {runs.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#C27D38', fontStyle: 'italic' }}>
              No visits yet. Log a run to get started!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {runs.map(run => <RunRow key={run.id} run={run} />)}
            </div>
          )}
        </Section>

      </div>

      {/* Fixed CTA */}
      <div style={{
        position: 'fixed', bottom: 52, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, padding: '10px 16px', zIndex: 20,
        background: 'linear-gradient(to top, #FDF6E9 75%, transparent)',
        pointerEvents: 'none',
      }}>
        <button
          className="btn-primary"
          style={{ width: '100%', pointerEvents: 'auto' }}
          onClick={() => navigate({ to: 'log-run', shopId })}
        >
          ☕ Log a run here
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div style={sectionLabel}>{title}</div>
      {children}
    </div>
  );
}

function HeroChip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      background: 'rgba(0,0,0,0.18)', color,
      borderRadius: 999, padding: '4px 10px',
      fontSize: '0.75rem', fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

function RunRow({ run }: { run: Run }) {
  const actLabels = run.activities.map(id => {
    const opt = ACTIVITY_OPTIONS.find(o => o.id === id);
    return opt ? `${opt.emoji} ${opt.label}` : id;
  });
  const runOverall = overallRating(run.ratings);

  return (
    <div style={{
      padding: '10px 12px', background: '#FDF6E9',
      borderRadius: 12, border: '1px solid #E8D5B0',
    }}>
      {/* Top row: date, duration, rating */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#2C1A0E' }}>
          {fmt(run.date)}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {runOverall > 0 && (
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, color: '#C27D38',
              background: '#F5EDD8', borderRadius: 999, padding: '1px 7px',
            }}>
              ★ {runOverall}
            </span>
          )}
          <span style={{ fontSize: '0.78rem', color: '#C27D38', fontWeight: 600 }}>
            {fmtDur(run.durationMinutes)}
          </span>
        </div>
      </div>

      {/* Activity chips */}
      {actLabels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {actLabels.map(a => (
            <span key={a} style={{
              background: '#E8D5B0', color: '#6B3F1A',
              borderRadius: 999, padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600,
            }}>{a}</span>
          ))}
        </div>
      )}

      {/* Details row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {run.drinkOrdered && (
          <span style={{ fontSize: '0.78rem', color: '#2C1A0E' }}>
            ☕ {run.drinkOrdered}
          </span>
        )}
        {run.pomodorosCompleted > 0 && (
          <span style={{ fontSize: '0.78rem', color: '#6B3F1A' }}>
            🍅 ×{run.pomodorosCompleted}
          </span>
        )}
        {run.sessionQuest && (
          <span style={{ fontSize: '0.78rem', color: run.sessionQuestDone ? '#6B8E23' : '#C27D38' }}>
            {run.sessionQuestDone ? '✅' : '⬜'} {run.sessionQuest}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: '#C27D38', marginBottom: 0,
};

function actionBtn(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'rgba(0,0,0,0.18)', border: 'none', borderRadius: 999,
    padding: '6px 14px', cursor: 'pointer', color,
    fontSize: '0.85rem', fontWeight: 600,
  };
}

function lightBg(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145;
}
