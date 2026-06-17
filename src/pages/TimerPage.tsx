import { useState, useEffect, useReducer, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, getSettings, updateSettings } from '../db/db';
import type { Shop, Settings } from '../db/types';
import { DEFAULT_SETTINGS } from '../db/types';
import type { NavFn } from '../App';

// ── Timer state machine ────────────────────────────────────────────────────

type Phase = 'idle' | 'focus' | 'break' | 'longBreak';

interface TState {
  phase:            Phase;
  secondsLeft:      number;
  running:          boolean;
  pomodorosSession: number;
  pomodorosCycle:   number;
}

type TAction =
  | { type: 'TICK';  focusMins: number; breakMins: number; longBreakMins: number; longBreakInterval: number }
  | { type: 'START'; focusMins: number }
  | { type: 'PAUSE' }
  | { type: 'RESET'; focusMins: number }
  | { type: 'SYNC';  focusMins: number }
  | { type: 'LOG_DONE'; focusMins: number };

const INIT: TState = {
  phase: 'idle',
  secondsLeft: DEFAULT_SETTINGS.focusMinutes * 60,
  running: false,
  pomodorosSession: 0,
  pomodorosCycle: 0,
};

function reducer(s: TState, a: TAction): TState {
  switch (a.type) {
    case 'TICK': {
      if (!s.running) return s;
      const secs = s.secondsLeft - 1;
      if (secs > 0) return { ...s, secondsLeft: secs };
      if (s.phase === 'focus') {
        const sess  = s.pomodorosSession + 1;
        const cycle = s.pomodorosCycle + 1;
        const toLong = cycle >= a.longBreakInterval;
        return {
          ...s,
          pomodorosSession: sess,
          pomodorosCycle: toLong ? 0 : cycle,
          phase: toLong ? 'longBreak' : 'break',
          secondsLeft: toLong ? a.longBreakMins * 60 : a.breakMins * 60,
        };
      }
      return { ...s, phase: 'focus', secondsLeft: a.focusMins * 60 };
    }
    case 'START':
      return {
        ...s, running: true,
        phase: s.phase === 'idle' ? 'focus' : s.phase,
        secondsLeft: s.phase === 'idle' ? a.focusMins * 60 : s.secondsLeft,
      };
    case 'PAUSE':
      return { ...s, running: false };
    case 'RESET':
      return { ...s, running: false, phase: 'idle', secondsLeft: a.focusMins * 60, pomodorosCycle: 0 };
    case 'SYNC':
      return s.phase === 'idle' ? { ...s, secondsLeft: a.focusMins * 60 } : s;
    case 'LOG_DONE':
      return { ...INIT, secondsLeft: a.focusMins * 60 };
    default: return s;
  }
}

// ── Audio ──────────────────────────────────────────────────────────────────

function playChime() {
  try {
    const ctx = new AudioContext();
    const notes: [number, number][] = [[523, 0], [659, 0.14], [784, 0.28]];
    notes.forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
      osc.start(t);
      osc.stop(t + 1.1);
    });
  } catch {}
}

// ── Page ───────────────────────────────────────────────────────────────────

interface Props { navigate: NavFn; }

