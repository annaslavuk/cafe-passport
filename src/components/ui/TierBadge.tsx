import { TIER_META } from '../../db/types';
import type { ShopTier } from '../../db/types';

interface Props {
  tier: ShopTier;
  visitCount: number;
  size?: 'sm' | 'md';
}

export default function TierBadge({ tier, visitCount, size = 'md' }: Props) {
  const meta = TIER_META[tier];
  const isSm = size === 'sm';

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: meta.color + '22',
        color: meta.color,
        border: `1.5px solid ${meta.color}`,
        borderRadius: 999,
        padding: isSm ? '2px 8px' : '4px 12px',
        fontSize: isSm ? '0.7rem' : '0.8rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }}>
        {tier === 'bronze'  && '🥉'}
        {tier === 'silver'  && '🥈'}
        {tier === 'gold'    && '🥇'}
        {tier === 'regular' && '⭐'}
        {meta.label}
      </span>
      {meta.next != null && !isSm && (
        <TierProgress tier={tier} visitCount={visitCount} />
      )}
    </div>
  );
}

function TierProgress({ tier, visitCount }: { tier: ShopTier; visitCount: number }) {
  const meta = TIER_META[tier];
  if (!meta.next) return null;

  const pct = Math.min(100, Math.round((visitCount / meta.next) * 100));

  return (
    <div style={{ width: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: '0.65rem', color: '#C27D38', fontWeight: 600 }}>
          {visitCount}/{meta.next} for {TIER_META[nextTier(tier)].label}
        </span>
        <span style={{ fontSize: '0.65rem', color: '#C27D38', fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: '#E8D5B0', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${meta.color}, ${TIER_META[nextTier(tier)].color})`,
          borderRadius: 999,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

function nextTier(t: ShopTier): ShopTier {
  if (t === 'bronze')  return 'silver';
  if (t === 'silver')  return 'gold';
  if (t === 'gold')    return 'regular';
  return 'regular';
}
