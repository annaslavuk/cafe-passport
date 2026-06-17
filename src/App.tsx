import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SplashScreen from './components/ui/SplashScreen';
import BottomNav from './components/layout/BottomNav';
import PassportPage from './pages/PassportPage';
import ShopDetailPage from './pages/ShopDetailPage';
import AddEditShopPage from './pages/AddEditShopPage';
import LogRunPage from './pages/LogRunPage';
import TimerPage from './pages/TimerPage';
import QuestsPage from './pages/QuestsPage';
import NearbyPage from './pages/NearbyPage';
import StatsPage from './pages/StatsPage';
import SeedBanner from './components/ui/SeedBanner';
import { getSettings } from './db/db';

export type TabId = 'passport' | 'log' | 'timer' | 'quests' | 'nearby' | 'stats';

export type NavAction =
  | { to: 'tab'; tab: TabId }
  | { to: 'shop-detail'; shopId: number }
  | { to: 'add-shop' }
  | { to: 'edit-shop'; shopId: number }
  | { to: 'log-run'; shopId?: number; prefillPomodoros?: number; prefillDurationMinutes?: number }
  | { to: 'back' };

export type NavFn = (action: NavAction) => void;

export type AppScreen =
  | { type: 'tab'; tab: TabId }
  | { type: 'shop-detail'; shopId: number }
  | { type: 'add-shop' }
  | { type: 'edit-shop'; shopId: number }
  | { type: 'log-run'; shopId?: number; prefillPomodoros?: number; prefillDurationMinutes?: number };

function activeTabForScreen(screen: AppScreen): TabId {
  if (screen.type === 'tab') return screen.tab;
  if (screen.type === 'log-run') return 'log';
  return 'passport';
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [history, setHistory] = useState<AppScreen[]>([{ type: 'tab', tab: 'passport' }]);
  const [slideDir, setSlideDir] = useState(0);

  const current = history[history.length - 1];

  useEffect(() => { getSettings(); }, []);

  const navigate: NavFn = useCallback((action) => {
    if (action.to === 'back') {
      setSlideDir(-1);
      setHistory(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
      return;
    }
    if (action.to === 'tab') {
      setSlideDir(0);
      setHistory([{ type: 'tab', tab: action.tab }]);
      return;
    }

    let next: AppScreen;
    if      (action.to === 'shop-detail') next = { type: 'shop-detail', shopId: action.shopId };
    else if (action.to === 'add-shop')    next = { type: 'add-shop' };
    else if (action.to === 'edit-shop')   next = { type: 'edit-shop', shopId: action.shopId };
    else /* log-run */                    next = { type: 'log-run', shopId: action.shopId, prefillPomodoros: action.prefillPomodoros, prefillDurationMinutes: action.prefillDurationMinutes };

    setSlideDir(1);
    setHistory(prev => [...prev, next]);
  }, []);

  const screenKey = JSON.stringify(current);

  return (
    <>
      <AnimatePresence>
        {!splashDone && (
          <SplashScreen key="splash" holdMs={2000} onDone={() => setSplashDone(true)} />
        )}
      </AnimatePresence>
      <div className="app-shell">
      <main className="page-content">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screenKey}
            initial={{ opacity: 0, x: slideDir * 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideDir * -30 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ minHeight: '100%' }}
          >
            <ActivePage screen={current} navigate={navigate} />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav
        activeTab={activeTabForScreen(current)}
        onTabChange={(tab) => navigate({ to: 'tab', tab })}
      />
      <SeedBanner />
    </div>
    </>
  );
}

function ActivePage({ screen, navigate }: { screen: AppScreen; navigate: NavFn }) {
  switch (screen.type) {
    case 'tab':
      switch (screen.tab) {
        case 'passport': return <PassportPage navigate={navigate} />;
        case 'log':      return <LogRunPage    navigate={navigate} />;
        case 'timer':    return <TimerPage     navigate={navigate} />;
        case 'quests':   return <QuestsPage    navigate={navigate} />;
        case 'nearby':   return <NearbyPage    navigate={navigate} />;
        case 'stats':    return <StatsPage     navigate={navigate} />;
      }
      break;
    case 'shop-detail':
      return <ShopDetailPage shopId={screen.shopId} navigate={navigate} />;
    case 'add-shop':
      return <AddEditShopPage navigate={navigate} />;
    case 'edit-shop':
      return <AddEditShopPage shopId={screen.shopId} navigate={navigate} />;
    case 'log-run':
      return <LogRunPage navigate={navigate} prefillShopId={screen.shopId} prefillPomodoros={screen.prefillPomodoros} prefillDurationMinutes={screen.prefillDurationMinutes} showBack />;
  }
}
