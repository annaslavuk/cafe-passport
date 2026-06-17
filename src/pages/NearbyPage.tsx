import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../db/db';
import type { Shop } from '../db/types';
import { priceDisplay } from '../db/types';
import type { NavFn } from '../App';

// ── Types ──────────────────────────────────────────────────────────────────

interface OsmCafe {
  id:    number;
  lat:   number;
  lon:   number;
  name:  string;
  addr?: string;
}

interface NominatimPlace {
  osm_id:       number;
  osm_type:     string;
  lat:          string;
  lon:          string;
  display_name: string;
  namedetails?: { name?: string };
  extratags?:   Record<string, string>;
}

interface Sheet {
  cafe: OsmCafe;
  shop: Shop | null;
}

// Below this zoom level the bbox is too large; show a warning instead.
const MIN_ZOOM = 13;

// ── Page ──────────────────────────────────────────────────────────────────

export default function NearbyPage({ navigate }: { navigate: NavFn }) {
  const mapDivRef  = useRef<HTMLDivElement>(null);
  const mapRef     = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  // Ref keeps myShops fresh inside stable searchArea callback without re-creating it
  const myShopsRef = useRef<Shop[]>([]);

  const [status,        setStatus]        = useState<'idle' | 'locating' | 'ready' | 'error'>('idle');
  const [errMsg,        setErrMsg]        = useState('');
  const [userPos,       setUserPos]       = useState<[number, number] | null>(null);
  const [sheet,         setSheet]         = useState<Sheet | null>(null);
  const [searching,     setSearching]     = useState(false);
  const [showSearchBtn, setShowSearchBtn] = useState(false);
  const [tooZoomedOut,  setTooZoomedOut]  = useState(false);
  const [resultCount,   setResultCount]   = useState<number | null>(null);
  const [searchErr,     setSearchErr]     = useState<string | null>(null);
  const [permDenied,   setPermDenied]   = useState(false);
  const [helpOpen,     setHelpOpen]     = useState(false);

  // Load passport shops; keep ref in sync for use inside searchArea
  useEffect(() => {
    db.shops.toArray().then(shops => { myShopsRef.current = shops; });
  }, []);

  // Geolocation — triggered by user tap, not on mount
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setErrMsg('Your browser doesn\'t support geolocation.');
      setPermDenied(false);
      setStatus('error');
      return;
    }
    setStatus('locating');
    setPermDenied(false);
    setHelpOpen(false);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setStatus('ready');
      },
      err => {
        const denied = err.code === err.PERMISSION_DENIED;
        setPermDenied(denied);
        setErrMsg(
          denied
            ? 'Location permission denied. Check your browser or device settings to re-enable it.'
            : err.code === err.POSITION_UNAVAILABLE
            ? 'Your location couldn\'t be determined. Make sure location services are enabled.'
            : 'Location request timed out. Please try again.'
        );
        setStatus('error');
      },
      { timeout: 10_000, enableHighAccuracy: false, maximumAge: 60_000 },
    );
  }, []);

  // ── Search current viewport ──────────────────────────────────────────────
  // Reads everything from refs so it stays stable (no deps → no map re-init).
  const searchArea = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    const zoom = map.getZoom();
    if (zoom < MIN_ZOOM) {
      setTooZoomedOut(true);
      return;
    }

    setTooZoomedOut(false);
    setSearching(true);
    setShowSearchBtn(false);
    setSearchErr(null);

    const b = map.getBounds();
    const [s, w, n, e] = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
    try {
      const results = await fetchCafesByBbox(s, w, n, e);

      // ── Stale-map guard ──────────────────────────────────────────────────
      // In React StrictMode, effects double-invoke. The first (stale) call can
      // finish AFTER the second call already painted markers, then wipe them
      // with the markersRef.forEach(remove) below. Bail out if the map was
      // swapped while we were awaiting.
      if (mapRef.current !== map) {
        console.log('[NearbyPage] map replaced during fetch — discarding stale results');
        return;
      }

      console.log(`[NearbyPage] painting ${results.length} markers on map`);
      setResultCount(results.length);

      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      const shops = myShopsRef.current;
      results.forEach(cafe => {
        const matched = findShop(cafe.name, shops);
        const marker = L.marker([cafe.lat, cafe.lon], { icon: matched ? visitedIcon() : newIcon() })
          .addTo(map)
          .on('click', () => setSheet({ cafe, shop: matched }));
        markersRef.current.push(marker);
      });
      console.log(`[NearbyPage] markersRef now has ${markersRef.current.length} entries`);
    } catch (e) {
      const msg = (e as Error).message;
      console.error('[NearbyPage] search failed:', msg);
      setSearchErr(msg);
    } finally {
      setSearching(false);
    }
  }, []); // stable — reads map/shops via refs

  // ── Leaflet map init ────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'ready' || !mapDivRef.current || !userPos) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const map = L.map(mapDivRef.current, { center: userPos, zoom: 15, zoomControl: true });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.marker(userPos, { icon: userDotIcon() }).addTo(map);

    mapRef.current = map;

    // Auto-search the initial viewport
    searchArea();

    // After a short settle, show "Search this area" whenever the user moves
    const tid = setTimeout(() => {
      map.on('moveend', () => {
        setShowSearchBtn(true);
        setTooZoomedOut(false);
      });
    }, 600);

    return () => {
      clearTimeout(tid);
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [status, userPos, searchArea]);

  const recenter = useCallback(() => {
    if (mapRef.current && userPos) mapRef.current.setView(userPos, 15, { animate: true });
  }, [userPos]);

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 'calc(100dvh - 56px)', overflow: 'hidden' }}>

      {/* Map — always in DOM so ref is stable */}
      <div ref={mapDivRef} style={{ width: '100%', height: '100%', minHeight: 'inherit' }} />

      {/* Pre-ready overlay — idle, locating, or error */}
      {status !== 'ready' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14,
          background: '#FDF6E9', zIndex: 1000,
        }}>
          {status === 'idle' && (
            <>
              <div style={{ fontSize: '2.8rem' }}>☕</div>
              <p style={{
                color: '#2C1A0E', fontWeight: 700, textAlign: 'center',
                padding: '0 32px', fontFamily: '"Playfair Display", Georgia, serif',
                lineHeight: 1.4, fontSize: '1.15rem', margin: 0,
              }}>
                Find cafés near you
              </p>
              <p style={{
                color: '#8B5E3C', textAlign: 'center', margin: '-4px 0 0',
                padding: '0 40px', fontFamily: '"Inter", system-ui, sans-serif',
                lineHeight: 1.55, fontSize: '0.84rem',
              }}>
                Tap below to see coffee shops around your current location.
              </p>
              <button
                onClick={requestLocation}
                style={{
                  marginTop: 6, padding: '11px 26px', background: '#6B3F1A', color: '#FDF6E9',
                  border: 'none', borderRadius: 999, fontWeight: 700, fontSize: '0.9rem',
                  cursor: 'pointer', fontFamily: '"Inter", system-ui, sans-serif',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                }}
              >
                📍 Find cafés near me
              </button>
            </>
          )}
          {status === 'locating' && (
            <>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{ fontSize: '2.5rem' }}
              >
                🌍
              </motion.div>
              <p style={{ color: '#8B5E3C', fontWeight: 600, fontFamily: '"Inter", system-ui, sans-serif' }}>
                Finding your location…
              </p>
            </>
          )}
          {status === 'error' && (
            <>
              <div style={{ fontSize: '2.8rem' }}>📍</div>
              <p style={{
                color: '#6B3F1A', fontWeight: 700, textAlign: 'center',
                padding: '0 32px', fontFamily: '"Inter", system-ui, sans-serif', lineHeight: 1.5,
                margin: 0,
              }}>
                {errMsg}
              </p>

              {permDenied && (
                <div style={{ width: '100%', maxWidth: 320, padding: '0 28px', boxSizing: 'border-box' }}>
                  <button
                    onClick={() => setHelpOpen(o => !o)}
                    style={{
                      display: 'block', margin: '0 auto',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#C27D38', fontFamily: '"Inter", system-ui, sans-serif',
                      fontSize: '0.8rem', fontWeight: 600, padding: '2px 0',
                      textDecoration: 'underline dotted',
                    }}
                  >
                    {helpOpen ? '▲ Hide instructions' : '▼ How do I enable this?'}
                  </button>

                  {helpOpen && (
                    <div style={{
                      marginTop: 10, background: '#F5EDD8', borderRadius: 12,
                      padding: '12px 14px', fontFamily: '"Inter", system-ui, sans-serif',
                    }}>
                      {([
                        {
                          label: 'iPhone · Safari',
                          text: 'Tap "aA" in the address bar → Website Settings → Location → Allow, then reload.',
                          note: 'Also: Settings → Privacy & Security → Location Services → On',
                        },
                        {
                          label: 'iPhone · Chrome',
                          text: 'iPhone Settings → Chrome → Location → While Using the App, then reload.',
                        },
                        {
                          label: 'Android · Chrome',
                          text: 'Tap the lock icon in the address bar → Permissions → Location → Allow, then reload.',
                        },
                        {
                          label: 'Computer · Chrome / Edge',
                          text: 'Click the icon at the left of the address bar → set Location to Allow, then reload.',
                        },
                      ] as { label: string; text: string; note?: string }[]).map(({ label, text, note }, i, arr) => (
                        <div key={label} style={{ marginBottom: i < arr.length - 1 ? 10 : 0 }}>
                          <div style={{
                            fontSize: '0.68rem', fontWeight: 700, color: '#8B5E3C',
                            letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2,
                          }}>
                            {label}
                          </div>
                          <div style={{ fontSize: '0.77rem', color: '#6B3F1A', lineHeight: 1.5 }}>
                            {text}
                          </div>
                          {note && (
                            <div style={{ fontSize: '0.7rem', color: '#8B5E3C', marginTop: 2, lineHeight: 1.4 }}>
                              {note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={requestLocation}
                style={{
                  marginTop: 4, padding: '9px 20px', background: '#6B3F1A', color: '#FDF6E9',
                  border: 'none', borderRadius: 999, fontWeight: 700, fontSize: '0.85rem',
                  cursor: 'pointer', fontFamily: '"Inter", system-ui, sans-serif',
                }}
              >
                Try again
              </button>
            </>
          )}
        </div>
      )}

      {/* Floating header */}
      {status === 'ready' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999,
          padding: '12px 16px',
          background: 'linear-gradient(to bottom, rgba(253,246,233,0.96) 60%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          pointerEvents: 'none',
        }}>
          <div>
            <div style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontWeight: 700, fontSize: '1.2rem', color: '#2C1A0E',
            }}>
              Nearby
            </div>
            <div style={{ fontSize: '0.72rem', color: '#8B5E3C', fontFamily: '"Inter", system-ui, sans-serif' }}>
              {searching
                ? 'Searching…'
                : resultCount === null
                  ? 'Pan or zoom to explore'
                  : `${resultCount} café${resultCount !== 1 ? 's' : ''} in this area`}
            </div>
          </div>
          <button
            onClick={recenter}
            style={{
              pointerEvents: 'auto',
              background: '#6B3F1A', color: '#FDF6E9',
              border: 'none', borderRadius: 999, padding: '7px 14px',
              fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
              fontFamily: '"Inter", system-ui, sans-serif',
              boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
            }}
          >
            ◎ Me
          </button>
        </div>
      )}

      {/* "Search this area" button */}
      <AnimatePresence>
        {status === 'ready' && (showSearchBtn || tooZoomedOut) && !searching && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute', top: 62, left: '50%', transform: 'translateX(-50%)',
              zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}
          >
            {tooZoomedOut ? (
              <div style={{
                background: 'rgba(253,246,233,0.95)', color: '#8B5E3C',
                padding: '7px 16px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                fontFamily: '"Inter", system-ui, sans-serif',
              }}>
                Zoom in to search
              </div>
            ) : (
              <button
                onClick={searchArea}
                style={{
                  background: '#6B3F1A', color: '#FDF6E9',
                  border: 'none', borderRadius: 999, padding: '8px 18px',
                  fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                  fontFamily: '"Inter", system-ui, sans-serif',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                }}
              >
                🔍 Search this area
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Searching spinner */}
      <AnimatePresence>
        {status === 'ready' && searching && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              position: 'absolute', top: 62, left: '50%', transform: 'translateX(-50%)',
              zIndex: 999,
              background: 'rgba(253,246,233,0.95)', color: '#8B5E3C',
              padding: '7px 16px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              fontFamily: '"Inter", system-ui, sans-serif', whiteSpace: 'nowrap',
            }}
          >
            ☕ Searching…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search error pill */}
      <AnimatePresence>
        {searchErr && !searching && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              position: 'absolute', top: 62, left: '50%', transform: 'translateX(-50%)',
              zIndex: 999, display: 'flex', alignItems: 'center', gap: 8,
              background: '#FDF0E0', border: '1.5px solid #C27D38',
              padding: '7px 14px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              fontFamily: '"Inter", system-ui, sans-serif', whiteSpace: 'nowrap',
              color: '#6B3F1A',
            }}
          >
            <span>⚠ {searchErr}</span>
            <button
              onClick={searchArea}
              style={{
                background: '#6B3F1A', color: '#FDF6E9', border: 'none',
                borderRadius: 999, padding: '3px 10px', fontSize: '0.7rem',
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      {status === 'ready' && (
        <div style={{
          position: 'absolute', bottom: 20, left: 12, zIndex: 999,
          background: 'rgba(253,246,233,0.93)', backdropFilter: 'blur(4px)',
          borderRadius: 10, padding: '7px 11px',
          fontSize: '0.7rem', color: '#6B3F1A', fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
          fontFamily: '"Inter", system-ui, sans-serif', lineHeight: 1.7,
        }}>
          <div>☕ In your passport</div>
          <div>📍 New spot</div>
        </div>
      )}

      {/* Café bottom sheet */}
      <AnimatePresence>
        {sheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSheet(null)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(44,26,14,0.4)', zIndex: 1000 }}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1001,
                background: '#FDF6E9', borderRadius: '20px 20px 0 0',
                padding: '16px 20px 40px',
              }}
            >
              <div style={{ width: 36, height: 4, background: '#D4A96A', borderRadius: 2, margin: '0 auto 16px' }} />

              <div style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontWeight: 700, fontSize: '1.18rem', color: '#2C1A0E', marginBottom: 4,
              }}>
                {sheet.cafe.name}
              </div>

              {sheet.cafe.addr && (
                <div style={{
                  fontSize: '0.8rem', color: '#8B5E3C', marginBottom: 14,
                  fontFamily: '"Inter", system-ui, sans-serif',
                }}>
                  {sheet.cafe.addr}
                </div>
              )}

              {sheet.shop ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: '0.78rem', color: '#6B8E23', fontWeight: 600, fontFamily: '"Inter", system-ui, sans-serif' }}>
                    ✓ In your passport · {sheet.shop.visitCount} visit{sheet.shop.visitCount !== 1 ? 's' : ''}
                    {sheet.shop.avgPriceLevel ? ` · ${priceDisplay(sheet.shop.avgPriceLevel)} avg` : ''}
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => { navigate({ to: 'shop-detail', shopId: sheet.shop!.id! }); setSheet(null); }}
                  >
                    View in Passport →
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: '0.78rem', color: '#C27D38', fontWeight: 600, fontFamily: '"Inter", system-ui, sans-serif' }}>
                    Not in your passport yet
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => { navigate({ to: 'add-shop' }); setSheet(null); }}
                  >
                    + Add to Passport
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Nominatim bbox fetch ───────────────────────────────────────────────────
// Nominatim (OpenStreetMap geocoding API) has CORS headers and accepts browser
// requests without any API key. Overpass blocks cross-origin browser requests
// and rejects data-center IPs, so we use Nominatim instead.

