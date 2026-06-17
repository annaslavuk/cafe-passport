// Vercel serverless proxy — forwards Overpass queries server-to-server, avoiding CORS.
// Accepts the same application/x-www-form-urlencoded body as Overpass itself
// so the Vite dev proxy can forward it transparently.
/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Vercel auto-parses URL-encoded bodies into req.body as { data: string }
  const query: string | undefined = req.body?.data;
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Missing data field in request body' });
    return;
  }

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 35_000);

  try {
    const upstream = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      if (upstream.status === 429 || upstream.status === 504) {
        res.status(upstream.status).json({ error: 'Overpass is busy — try again in a moment' });
      } else {
        res.status(upstream.status).send(text);
      }
      return;
    }

    // Stream the raw JSON back without re-parsing it
    const text = await upstream.text();
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(text);
  } catch (err) {
    const msg = (err as Error).name === 'AbortError'
      ? 'Overpass request timed out'
      : (err as Error).message ?? 'Proxy error';
    res.status(502).json({ error: msg });
  } finally {
    clearTimeout(tid);
  }
}
