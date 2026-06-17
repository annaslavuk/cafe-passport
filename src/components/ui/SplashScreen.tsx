import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import './SplashScreen.css';

interface Props {
  holdMs?: number;
  onDone: () => void;
}

export default function SplashScreen({ holdMs = 2000, onDone }: Props) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const enterMs = reduced ? 0 : 700;
    const id = setTimeout(onDone, enterMs + holdMs);
    return () => clearTimeout(id);
  }, [holdMs, onDone, reduced]);

  return (
    <motion.div
      className="splash-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.45, ease: 'easeInOut' } }}
    >
      <motion.div
        className="splash-content"
        initial={reduced ? false : { opacity: 0, scale: 0.82, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <svg
          className="splash-icon"
          viewBox="0 0 512 512"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <g className="splash-steam-1">
            <path d="M176 152 Q190 128 176 104" stroke="#D4A96A" strokeWidth={12} fill="none" strokeLinecap="round" />
          </g>
          <g className="splash-steam-2">
            <path d="M256 140 Q270 116 256 92" stroke="#D4A96A" strokeWidth={12} fill="none" strokeLinecap="round" />
          </g>
          <g className="splash-steam-3">
            <path d="M336 152 Q350 128 336 104" stroke="#D4A96A" strokeWidth={12} fill="none" strokeLinecap="round" />
          </g>
          <path d="M136 192 L164 368 Q168 392 200 392 L312 392 Q344 392 348 368 L376 192 Z" fill="#FDF6E9" />
          <path d="M148 230 L170 368 Q174 388 200 388 L312 388 Q338 388 342 368 L364 230 Z" fill="#C27D38" />
          <path d="M376 240 Q430 240 430 300 Q430 360 376 360" stroke="#FDF6E9" strokeWidth={22} fill="none" strokeLinecap="round" />
          <ellipse cx={256} cy={400} rx={148} ry={18} fill="#C27D38" opacity={0.7} />
        </svg>
        <h1 className="splash-title">Café Passport</h1>
        <p className="splash-tagline">your cozy work adventure</p>
      </motion.div>
    </motion.div>
  );
}
