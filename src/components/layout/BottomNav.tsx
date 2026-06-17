import { motion, AnimatePresence } from 'framer-motion';
import type { TabId } from '../../App';

interface Tab {
  id: TabId;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

const TABS: Tab[] = [
  {
    id: 'passport',
    label: 'Passport',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M9 7h6M9 11h6M9 15h4" />
        <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'log',
    label: 'Log',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    id: 'timer',
    label: 'Timer',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
        {active && <circle cx="12" cy="8" r="1.5" fill="currentColor" stroke="none" />}
      </svg>
    ),
  },
  {
    id: 'quests',
    label: 'Quests',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    id: 'nearby',
    label: 'Nearby',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    id: 'stats',
    label: 'Stats',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function BottomNav({ activeTab, onTabChange }: Props) {
  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`nav-tab${isActive ? ' active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <AnimatePresence>
              {isActive && (
                <motion.div
                  className="nav-indicator"
                  layoutId="nav-indicator"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </AnimatePresence>
            <motion.span
              animate={{ scale: isActive ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {tab.icon(isActive)}
            </motion.span>
            <span className="nav-tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
