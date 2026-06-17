import { motion } from 'framer-motion';
import type { RatingsSnapshot } from '../../db/types';

const SIZE = 300;
const CX = 150, CY = 150;
const MAX_R = 82;
const LABEL_R = 116;
const N = 6;

const AXES = [
  { key: 'coffee'    as const, emoji: '☕', label: 'COFFEE'   },
  { key: 'vibe'      as const, emoji: '✨', label: 'VIBE'     },
  { key: 'comfort'   as const, emoji: '🪑', label: 'COMFORT'  },
  { key: 'wifi'      as const, emoji: '📶', label: 'WI-FI'    },
  { key: 'outlets'   as const, emoji: '🔌', label: 'OUTLETS'  },
  { key: 'quietness' as const, emoji: '🔇', label: 'QUIET'    },
];

// start at top (–90°) going clockwise
const ANGLES = AXES.map((_, i) => -Math.PI / 2 + (i / N) * 2 * Math.PI);

function pt(angle: number, r: number): [number, number] {
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

function polyPoints(rFn: (i: number) => number) {
  return ANGLES.map((a, i) => pt(a, rFn(i)).join(',')).join(' ');
}

interface Props {
  ratings: RatingsSnapshot;
  animate?: boolean;
}

export default function RadarChart({ ratings, animate = true }: Props) {
  const hasData = Object.values(ratings).some(v => v > 0);

  // Compute the filled polygon's points
  const dataPts = AXES.map((axis, i) => ({
    x: pt(ANGLES[i], (ratings[axis.key] / 5) * MAX_R)[0],
    y: pt(ANGLES[i], (ratings[axis.key] / 5) * MAX_R)[1],
    val: ratings[axis.key],
  }));

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      aria-label="Rating radar chart"
    >
      {/* Background grid */}
      {[1, 2, 3, 4, 5].map(level => (
        <polygon
          key={level}
          points={polyPoints(() => (level / 5) * MAX_R)}
          fill={level === 5 ? '#F5EDD8' : 'none'}
          stroke="#D4A96A"
          strokeWidth={level === 5 ? 1.5 : 0.8}
          strokeOpacity={0.55}
        />
      ))}

      {/* Grid level labels (1–5 along top axis) */}
      {[1, 2, 3, 4, 5].map(level => {
        const y = CY - (level / 5) * MAX_R;
        return (
          <text key={level} x={CX + 4} y={y + 4}
            fontSize="8" fill="#D4A96A" fontFamily="Inter,system-ui,sans-serif">
            {level}
          </text>
        );
      })}

      {/* Axis lines */}
      {ANGLES.map((a, i) => {
        const [x2, y2] = pt(a, MAX_R);
        return (
          <line key={i} x1={CX} y1={CY} x2={x2} y2={y2}
            stroke="#D4A96A" strokeWidth={0.8} strokeOpacity={0.45} />
        );
      })}

      {/* Data polygon — animated */}
      {hasData && (
        <motion.polygon
          points={dataPts.map(p => `${p.x},${p.y}`).join(' ')}
          fill="#C27D38"
          fillOpacity={0.22}
          stroke="#C27D38"
          strokeWidth={2.5}
          strokeLinejoin="round"
          initial={animate ? { opacity: 0, scale: 0.3 } : undefined}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.34, 1.4, 0.64, 1] }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        />
      )}

      {/* Data point circles */}
      {hasData && dataPts.map((p, i) => p.val > 0 && (
        <motion.g key={i}
          initial={animate ? { opacity: 0, scale: 0 } : undefined}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.4 + i * 0.05, ease: 'easeOut' }}
          style={{ transformOrigin: `${p.x}px ${p.y}px` }}
        >
          <circle cx={p.x} cy={p.y} r={6} fill="#C27D38" />
          <text x={p.x} y={p.y - 11}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="bold"
            fill="#6B3F1A"
            fontFamily="Inter,system-ui,sans-serif">
            {p.val}
          </text>
        </motion.g>
      ))}

      {/* Axis labels (emoji + text) */}
      {AXES.map((axis, i) => {
        const a = ANGLES[i];
        const [lx, ly] = pt(a, LABEL_R);
        const cosA = Math.cos(a);
        const anchor: 'start' | 'middle' | 'end' =
          cosA > 0.3 ? 'start' : cosA < -0.3 ? 'end' : 'middle';
        return (
          <g key={axis.key}>
            <text x={lx} y={ly - 2}
              textAnchor={anchor}
              dominantBaseline="central"
              fontSize="18"
              style={{ userSelect: 'none' }}>
              {axis.emoji}
            </text>
            <text x={lx} y={ly + 16}
              textAnchor={anchor}
              fontSize="9"
              fontWeight="bold"
              fill="#6B3F1A"
              fontFamily="Inter,system-ui,sans-serif"
              letterSpacing="0.04em">
              {axis.label}
            </text>
          </g>
        );
      })}

      {!hasData && (
        <text x={CX} y={CY + 5}
          textAnchor="middle"
          fontSize="13"
          fill="#D4A96A"
          fontFamily="Inter,system-ui,sans-serif"
          fontStyle="italic">
          No ratings yet
        </text>
      )}
    </svg>
  );
}
