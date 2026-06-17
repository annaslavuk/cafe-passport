import { motion } from 'framer-motion';
import { RATING_FIELDS } from '../../db/types';
import type { RatingsSnapshot } from '../../db/types';

interface Props {
  ratings: RatingsSnapshot;
  animate?: boolean;
}

export default function RatingBars({ ratings, animate = true }: Props) {
  const hasAny = Object.values(ratings).some(v => v > 0);

  if (!hasAny) {
    return (
      <div style={{ textAlign: 'center', padding: '12px 0', color: '#D4A96A', fontSize: '0.8rem', fontStyle: 'italic' }}>
        No ratings yet — added after logging a run
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {RATING_FIELDS.map((field, i) => {
        const val = ratings[field.key];
        const pct = val > 0 ? (val / 5) * 100 : 0;
        return (
          <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 22, textAlign: 'center', fontSize: '1rem', flexShrink: 0 }}>
              {field.emoji}
            </span>
            <span style={{ width: 72, fontSize: '0.75rem', color: '#6B3F1A', fontWeight: 600, flexShrink: 0 }}>
              {field.label}
            </span>
            <div style={{ flex: 1, height: 7, background: '#E8D5B0', borderRadius: 999, overflow: 'hidden' }}>
              <motion.div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #C27D38 0%, #D4A96A 100%)',
                  borderRadius: 999,
                }}
                initial={animate ? { width: 0 } : { width: `${pct}%` }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: 'easeOut' }}
              />
            </div>
            <span style={{ width: 28, textAlign: 'right', fontSize: '0.78rem', fontWeight: 700, color: '#2C1A0E', flexShrink: 0 }}>
              {val > 0 ? val.toFixed(1) : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
