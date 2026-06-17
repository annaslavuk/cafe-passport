import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../db/db';
import type { Quest, Run, QuestKind } from '../db/types';
import { QUEST_KIND_META } from '../db/types';
import type { NavFn } from '../App';

interface SessionEntry {
  run: Run;
  shopId: number;
  shopName: string;
  shopEmoji?: string;
}

interface Props { navigate: NavFn; }

export default function QuestsPage({ navigate }: Props) {
  const [tab, setTab]             = useState<'active' | 'done'>('active');
  const [campaigns, setCampaigns] = useState<Quest[]>([]);
  const [completed, setCompleted] = useState<Quest[]>([]);
  const [sessionLog, setSession]  = useState<SessionEntry[]>([]);
  const [showNew, setShowNew]     = useState(false);

  // new quest form
  const [nTitle,  setNTitle]  = useState('');
  const [nDesc,   setNDesc]   = useState('');
  const [nKind,   setNKind]   = useState<QuestKind>('visits');
  const [nTarget, setNTarget] = useState('');

  const load = useCallback(async () => {
    const [all, recent] = await Promise.all([
      db.quests.orderBy('createdAt').reverse().toArray(),
      db.runs.orderBy('date').reverse().filter(r => !!r.sessionQuest).limit(10).toArray(),
    ]);
    setCampaigns(all.filter(q => q.status === 'active' && q.type === 'campaign'));
    setCompleted(all.filter(q => q.status === 'completed'));

    const enriched: SessionEntry[] = await Promise.all(
      recent.map(async r => {
        const shop = await db.shops.get(r.shopId);
        return { run: r, shopId: r.shopId, shopName: shop?.name ?? 'Unknown', shopEmoji: shop?.emoji };
      })
    );
    setSession(enriched);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!nTitle.trim()) return;
    const rawTarget = nKind === 'hours'
      ? (parseFloat(nTarget) || 0) * 60
      : parseInt(nTarget) || 0;
    await db.quests.add({
      title: nTitle.trim(),
      description: nDesc.trim() || undefined,
      type: 'campaign',
      kind: nKind,
      target: nKind !== 'custom' && rawTarget > 0 ? rawTarget : undefined,
      progress: 0,
      status: 'active',
      createdAt: new Date(),
    });
    setNTitle(''); setNDesc(''); setNKind('visits'); setNTarget('');
    setShowNew(false);
    load();
  };

  const markDone = async (q: Quest) => {
    await db.quests.update(q.id!, { status: 'completed', completedAt: new Date() });
    load();
  };

  const deleteQuest = async (id: number) => {
    await db.quests.delete(id);
    load();
  };

  const bump = async (q: Quest, delta: number) => {
    const newProg = Math.max(0, q.progress + delta);
    const isNowComplete = q.target != null && newProg >= q.target;
    await db.quests.update(q.id!, {
      progress: newProg,
      ...(isNowComplete ? { status: 'completed' as const, completedAt: new Date() } : {}),
    });
    load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ── Header ── */}
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Quests</h1>
            <p className="page-subtitle">
              {campaigns.length} active · {completed.length} done
            </p>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {(['active', 'done'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '5px 12px', borderRadius: 999,
                fontSize: '0.75rem', fontWeight: 700,
                border: 'none', cursor: 'pointer',
                background: tab === t ? '#6B3F1A' : '#E8D5B0',
                color: tab === t ? '#FDF6E9' : '#6B3F1A',
                transition: 'background 0.15s',
              }}>
                {t === 'active' ? '⚔️ Active' : '✅ Done'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <AnimatePresence mode="wait">

        {/* ─── Active tab ─── */}
        {tab === 'active' && (
          <motion.div
            key="active"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.18 }}
            style={{ padding: '14px 16px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <SectionLabel>Campaign Quests</SectionLabel>

            {campaigns.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '18px 0',
                color: '#D4A96A', fontStyle: 'italic', fontSize: '0.85rem',
              }}>
                No active quests — create one below!
              </div>
            )}

            {campaigns.map(q => (
              <QuestCard
                key={q.id}
                quest={q}
                onDone={() => markDone(q)}
                onDelete={() => deleteQuest(q.id!)}
                onBump={d => bump(q, d)}
              />
            ))}

            {/* Session quest log */}
            {sessionLog.length > 0 && (
              <>
                <SectionLabel style={{ marginTop: 6 }}>Session Quest Log</SectionLabel>
                {sessionLog.map(e => (
                  <SessionRow
                    key={e.run.id}
                    entry={e}
                    onTap={() => navigate({ to: 'shop-detail', shopId: e.shopId })}
                  />
                ))}
              </>
            )}

            {/* New quest form or button */}
            <AnimatePresence mode="wait">
              {showNew ? (
                <NewQuestForm
                  key="form"
                  title={nTitle} setTitle={setNTitle}
                  desc={nDesc}   setDesc={setNDesc}
                  kind={nKind}   setKind={setNKind}
                  target={nTarget} setTarget={setNTarget}
                  onAdd={handleAdd}
                  onCancel={() => { setShowNew(false); setNTitle(''); setNDesc(''); setNKind('visits'); setNTarget(''); }}
                />
              ) : (
                <motion.button
                  key="btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowNew(true)}
                  style={{
                    width: '100%', background: 'none',
                    border: '1.5px dashed #D4A96A', borderRadius: 14,
                    padding: '13px', cursor: 'pointer',
                    color: '#C27D38', fontWeight: 700, fontSize: '0.9rem',
                    fontFamily: '"Inter", system-ui, sans-serif',
                    marginTop: 6,
                  }}
                >
                  ＋ New campaign quest
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ─── Done tab ─── */}
        {tab === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ duration: 0.18 }}
            style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {completed.length === 0 ? (
              <div className="placeholder-page">
                <div className="placeholder-icon">🏆</div>
                <p className="placeholder-title">Nothing completed yet</p>
                <p className="placeholder-body">
                  Finish an active quest to see it here.
                </p>
              </div>
            ) : (
              <>
                <SectionLabel>Completed ({completed.length})</SectionLabel>
                {completed.map(q => (
                  <CompletedCard key={q.id} quest={q} onDelete={() => deleteQuest(q.id!)} />
                ))}
              </>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: '#C27D38', ...style,
    }}>
      {children}
    </div>
  );
}

