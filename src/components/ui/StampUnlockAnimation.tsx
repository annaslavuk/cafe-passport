import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  visible: boolean;
  accentColor: string;
  emoji?: string;
  shopName: string;
  tier: string;
  onDone: () => void;
}

/** Plays on first run logged at a new shop. Fires once, then calls onDone. */
export default function StampUnlockAnimation({ visible, accentColor, emoji, shopName, tier, onDone }: Props) {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onDone, 2400);
      return () => clearTimeout(t);
    }
  }, [visible, onDone]);

  const particles = Array.from({ length: 14 }, (_, i) => ({
    angle: (i / 14) * 360,
    dist: 60 + Math.random() * 30,
    size: 6 + Math.random() * 6,
  }));

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(44,26,14,0.55)',
          }}
        >
          {/* Particle burst */}
          {particles.map((p, i) => {
            const rad = (p.angle * Math.PI) / 180;
            return (
              <motion.div
                key={i}
                style={{
                  position: 'absolute',
                  width: p.size,
                  height: p.size,
                  borderRadius: '50%',
                  background: accentColor,
                  opacity: 0.9,
                }}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: Math.cos(rad) * p.dist,
                  y: Math.sin(rad) * p.dist,
                  scale: [0, 1, 0],
                  opacity: [1, 1, 0],
                }}
                transition={{ duration: 0.7, delay: 0.15 + i * 0.02, ease: 'easeOut' }}
              />
            );
          })}

          {/* The stamp */}
          <motion.div
            style={{
              width: 160, height: 160,
              borderRadius: 20,
              background: accentColor,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: `0 0 0 4px ${accentColor}44, 0 16px 48px rgba(0,0,0,0.4)`,
              position: 'relative',
              zIndex: 1,
            }}
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: [0, 1.25, 1], rotate: [-12, 4, 0] }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          >
            <span style={{ fontSize: '3rem' }}>{emoji ?? '☕'}</span>
            <span style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontSize: '0.85rem', fontWeight: 700, color: '#FDF6E9',
              textAlign: 'center', padding: '0 8px',
            }}>
              {shopName}
            </span>
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: '#FDF6E9', opacity: 0.8,
            }}>
              {tier} unlocked!
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
