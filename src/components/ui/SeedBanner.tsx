import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hasSeedData, seedDemoData, clearAllData } from '../../db/seed';

export default function SeedBanner() {
  const [isEmpty, setIsEmpty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    hasSeedData().then(has => setIsEmpty(!has));
  }, []);

  const handleLoad = async () => {
    setLoading(true);
    await seedDemoData();
    setLoading(false);
    setIsEmpty(false);
    window.location.reload();
  };

  const handleClear = async () => {
    if (!confirm('Clear all demo data?')) return;
    await clearAllData();
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {isEmpty && !dismissed && (
        <motion.div
          className="seed-banner"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        >
          <span>☕ Passport is empty</span>
          <button onClick={handleLoad} disabled={loading}>
            {loading ? 'Loading…' : 'Load demo data'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{ background: 'transparent', border: '1px solid rgba(253,246,233,0.3)', color: '#D4A96A', padding: '5px 8px' }}
          >
            ✕
          </button>
        </motion.div>
      )}
      {!isEmpty && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0 }}
        >
          {/* Hidden trigger for dev — double-tap to clear */}
          <button
            style={{ position: 'fixed', bottom: 60, right: 0, opacity: 0, width: 24, height: 24, zIndex: 100 }}
            onDoubleClick={handleClear}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