function QuestCard({ quest, onDone, onDelete, onBump }: {
  quest: Quest;
  onDone: () => void;
  onDelete: () => void;
  onBump: (delta: number) => void;
}) {
  const kind: QuestKind = quest.kind ?? 'custom';
  const meta = QUEST_KIND_META[kind];
  const pct  = quest.target ? Math.min(100, Math.round((quest.progress / quest.target) * 100)) : 0;

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2C1A0E', lineHeight: 1.3 }}>
            {quest.title}
          </div>
          {quest.description && (
            <div style={{ fontSize: '0.78rem', color: '#6B3F1A', marginTop: 2, opacity: 0.8 }}>
              {quest.description}
            </div>
          )}
        </div>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px',
          borderRadius: 999, background: '#E8D5B0', color: '#6B3F1A',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {meta.emoji} {meta.label}
        </span>
      </div>

      {/* Progress */}
      {quest.target != null ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: '0.78rem', color: '#6B3F1A', fontWeight: 600 }}>
              {fmtProgress(quest)}
            </span>
            <span style={{ fontSize: '0.78rem', color: '#C27D38', fontWeight: 700 }}>{pct}%</span>
          </div>
          <div style={{ height: 8, background: '#E8D5B0', borderRadius: 999, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{
                height: '100%', borderRadius: 999,
                background: pct >= 100
                  ? 'linear-gradient(90deg, #6B8E23, #8FBC8F)'
                  : 'linear-gradient(90deg, #C27D38, #D4A96A)',
              }}
            />
          </div>
        </div>
      ) : kind === 'custom' && (
        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: '0.82rem', color: '#6B3F1A', fontWeight: 600 }}>
            Progress: {quest.progress}
          </span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 7, justifyContent: 'space-between', alignItems: 'center' }}>
        {kind === 'custom' ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => onBump(-1)} style={counterBtn('#E8D5B0', '#6B3F1A')}>−</button>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#2C1A0E', minWidth: 24, textAlign: 'center' }}>
              {quest.progress}
            </span>
            <button onClick={() => onBump(1)} style={counterBtn('#C27D38', '#FDF6E9')}>＋</button>
          </div>
        ) : (
          <div />
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onDone} style={{
            padding: '5px 11px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
            border: 'none', cursor: 'pointer', background: '#6B8E23', color: '#FDF6E9',
          }}>
            ✓ Done
          </button>
          <button onClick={onDelete} style={{
            padding: '5px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
            border: 'none', cursor: 'pointer', background: '#E8D5B0', color: '#8B3A3A',
          }}>
            ✕
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function CompletedCard({ quest, onDelete }: { quest: Quest; onDelete: () => void }) {
  const kind: QuestKind = quest.kind ?? 'custom';
  const meta = QUEST_KIND_META[kind];
  return (
    <div className="card" style={{ opacity: 0.85 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>✅</span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2C1A0E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {quest.title}
            </span>
          </div>
          {quest.completedAt && (
            <div style={{ fontSize: '0.72rem', color: '#C27D38', marginTop: 3, paddingLeft: 30 }}>
              Completed {fmtDate(quest.completedAt)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px',
            borderRadius: 999, background: '#E8D5B0', color: '#6B3F1A', whiteSpace: 'nowrap',
          }}>
            {meta.emoji} {meta.label}
          </span>
          <button onClick={onDelete} style={{
            padding: '4px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700,
            border: 'none', cursor: 'pointer', background: '#E8D5B0', color: '#8B3A3A',
          }}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionRow({ entry, onTap }: { entry: SessionEntry; onTap: () => void }) {
  const { run, shopName, shopEmoji } = entry;
  return (
    <button onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: '#FDF6E9', border: '1px solid #E8D5B0',
      borderRadius: 12, padding: '10px 13px', cursor: 'pointer',
      width: '100%', textAlign: 'left',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>
        {run.sessionQuestDone ? '✅' : '⬜'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#2C1A0E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {run.sessionQuest}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#C27D38', marginTop: 1 }}>
          {shopEmoji} {shopName} · {fmtDate(run.date)}
        </div>
      </div>
      <span style={{ fontSize: '0.72rem', color: '#D4A96A', flexShrink: 0 }}>→</span>
    </button>
  );
}

interface NewFormProps {
  title: string;  setTitle: (v: string)  => void;
  desc: string;   setDesc:  (v: string)  => void;
  kind: QuestKind; setKind: (v: QuestKind) => void;
  target: string; setTarget: (v: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}

function NewQuestForm({ title, setTitle, desc, setDesc, kind, setKind, target, setTarget, onAdd, onCancel }: NewFormProps) {
  const kinds: QuestKind[] = ['visits', 'runs', 'hours', 'pomodoros', 'custom'];
  const showTarget = kind !== 'custom';
  const targetLabel = kind === 'hours' ? 'hours' : 'count';

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.2 }}
    >
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#C27D38', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        New Quest
      </div>

      <input
        type="text" value={title} onChange={e => setTitle(e.target.value)}
        placeholder="Quest title…" autoFocus
        style={{ ...inputSty, marginBottom: 10 }}
      />

      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#C27D38', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Auto-tracks
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        {kinds.map(k => {
          const m = QUEST_KIND_META[k];
          return (
            <button key={k} onClick={() => setKind(k)} style={{
              padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
              border: 'none', cursor: 'pointer',
              background: kind === k ? '#6B3F1A' : '#E8D5B0',
              color: kind === k ? '#FDF6E9' : '#6B3F1A',
              transition: 'background 0.12s',
            }}>
              {m.emoji} {m.label}
            </button>
          );
        })}
      </div>

      {showTarget && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <input
            type="number" value={target} onChange={e => setTarget(e.target.value)}
            placeholder={`Target ${targetLabel}`} min="1"
            style={{ ...inputSty, flex: 1 }}
          />
          <span style={{ fontSize: '0.78rem', color: '#C27D38', fontWeight: 600, flexShrink: 0 }}>
            {targetLabel}
          </span>
        </div>
      )}

      <input
        type="text" value={desc} onChange={e => setDesc(e.target.value)}
        placeholder="Description (optional)"
        style={{ ...inputSty, marginBottom: 12 }}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onAdd} style={{
          flex: 1, background: '#6B3F1A', color: '#FDF6E9', border: 'none',
          borderRadius: 10, padding: '10px', fontWeight: 700, fontSize: '0.88rem',
          cursor: 'pointer', fontFamily: '"Inter", system-ui, sans-serif',
        }}>
          Add Quest
        </button>
        <button onClick={onCancel} style={{
          padding: '10px 16px', background: '#E8D5B0', color: '#6B3F1A', border: 'none',
          borderRadius: 10, fontWeight: 700, fontSize: '0.88rem',
          cursor: 'pointer', fontFamily: '"Inter", system-ui, sans-serif',
        }}>
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(d));
}

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtProgress(quest: Quest): string {
  const kind = quest.kind ?? 'custom';
  const { progress, target } = quest;
  if (kind === 'hours') {
    return target != null
      ? `${fmtMins(progress)} / ${fmtMins(target)}`
      : fmtMins(progress);
  }
  return target != null ? `${progress} / ${target}` : `${progress}`;
}

function counterBtn(bg: string, color: string): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 8, border: 'none',
    background: bg, color, fontWeight: 700, fontSize: '1rem',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: '"Inter", system-ui, sans-serif',
  };
}

const inputSty: React.CSSProperties = {
  width: '100%', background: '#FDF6E9',
  border: '1.5px solid #D4A96A', borderRadius: 10,
  padding: '9px 13px', fontSize: '0.88rem', color: '#2C1A0E',
  fontFamily: '"Inter", system-ui, sans-serif',
  outline: 'none', boxSizing: 'border-box',
};
