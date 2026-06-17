import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db } from '../db/db';
import type { Shop } from '../db/types';
import { TIER_META, overallRating } from '../db/types';
import type { NavFn } from '../App';

interface Props {
  navigate: NavFn;
}

export default function PassportPage({ navigate }: Props) {
  const [shops, setShops] = useState<Shop[]>([]);

  useEffect(() => {
    db.shops.orderBy('firstVisitedAt').reverse().toArray().then(setShops);
  }, []);

  const unlocked = shops.filter(s => s.visitCount > 0);
  const locked   = shops.filter(s => s.visitCount === 0);
  const count = shops.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">My Passport</h1>
            <p className="page-subtitle">
              {count === 0
                ? 'No stamps yet — log your first run!'
                : `${unlocked.length} stamp${unlocked.length !== 1 ? 's' : ''} collected`}
            </p>
          </div>
          <button
            className="btn-primary"
            style={{ fontSize: '0.78rem', padding: '7px 13px', marginTop: 2, flexShrink: 0 }}
            onClick={() => navigate({ to: 'add-shop' })}
          >
            + Add
          </button>
        </div>
      </header>

      {count === 0 ? (
        <EmptyState navigate={navigate} />
      ) : (
        <div style={{ padding: '16px 16px 0' }}>
          {/* Unlocked stamps */}
          {unlocked.length > 0 && (
            <>
              <SectionLabel>Collected ({unlocked.length})</SectionLabel>
              <div className="stamp-grid" style={{ padding: 0, marginBottom: 20 }}>
                {unlocked.map((shop, i) => (
                  <StampTile
                    key={shop.id}
                    shop={shop}
                    index={i}
                    onTap={() => navigate({ to: 'shop-detail', shopId: shop.id! })}
                  />
                ))}
              </div>
            </>
          )}

          {/* Locked / not-yet-visited */}
          {locked.length > 0 && (
            <>
              <SectionLabel>Added, not yet visited ({locked.length})</SectionLabel>
              <div className="stamp-grid" style={{ padding: 0, marginBottom: 20 }}>
                {locked.map((shop, i) => (
                  <LockedTile
                    key={shop.id}
                    shop={shop}
                    index={i}
                    onTap={() => navigate({ to: 'shop-detail', shopId: shop.id! })}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: '#C27D38', marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function StampTile({ shop, index, onTap }: { shop: Shop; index: number; onTap: () => void }) {
  const tier = TIER_META[shop.tier];
  const textColor = isLight(shop.accentColor) ? '#2C1A0E' : '#FDF6E9';

  return (
    <motion.button
      className="stamp-tile unlocked"
      style={{
        background: shop.accentColor,
        color: textColor,
        outline: `3px solid ${tier.color}`,
        outlineOffset: '2px',
        border: 'none',
        cursor: 'pointer',
      }}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22, delay: index * 0.04 }}
      whileTap={{ scale: 0.92 }}
      onClick={onTap}
    >
      {shop.emoji && <span className="stamp-emoji">{shop.emoji}</span>}
      <span className="stamp-name">{shop.name}</span>
      <span className="stamp-tier" style={{
        color: tier.color,
        background: 'rgba(0,0,0,0.22)',
        padding: '1px 5px', borderRadius: 4,
      }}>
        {tier.label}
      </span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: '0.55rem', opacity: 0.7 }}>{shop.visitCount}×</span>
        {overallRating(shop.avgRatings) > 0 && (
          <span style={{
            fontSize: '0.55rem', fontWeight: 700, color: '#D4AF37',
            background: 'rgba(0,0,0,0.25)', borderRadius: 3, padding: '0 3px',
          }}>
            ★{overallRating(shop.avgRatings)}
          </span>
        )}
      </div>
    </motion.button>
  );
}

function LockedTile({ shop, index, onTap }: { shop: Shop; index: number; onTap: () => void }) {
  return (
    <motion.button
      className="stamp-tile locked"
      style={{ border: 'none', cursor: 'pointer' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 + 0.15 }}
      whileTap={{ scale: 0.92 }}
      onClick={onTap}
    >
      <span style={{ fontSize: '1.3rem', opacity: 0.4 }}>{shop.emoji ?? '☕'}</span>
      <span style={{ fontSize: '0.62rem', color: '#D4A96A', fontWeight: 600, textAlign: 'center', padding: '0 4px' }}>
        {shop.name}
      </span>
      <span style={{ fontSize: '0.55rem', color: '#D4A96A' }}>Log to unlock</span>
    </motion.button>
  );
}

function EmptyState({ navigate }: { navigate: NavFn }) {
  return (
    <div className="placeholder-page">
      <motion.div
        className="placeholder-icon"
        animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
        transition={{ duration: 1.2, delay: 0.5, ease: 'easeInOut' }}
      >
        📖
      </motion.div>
      <p className="placeholder-title">Empty passport</p>
      <p className="placeholder-body">
        Every coffee shop you visit becomes a stamp. Log your first run to unlock one.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn-primary" onClick={() => navigate({ to: 'tab', tab: 'log' })}>
          Log a run
        </button>
        <button className="btn-secondary" onClick={() => navigate({ to: 'add-shop' })}>
          Add shop
        </button>
      </div>
    </div>
  );
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145;
}