async function fetchCafesByBbox(
  south: number, west: number, north: number, east: number,
): Promise<OsmCafe[]> {
  // Nominatim viewbox: left,top,right,bottom = west,north,east,south
  const viewbox = `${west},${north},${east},${south}`;
  const base = `https://nominatim.openstreetmap.org/search?format=json&bounded=1&limit=50&extratags=1&namedetails=1&viewbox=${viewbox}`;

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 35_000);

  try {
    // Two parallel searches cover the main OSM tagging conventions for coffee shops
    const search = (params: string) =>
      fetch(`${base}&${params}`, { signal: controller.signal })
        .then(r => { if (!r.ok) throw new Error(`Nominatim ${r.status}`); return r.json() as Promise<NominatimPlace[]>; });

    const [cafes, coffeeShops] = await Promise.all([
      search('amenity=cafe'),
      search('shop=coffee'),
    ]);

    console.log(`[NearbyPage] Nominatim raw: ${cafes.length} cafes + ${coffeeShops.length} coffee shops`);

    const mapped: OsmCafe[] = [...cafes, ...coffeeShops].flatMap(p => {
      const name = p.namedetails?.name ?? p.display_name.split(',')[0].trim();
      const lat = parseFloat(p.lat);
      const lon = parseFloat(p.lon);
      if (!name || isNaN(lat) || isNaN(lon)) return [];
      const item: OsmCafe = { id: p.osm_id, lat, lon, name };
      const hn = p.extratags?.['addr:housenumber'];
      const st = p.extratags?.['addr:street'];
      if (hn && st) item.addr = `${hn} ${st}`;
      return [item];
    });

    const seen = new Set<string>();
    const results = mapped.filter(c => {
      const key = `${c.name.toLowerCase()}|${c.lat.toFixed(5)}|${c.lon.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[NearbyPage] after dedup: ${results.length}`);
    return results;
  } finally {
    clearTimeout(tid);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function findShop(osmName: string, shops: Shop[]): Shop | null {
  const n = osmName.toLowerCase();
  return shops.find(s => {
    const sn = s.name.toLowerCase();
    return sn === n || sn.includes(n) || n.includes(sn);
  }) ?? null;
}

function userDotIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:18px;height:18px;background:#4A90E2;border-radius:50%;border:3px solid white;box-shadow:0 0 0 3px rgba(74,144,226,0.35),0 2px 6px rgba(0,0,0,0.25)"></div>`,
    className: '', iconSize: [18, 18], iconAnchor: [9, 9],
  });
}

function visitedIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:30px;height:30px;background:#6B3F1A;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid #FDF6E9;box-shadow:0 2px 8px rgba(0,0,0,0.3)"><span style="display:block;transform:rotate(45deg);text-align:center;line-height:25px;font-size:13px">☕</span></div>`,
    className: '', iconSize: [30, 40], iconAnchor: [15, 40],
  });
}

function newIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:26px;height:26px;background:#D4A96A;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #6B3F1A;box-shadow:0 2px 6px rgba(0,0,0,0.2)"><span style="display:block;transform:rotate(45deg);text-align:center;line-height:22px;font-size:11px">📍</span></div>`,
    className: '', iconSize: [26, 36], iconAnchor: [13, 36],
  });
}