export default function TimerPage({ navigate }: Props) {
  const [timer, dispatch] = useReducer(reducer, INIT);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [shops, setShops]       = useState<Shop[]>([]);
  const [shopId, setShopId]     = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPicker, setShowPicker]     = useState(false);
  const prevPhaseRef = useRef<Phase>('idle');

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s);
      dispatch({ type: 'SYNC', focusMins: s.focusMinutes });
    });
    db.shops.where('visitCount').above(0).toArray().then(setShops);
  }, []);

  // Tick interval
  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => dispatch({
      type: 'TICK',
      focusMins:         settings.focusMinutes,
      breakMins:         settings.breakMinutes,
      longBreakMins:     settings.longBreakMinutes,
      longBreakInterval: settings.longBreakInterval,
    }), 1000);
    return () => clearInterval(id);
  }, [timer.running, settings]);

  // Phase-change chime
  useEffect(() => {
    if (prevPhaseRef.current !== timer.phase) {
      if (prevPhaseRef.current !== 'idle' && settings.soundEnabled) playChime();
      prevPhaseRef.current = timer.phase;
    }
  }, [timer.phase, settings.soundEnabled]);

  const handleSaveSettings = async (patch: Partial<Settings>) => {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    await updateSettings(patch);
    if (timer.phase === 'idle') dispatch({ type: 'SYNC', focusMins: updated.focusMinutes });
  };

  const handleLogSession = () => {
    const dur = Math.max(1, timer.pomodorosSession * settings.focusMinutes);
    navigate({ to: 'log-run', shopId: shopId ?? undefined, prefillPomodoros: timer.pomodorosSession, prefillDurationMinutes: dur });
    dispatch({ type: 'LOG_DONE', focusMins: settings.focusMinutes });
  };

  const selectedShop = shops.find(s => s.id === shopId) ?? null;
  const animMode = (
    timer.phase === 'break' || timer.phase === 'longBreak' ? 'rest' :
    timer.running ? 'run' : 'idle'
  ) as 'run' | 'idle' | 'rest';

  const mm = String(Math.floor(timer.secondsLeft / 60)).padStart(2, '0');
  const ss = String(timer.secondsLeft % 60).padStart(2, '0');
  const phaseLabel = { idle: 'Ready', focus: 'Focus', break: 'Short Break', longBreak: 'Long Break ☕' }[timer.phase];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', paddingBottom: 32 }}>

      {/* ── Header ── */}
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Focus Timer</h1>
            <p className="page-subtitle">
              {timer.pomodorosSession > 0
                ? `${timer.pomodorosSession} 🍅 this session`
                : 'Pour yourself into it'}
            </p>
          </div>
          <button onClick={() => setShowSettings(o => !o)} style={{
            background: showSettings ? '#6B3F1A' : '#E8D5B0',
            color: showSettings ? '#FDF6E9' : '#6B3F1A',
            border: 'none', borderRadius: 999, padding: '7px 13px',
            cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
            transition: 'background 0.15s',
            fontFamily: '"Inter", system-ui, sans-serif',
          }}>
            ⚙ Settings
          </button>
        </div>
      </header>

      {/* ── Shop chip ── */}
      <div style={{ padding: '0 16px 14px' }}>
        <button
          onClick={() => shops.length > 0 && setShowPicker(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: selectedShop ? selectedShop.accentColor : '#E8D5B0',
            color: selectedShop
              ? (isLight(selectedShop.accentColor) ? '#2C1A0E' : '#FDF6E9')
              : '#6B3F1A',
            border: 'none', borderRadius: 999, padding: '7px 15px',
            cursor: shops.length > 0 ? 'pointer' : 'default',
            fontWeight: 600, fontSize: '0.82rem',
            fontFamily: '"Inter", system-ui, sans-serif',
            transition: 'background 0.15s',
          }}
        >
          {selectedShop
            ? <>{selectedShop.emoji} {selectedShop.name} ▾</>
            : <>{shops.length > 0 ? '☕ Select a shop ▾' : '☕ Log a run first'}</>
          }
        </button>
      </div>

      {/* ── Cup + timer display ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px 20px', gap: 0 }}>

        <CoffeeCup animMode={animMode} />

        {/* Phase badge */}
        <AnimatePresence mode="wait">
          <motion.div
            key={timer.phase}
            initial={{ opacity: 0, y: -6, scale: 0.88 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.88 }}
            transition={{ duration: 0.22 }}
            style={{
              marginTop: 10, padding: '4px 16px', borderRadius: 999,
              fontWeight: 700, fontSize: '0.72rem',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              background: { idle: '#E8D5B0', focus: '#2C1A0E', break: '#6B8E23', longBreak: '#C27D38' }[timer.phase],
              color: timer.phase === 'idle' ? '#6B3F1A' : '#FDF6E9',
            }}
          >
            {phaseLabel}
          </motion.div>
        </AnimatePresence>

        {/* Countdown */}
        <div style={{
          marginTop: 8,
          fontSize: '3.8rem', fontWeight: 700, color: '#2C1A0E',
          fontFamily: '"Playfair Display", Georgia, serif',
          lineHeight: 1, letterSpacing: '-0.03em',
        }}>
          {mm}:{ss}
        </div>

        {/* Cycle dots */}
        {settings.longBreakInterval > 1 && (
          <div style={{ display: 'flex', gap: 7, marginTop: 12 }}>
            {Array.from({ length: settings.longBreakInterval }).map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  background: i < timer.pomodorosCycle ? '#C27D38' : '#E8D5B0',
                  scale: i < timer.pomodorosCycle ? 1 : 0.8,
                }}
                transition={{ duration: 0.3 }}
                style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid #D4A96A' }}
              />
            ))}
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, marginTop: 22, width: '100%', maxWidth: 260 }}>
          {timer.phase === 'idle' && !timer.running ? (
            <motion.button
              className="btn-primary"
              style={{ flex: 1, fontSize: '1rem', padding: '13px' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => dispatch({ type: 'START', focusMins: settings.focusMinutes })}
            >
              ▶ Start Focus
            </motion.button>
          ) : timer.running ? (
            <>
              <motion.button className="btn-primary" style={{ flex: 1 }} whileTap={{ scale: 0.97 }}
                onClick={() => dispatch({ type: 'PAUSE' })}>
                ⏸ Pause
              </motion.button>
              <motion.button style={secondaryBtnStyle} whileTap={{ scale: 0.97 }}
                onClick={() => dispatch({ type: 'RESET', focusMins: settings.focusMinutes })}>
                ⏹
              </motion.button>
            </>
          ) : (
            <>
              <motion.button className="btn-primary" style={{ flex: 1 }} whileTap={{ scale: 0.97 }}
                onClick={() => dispatch({ type: 'START', focusMins: settings.focusMinutes })}>
                ▶ Resume
              </motion.button>
              <motion.button style={secondaryBtnStyle} whileTap={{ scale: 0.97 }}
                onClick={() => dispatch({ type: 'RESET', focusMins: settings.focusMinutes })}>
                ⏹
              </motion.button>
            </>
          )}
        </div>

        {/* Log session */}
        <AnimatePresence>
          {timer.pomodorosSession > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleLogSession}
              style={{
                marginTop: 14, background: 'none',
                border: '1.5px solid #C27D38', borderRadius: 12,
                padding: '10px 20px', cursor: 'pointer',
                color: '#C27D38', fontWeight: 700, fontSize: '0.88rem',
                fontFamily: '"Inter", system-ui, sans-serif',
              }}
            >
              Log this session ({timer.pomodorosSession} 🍅) →
            </motion.button>
          )}
        </AnimatePresence>

      </div>

      {/* ── Settings panel ── */}
      <AnimatePresence>
        {showSettings && (
          <SettingsPanel settings={settings} onSave={handleSaveSettings} />
        )}
      </AnimatePresence>

      {/* ── Shop picker sheet ── */}
      <AnimatePresence>
        {showPicker && (
          <ShopPickerSheet
            shops={shops}
            currentId={shopId}
            onSelect={id => { setShopId(id); setShowPicker(false); }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

// ── Coffee mug with steam ──────────────────────────────────────────────────

type AnimMode = 'run' | 'idle' | 'rest';

function SteamWisp({ x, delay, speed }: { x: number; delay: number; speed: number }) {
  return (
    <motion.g
      animate={{ y: [0, -28], opacity: [0, 0.7, 0.7, 0] }}
      transition={{ duration: speed, delay, repeat: Infinity, ease: 'easeOut', repeatDelay: 0.4 }}
    >
      <path
        d={`M${x},0 Q${x + 9},-12 ${x},-24 Q${x - 9},-36 ${x},-48`}
        fill="none" stroke="#B0897A" strokeWidth="3" strokeLinecap="round"
      />
    </motion.g>
  );
}

function CoffeeCup({ animMode }: { animMode: AnimMode }) {
  const steamOn = animMode !== 'rest';

  return (
    <svg viewBox="-4 -60 172 195" style={{ width: '100%', maxWidth: 180, height: 'auto' }} aria-label="Coffee mug">

      {/* Steam — three staggered wisps, visible when not on break */}
      <motion.g
        animate={{ opacity: steamOn ? 1 : 0 }}
        transition={{ duration: 0.9 }}
      >
        <SteamWisp x={52}  delay={0}   speed={2.4} />
        <SteamWisp x={80}  delay={0.8} speed={2.8} />
        <SteamWisp x={108} delay={0.4} speed={2.2} />
      </motion.g>

      {/* Handle */}
      <path d="M 128,58 C 162,58 162,118 128,118"
        fill="none" stroke="#C8A882" strokeWidth="22" strokeLinecap="butt"/>
      <path d="M 128,58 C 156,58 156,118 128,118"
        fill="none" stroke="#F5EDE0" strokeWidth="13" strokeLinecap="butt"/>

      {/* Mug body */}
      <path d="M 22,38 L 138,38 L 126,132 L 34,132 Z" fill="#F5EDE0"/>
      {/* Left shadow */}
      <path d="M 22,38 L 42,38 L 30,132 L 34,132 Z" fill="#E2D4C0"/>
      {/* Right highlight */}
      <path d="M 134,46 L 138,38 L 134,38 L 122,132 L 126,132 Z" fill="#FFFFFF" opacity={0.5}/>

      {/* Rim */}
      <ellipse cx="80" cy="38" rx="58" ry="11" fill="#E8DDD0"/>
      {/* Coffee surface inside rim */}
      <ellipse cx="80" cy="39" rx="52" ry="8.5" fill="#6B3A1F"/>

      {/* Bottom */}
      <ellipse cx="80" cy="132" rx="46" ry="7" fill="#D4C4B0"/>
      {/* Ground shadow */}
      <ellipse cx="80" cy="139" rx="50" ry="6" fill="#C8B89A" opacity={0.35}/>

    </svg>
  );
}

// ── Settings panel ─────────────────────────────────────────────────────────

function SettingsPanel({ settings, onSave }: { settings: Settings; onSave: (p: Partial<Settings>) => void }) {
  const [focus, setFocus]       = useState(String(settings.focusMinutes));
  const [sBreak, setSBreak]     = useState(String(settings.breakMinutes));
  const [lBreak, setLBreak]     = useState(String(settings.longBreakMinutes));
  const [interval, setInterval] = useState(String(settings.longBreakInterval));

  const save = () => {
    onSave({
      focusMinutes:      clamp(parseInt(focus)    || 25, 1, 90),
      breakMinutes:      clamp(parseInt(sBreak)   || 5,  1, 30),
      longBreakMinutes:  clamp(parseInt(lBreak)   || 15, 5, 60),
      longBreakInterval: clamp(parseInt(interval) || 4,  1, 8),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      style={{ overflow: 'hidden' }}
    >
      <div className="card" style={{ margin: '0 16px 20px' }}>
        <div style={sectionLabelStyle}>Timer Settings</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <SettingsInput label="Focus (min)"        value={focus}    onChange={setFocus}    />
          <SettingsInput label="Short break (min)"  value={sBreak}   onChange={setSBreak}   />
          <SettingsInput label="Long break (min)"   value={lBreak}   onChange={setLBreak}   />
          <SettingsInput label="Long break every 🍅" value={interval} onChange={setInterval} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: '0.82rem', color: '#6B3F1A', fontWeight: 600, fontFamily: '"Inter", system-ui, sans-serif' }}>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={e => onSave({ soundEnabled: e.target.checked })}
              style={{ accentColor: '#6B3F1A', width: 16, height: 16 }}
            />
            Sound on
          </label>
          <button onClick={save} style={{
            padding: '7px 18px', background: '#6B3F1A', color: '#FDF6E9',
            border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem',
            cursor: 'pointer', fontFamily: '"Inter", system-ui, sans-serif',
          }}>
            Save
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SettingsInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#C27D38', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
        {label}
      </div>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', background: '#FDF6E9', border: '1.5px solid #D4A96A',
          borderRadius: 8, padding: '7px 10px', fontSize: '0.9rem', color: '#2C1A0E',
          fontFamily: '"Inter", system-ui, sans-serif', outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

// ── Shop picker bottom sheet ────────────────────────────────────────────────

function ShopPickerSheet({ shops, currentId, onSelect, onClose }: {
  shops: Shop[];
  currentId: number | null;
  onSelect: (id: number) => void;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(44,26,14,0.5)', zIndex: 100 }}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480,
          background: '#FDF6E9', borderRadius: '20px 20px 0 0',
          padding: '20px 16px 36px', zIndex: 101,
          maxHeight: '65vh', overflowY: 'auto',
        }}
      >
        <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 700, fontSize: '1.1rem', color: '#2C1A0E', marginBottom: 14 }}>
          Which shop are you at?
        </div>
        {shops.map(shop => {
          const selected = currentId === shop.id;
          const tc = isLight(shop.accentColor) ? '#2C1A0E' : '#FDF6E9';
          return (
            <button key={shop.id} onClick={() => onSelect(shop.id!)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '11px 13px', marginBottom: 6,
              background: selected ? shop.accentColor : '#F5EDD8',
              color: selected ? tc : '#2C1A0E',
              border: `1.5px solid ${selected ? shop.accentColor : '#E8D5B0'}`,
              borderRadius: 12, cursor: 'pointer',
              fontFamily: '"Inter", system-ui, sans-serif', textAlign: 'left',
              transition: 'background 0.12s',
            }}>
              <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{shop.emoji ?? '☕'}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{shop.name}</div>
                {shop.neighborhood && (
                  <div style={{ fontSize: '0.72rem', opacity: 0.75 }}>{shop.neighborhood}</div>
                )}
              </div>
              {selected && <span style={{ marginLeft: 'auto', fontSize: '0.8rem', flexShrink: 0, opacity: 0.9 }}>✓</span>}
            </button>
          );
        })}
      </motion.div>
    </>
  );
}

// ── Helpers & styles ────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145;
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 16px', background: '#E8D5B0', color: '#6B3F1A',
  border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '1rem',
  cursor: 'pointer', fontFamily: '"Inter", system-ui, sans-serif',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: '#C27D38', marginBottom: 12,
};
