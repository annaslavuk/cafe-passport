import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db, refreshShopStats, tickQuestProgress } from '../db/db';
import type { Shop, RatingsSnapshot } from '../db/types';
import { ACTIVITY_OPTIONS, EMPTY_RATINGS, RATING_FIELDS } from '../db/types';
import StampUnlockAnimation from '../components/ui/StampUnlockAnimation';
import type { NavFn } from '../App';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const DURATION_PRESETS = [30, 45, 60, 90, 120, 180];

interface Props {
  navigate: NavFn;
  prefillShopId?: number;
  prefillPomodoros?: number;
  prefillDurationMinutes?: number;
  showBack?: boolean;
}

export default function LogRunPage({ navigate, prefillShopId, prefillPomodoros, prefillDurationMinutes, showBack }: Props) {
  const initDuration = () => {
    const d = prefillDurationMinutes;
    if (d == null) return 60;
    return DURATION_PRESETS.includes(d) ? d : 60;
  };
  const initCustomDur = () => {
    const d = prefillDurationMinutes;
    if (d == null) return '';
    return DURATION_PRESETS.includes(d) ? '' : String(d);
  };

  const [shops, setShops]         = useState<Shop[]>([]);
  const [shopId, setShopId]       = useState<number | null>(prefillShopId ?? null);
  const [shopSearch, setSearch]   = useState('');
  const [date, setDate]           = useState(todayStr);
  const [time, setTime]           = useState(nowTime);
  const [duration, setDuration]   = useState(initDuration);
  const [customDur, setCustomDur] = useState(initCustomDur);
  const [activities, setActs]     = useState<string[]>([]);
  const [drink, setDrink]         = useState('');
  const [ratings, setRatings]     = useState<RatingsSnapshot>({ ...EMPTY_RATINGS });
  const [pomodoros, setPomodoros] = useState(prefillPomodoros ?? 0);
  const [quest, setQuest]         = useState('');
  const [questDone, setQuestDone] = useState(false);
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [unlockShop, setUnlock]   = useState<Shop | null>(null);

  useEffect(() => {
    db.shops.orderBy('name').toArray().then(setShops);
  }, []);

  const refreshShops = () => db.shops.orderBy('name').toArray().then(setShops);

  const selectedShop = shops.find(s => s.id === shopId) ?? null;

  const filtered = shopSearch
    ? shops.filter(s => s.name.toLowerCase().includes(shopSearch.toLowerCase()))
    : shops;

  const showCreate =
    shopSearch.trim().length > 0 &&
    !filtered.find(s => s.name.toLowerCase() === shopSearch.trim().toLowerCase());

  const toggleAct = (id: string) =>
    setActs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const setRating = (key: keyof RatingsSnapshot, val: number) =>
    setRatings(prev => ({ ...prev, [key]: prev[key] === val ? 0 : val }));

  const handleCreateShop = async (name: string) => {
    const id = await db.shops.add({
      name: name.trim(),
      accentColor: '#C27D38',
      emoji: '☕',
      firstVisitedAt: new Date(date),
      visitCount: 0,
      tier: 'bronze',
      avgRatings: { ...EMPTY_RATINGS },
      goodFor: [],
    });
    await refreshShops();
    setShopId(id as number);
    setSearch('');
  };

  const handleSave = async () => {
    if (!shopId) { setError('Select a shop to continue'); return; }
    setSaving(true);
    setError('');

    const prevCount = await db.runs.where('shopId').equals(shopId).count();
    const isFirstRun = prevCount === 0;
    const dur = customDur ? (parseInt(customDur) || 60) : duration;

    if (isFirstRun) {
      await db.shops.update(shopId, { firstVisitedAt: new Date(date) });
    }

    await db.runs.add({
      shopId,
      date: new Date(date),
      startTime: time,
      durationMinutes: dur,
      activities,
      drinkOrdered: drink.trim() || undefined,
      ratings,
      sessionQuest: quest.trim() || undefined,
      sessionQuestDone: questDone,
      pomodorosCompleted: pomodoros,
      notes: notes.trim() || undefined,
    } as Parameters<typeof db.runs.add>[0]);

    await refreshShopStats(shopId);
    await tickQuestProgress({ durationMinutes: dur, pomodorosCompleted: pomodoros }, isFirstRun);

    const updatedShop = await db.shops.get(shopId);
    setSaving(false);

    if (isFirstRun && updatedShop) {
      setUnlock(updatedShop);
    } else {
      navigate({ to: 'shop-detail', shopId });
    }
  };

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {showBack ? (
            <button onClick={() => navigate({ to: 'back' })} style={backBtnStyle}>
              ← Back
            </button>
          ) : (
            <div style={{ width: 56 }} />
          )}
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.3rem' }}>Log a Run</h1>
          <div style={{ width: 56 }} />
        </div>
      </div>

      <div style={{ padding: '14px 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Shop ── */}
        <FormCard label="Where">
          {selectedShop ? (
            <SelectedShopChip shop={selectedShop} onClear={() => { setShopId(null); setSearch(''); }} />
          ) : (
            <>
              <input
                type="text"
                value={shopSearch}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search shops or type a new name…"
                style={inputFull}
                autoFocus={!prefillShopId}
              />
              <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filtered.map(shop => (
                  <button key={shop.id} onClick={() => { setShopId(shop.id!); setSearch(''); }} style={shopRowStyle}>
                    <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{shop.emoji ?? '☕'}</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#2C1A0E' }}>{shop.name}</div>
                      {shop.neighborhood && <div style={{ fontSize: '0.72rem', color: '#C27D38' }}>{shop.neighborhood}</div>}
                    </div>
                  </button>
                ))}
                {showCreate && (
                  <button onClick={() => handleCreateShop(shopSearch)} style={{ ...shopRowStyle, background: '#E8D5B0', border: '1.5px dashed #D4A96A' }}>
                    <span style={{ fontSize: '1.2rem' }}>✨</span>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#6B3F1A', textAlign: 'left' }}>
                      + Create "{shopSearch.trim()}"
                    </div>
                  </button>
                )}
                {filtered.length === 0 && !showCreate && (
                  <p style={{ textAlign: 'center', color: '#D4A96A', fontSize: '0.82rem', padding: '10px 0', margin: 0 }}>
                    No shops yet — type a name to create one
                  </p>
                )}
              </div>
            </>
          )}
          {error && <p style={{ margin: '6px 0 0', color: '#DC143C', fontSize: '0.78rem' }}>{error}</p>}
        </FormCard>

        {/* ── When ── */}
        <FormCard label="When & how long">
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputSm, flex: 1 }} />
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputSm, width: 88 }} />
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#C27D38', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
            Duration
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {DURATION_PRESETS.map(d => (
              <button key={d} onClick={() => { setDuration(d); setCustomDur(''); }} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: duration === d && !customDur ? '#6B3F1A' : '#E8D5B0',
                color: duration === d && !customDur ? '#FDF6E9' : '#6B3F1A',
                transition: 'background 0.12s',
              }}>
                {d >= 60 ? `${d / 60 % 1 === 0 ? d / 60 : (d / 60).toFixed(1)}h` : `${d}m`}
              </button>
            ))}
            <input
              type="number" placeholder="min" value={customDur}
              onChange={e => { setCustomDur(e.target.value); setDuration(0); }}
              style={{ ...inputSm, width: 68 }}
            />
          </div>
        </FormCard>

        {/* ── Activities ── */}
        <FormCard label="What you did">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {ACTIVITY_OPTIONS.map(a => {
              const on = activities.includes(a.id);
              return (
                <button key={a.id} onClick={() => toggleAct(a.id)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: on ? '#6B3F1A' : '#E8D5B0',
                  color: on ? '#FDF6E9' : '#6B3F1A',
                  border: 'none', borderRadius: 999, padding: '6px 13px',
                  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.12s, color 0.12s',
                }}>
                  {a.emoji} {a.label}
                </button>
              );
            })}
          </div>
        </FormCard>

        {/* ── Drink ── */}
        <FormCard label="What did you order">
          <input
            type="text" value={drink} onChange={e => setDrink(e.target.value)}
            placeholder="e.g. oat milk flat white"
            style={inputFull}
          />
        </FormCard>

        {/* ── Ratings ── */}
        <FormCard label="Rate it">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {RATING_FIELDS.map(f => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 22, textAlign: 'center', fontSize: '1rem', flexShrink: 0 }}>{f.emoji}</span>
                <span style={{ width: 68, fontSize: '0.76rem', color: '#6B3F1A', fontWeight: 600, flexShrink: 0 }}>{f.label}</span>
                <div style={{ display: 'flex', gap: 5, flex: 1 }}>
                  {[1, 2, 3, 4, 5].map(n => {
                    const active = ratings[f.key] >= n;
                    return (
                      <motion.button key={n} onClick={() => setRating(f.key, n)}
                        whileTap={{ scale: 0.85 }}
                        style={{
                          flex: 1, height: 30, borderRadius: 7, border: 'none',
                          background: active ? '#C27D38' : '#E8D5B0',
                          cursor: 'pointer',
                          fontSize: active ? '0.9rem' : '0.75rem',
                          transition: 'background 0.1s',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: active ? '#FDF6E9' : '#D4A96A',
                        }}>
                        {active ? '★' : '☆'}
                      </motion.button>
                    );
                  })}
                </div>
                <span style={{ width: 20, textAlign: 'right', fontSize: '0.78rem', fontWeight: 700, color: '#C27D38', flexShrink: 0 }}>
                  {ratings[f.key] > 0 ? ratings[f.key] : ''}
                </span>
              </div>
            ))}
          </div>
        </FormCard>

        {/* ── Pomodoros ── */}
        {(pomodoros > 0 || prefillPomodoros != null) && (
          <FormCard label="Pomodoros">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => setPomodoros(p => Math.max(0, p - 1))}
                style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: '#E8D5B0', color: '#6B3F1A', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>
                −
              </motion.button>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#2C1A0E', minWidth: 60, textAlign: 'center' }}>
                {pomodoros} 🍅
              </span>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => setPomodoros(p => p + 1)}
                style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: '#C27D38', color: '#FDF6E9', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>
                ＋
              </motion.button>
            </div>
          </FormCard>
        )}

        {/* ── Session Quest ── */}
        <FormCard label="Session quest">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text" value={quest} onChange={e => setQuest(e.target.value)}
              placeholder="e.g. finish chapter 3"
              style={{ ...inputFull, flex: 1 }}
            />
            <motion.button
              onClick={() => setQuestDone(d => !d)}
              whileTap={{ scale: 0.88 }}
              style={{
                flexShrink: 0, width: 44, height: 40, borderRadius: 10, border: 'none',
                background: questDone ? '#6B8E23' : '#E8D5B0',
                cursor: 'pointer', fontSize: '1.1rem',
                transition: 'background 0.15s',
              }}>
              {questDone ? '✅' : '⬜'}
            </motion.button>
          </div>
          {quest && (
            <p style={{ margin: '5px 0 0', fontSize: '0.72rem', color: questDone ? '#6B8E23' : '#C27D38' }}>
              {questDone ? '✓ Marked as done' : 'Tap ⬜ once you finish it'}
            </p>
          )}
        </FormCard>

        {/* ── Notes ── */}
        <FormCard label="Notes">
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Anything else worth noting…"
            rows={3}
            style={{ ...inputFull, resize: 'vertical', lineHeight: 1.55 }}
          />
        </FormCard>

      </div>

      {/* Sticky save button */}
      <div style={{
        position: 'fixed', bottom: 52, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, padding: '10px 16px', zIndex: 20,
        background: 'linear-gradient(to top, #FDF6E9 80%, transparent)',
        pointerEvents: 'none',
      }}>
        <motion.button
          className="btn-primary"
          style={{ width: '100%', pointerEvents: 'auto', opacity: saving ? 0.7 : 1 }}
          onClick={handleSave}
          disabled={saving}
          whileTap={{ scale: 0.97 }}
        >
          {saving ? 'Saving…' : '☕ Save run'}
        </motion.button>
      </div>

      {/* Stamp unlock animation */}
      {unlockShop && (
        <StampUnlockAnimation
          visible
          accentColor={unlockShop.accentColor}
          emoji={unlockShop.emoji}
          shopName={unlockShop.name}
          tier={unlockShop.tier}
          onDone={() => {
            setUnlock(null);
            navigate({ to: 'shop-detail', shopId: unlockShop.id! });
          }}
        />
      )}
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function FormCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C27D38', marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function SelectedShopChip({ shop, onClear }: { shop: Shop; onClear: () => void }) {
  const textColor = isLight(shop.accentColor) ? '#2C1A0E' : '#FDF6E9';
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: shop.accentColor, borderRadius: 12, padding: '10px 14px',
      }}
    >
      {shop.emoji && <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{shop.emoji}</span>}
      <div style={{ flex: 1, color: textColor }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{shop.name}</div>
        {shop.neighborhood && <div style={{ fontSize: '0.74rem', opacity: 0.75 }}>{shop.neighborhood}</div>}
      </div>
      <button onClick={onClear} style={{
        background: 'rgba(0,0,0,0.18)', border: 'none', borderRadius: 999,
        padding: '3px 10px', cursor: 'pointer',
        color: textColor, fontWeight: 700, fontSize: '0.75rem',
      }}>
        Change
      </button>
    </motion.div>
  );
}

const inputFull: React.CSSProperties = {
  width: '100%', background: '#FDF6E9',
  border: '1.5px solid #D4A96A', borderRadius: 10,
  padding: '9px 13px', fontSize: '0.9rem', color: '#2C1A0E',
  fontFamily: '"Inter", system-ui, sans-serif',
  outline: 'none', boxSizing: 'border-box',
};

const inputSm: React.CSSProperties = {
  ...inputFull, padding: '7px 10px', fontSize: '0.84rem',
};

const shopRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  background: '#FDF6E9', border: '1px solid #E8D5B0', borderRadius: 10,
  padding: '8px 12px', cursor: 'pointer', width: '100%',
};

const backBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#6B3F1A', fontWeight: 600, fontSize: '0.9rem', padding: '4px 0',
};

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145;
}
