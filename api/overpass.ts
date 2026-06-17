// Vercel serverless proxy — forwards Overpass queries server-to-server, avoiding CORS.
//
// Body parser is disabled so we can read the raw URL-encoded body and forward it
// to Overpass untouched. This avoids any re-encoding or header-forwarding that
// triggers Overpass's 406 Not Acceptable response.
/* eslint-disable @typescript-eslint/no-explicit-any */

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Read raw body from the incoming stream without any parsing
  let rawBody: string;
  try {
    rawBody = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: unknown) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', (err: unknown) => reject(err));
    });
  } catch {
    res.status(400).json({ error: 'Failed to read request body' });
    return;
  }

  if (!rawBody || !rawBody.includes('data=')) {
    res.status(400).json({ error: 'Missing data field in request body' });
    return;
  }

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 35_000);

  try {
    // Only set the two headers Overpass actually needs — no browser headers forwarded.
    // Explicit Accept avoids the 406 Not Acceptable that an implicit or mismatched
    // Accept header can trigger.
    const upstream = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: rawBody,
      signal: controller.signal,
    });

    if (!upstream.ok) {
      if (upstream.status === 429 || upstream.status === 504) {
        res.status(upstream.status).json({ error: 'Overpass is busy — try again in a moment' });
      } else {
        res.status(upstream.status).json({ error: `Overpass returned ${upstream.status}` });
      }
      return;
    }

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
