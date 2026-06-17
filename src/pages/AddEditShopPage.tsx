import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db } from '../db/db';
import { GOOD_FOR_OPTIONS, EMPTY_RATINGS } from '../db/types';
import type { NavFn } from '../App';

const PRESET_COLORS = [
  '#C27D38', '#8B4513', '#6B3F1A', '#A0522D',
  '#6B8E23', '#2E8B57', '#556B2F', '#8FBC8F',
  '#708090', '#4682B4', '#9370DB', '#DC143C',
  '#D2691E', '#CD853F', '#8B7355', '#5F9EA0',
];

const PRESET_EMOJIS = [
  '☕', '🫖', '🍵', '🧋', '🌿', '🏡', '🌄', '🦜',
  '🌫️', '🎨', '📖', '🌸', '🌙', '🔥', '⭐', '🎯',
  '🏔️', '🌊', '🍂', '🧡', '🌺', '🐝', '🎪', '🌻',
];

interface Props {
  shopId?: number;
  navigate: NavFn;
}

export default function AddEditShopPage({ shopId, navigate }: Props) {
  const isEdit = shopId != null;

  const [name, setName]           = useState('');
  const [neighborhood, setNeigh]  = useState('');
  const [emoji, setEmoji]         = useState('☕');
  const [color, setColor]         = useState('#C27D38');
  const [goodFor, setGoodFor]     = useState<string[]>([]);
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (!shopId) return;
    db.shops.get(shopId).then(s => {
      if (!s) return;
      setName(s.name);
      setNeigh(s.neighborhood ?? '');
      setEmoji(s.emoji ?? '☕');
      setColor(s.accentColor);
      setGoodFor(s.goodFor);
      setNotes(s.notes ?? '');
    });
  }, [shopId]);

  const toggleGoodFor = (id: string) => {
    setGoodFor(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Shop name is required'); return; }
    setSaving(true);
    setError('');

    const now = new Date();

    if (isEdit) {
      await db.shops.update(shopId!, {
        name: name.trim(),
        neighborhood: neighborhood.trim() || undefined,
        emoji, accentColor: color, goodFor,
        notes: notes.trim() || undefined,
      });
      navigate({ to: 'shop-detail', shopId: shopId! });
    } else {
      const id = await db.shops.add({
        name: name.trim(),
        neighborhood: neighborhood.trim() || undefined,
        emoji, accentColor: color, goodFor,
        notes: notes.trim() || undefined,
        firstVisitedAt: now,
        visitCount: 0,
        tier: 'bronze',
        avgRatings: { ...EMPTY_RATINGS },
      });
      navigate({ to: 'shop-detail', shopId: id as number });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!shopId) return;
    if (!confirm(`Delete "${name}" and all its runs? This cannot be undone.`)) return;
    await db.runs.where('shopId').equals(shopId).delete();
    await db.shops.delete(shopId);
    navigate({ to: 'tab', tab: 'passport' });
  };

  return (
    <div style={{ paddingBottom: 96 }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => navigate({ to: 'back' })}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6B3F1A', fontWeight: 600, fontSize: '0.9rem', padding: '4px 0',
            }}
          >
            ← Back
          </button>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.25rem' }}>
            {isEdit ? 'Edit shop' : 'Add shop'}
          </h1>
          <div style={{ width: 48 }} />
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Preview stamp */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <motion.div
            style={{
              width: 100, height: 100, borderRadius: 18,
              background: color,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              boxShadow: '0 4px 16px rgba(44,26,14,0.22)',
            }}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 0.3 }}
            key={color + emoji}
          >
            <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{emoji}</span>
            <span style={{
              fontSize: '0.6rem', fontWeight: 700, color: isLight(color) ? '#2C1A0E' : '#FDF6E9',
              maxWidth: 80, textAlign: 'center', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px',
            }}>
              {name || 'Shop name'}
            </span>
          </motion.div>
        </div>

        {/* Name */}
        <Field label="Shop name *">
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            placeholder="e.g. The Daily Grind"
            style={inputStyle}
          />
          {error && <span style={{ color: '#DC143C', fontSize: '0.78rem' }}>{error}</span>}
        </Field>

        {/* Neighborhood */}
        <Field label="Neighborhood">
          <input
            type="text"
            value={neighborhood}
            onChange={e => setNeigh(e.target.value)}
            placeholder="e.g. Downtown"
            style={inputStyle}
          />
        </Field>

        {/* Emoji picker */}
        <Field label="Icon">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
            {PRESET_EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                style={{
                  fontSize: '1.4rem', border: '2px solid',
                  borderColor: emoji === e ? '#C27D38' : 'transparent',
                  borderRadius: 8, background: emoji === e ? '#F5EDD8' : 'transparent',
                  cursor: 'pointer', padding: 2, lineHeight: 1.4,
                  transition: 'border-color 0.12s',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </Field>

        {/* Color picker */}
        <Field label="Accent color">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: 8,
                  background: c, cursor: 'pointer',
                  border: color === c ? '3px solid #2C1A0E' : '3px solid transparent',
                  boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                  transition: 'border-color 0.12s, box-shadow 0.12s',
                }}
              />
            ))}
          </div>
        </Field>

        {/* Good for */}
        <Field label="Good for">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GOOD_FOR_OPTIONS.map(opt => {
              const on = goodFor.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleGoodFor(opt.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: on ? '#6B3F1A' : '#E8D5B0',
                    color: on ? '#FDF6E9' : '#6B3F1A',
                    border: 'none', borderRadius: 999,
                    padding: '6px 13px', fontSize: '0.8rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {opt.emoji} {opt.label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Notes */}
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anything worth remembering about this place…"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </Field>

        {/* Delete (edit mode) */}
        {isEdit && (
          <button
            onClick={handleDelete}
            style={{
              background: 'none', border: '1.5px solid #DC143C',
              color: '#DC143C', borderRadius: 12,
              padding: '10px', fontWeight: 600, fontSize: '0.9rem',
              cursor: 'pointer', width: '100%',
            }}
          >
            Delete shop
          </button>
        )}
      </div>

      {/* Fixed save button */}
      <div style={{
        position: 'fixed', bottom: 52, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, padding: '10px 16px', zIndex: 20,
        background: 'linear-gradient(to top, #FDF6E9 70%, transparent)',
      }}>
        <button
          className="btn-primary"
          style={{ width: '100%', opacity: saving ? 0.7 : 1 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add to passport'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: '0.72rem', fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: '#C27D38', marginBottom: 7,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#F5EDD8',
  border: '1.5px solid #D4A96A',
  borderRadius: 12,
  padding: '10px 14px',
  fontSize: '0.9rem',
  color: '#2C1A0E',
  fontFamily: '"Inter", system-ui, sans-serif',
  outline: 'none',
};

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145;
}
