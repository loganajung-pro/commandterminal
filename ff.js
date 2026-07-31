/**
 * Cloudflare Pages Function — ForexFactory CORS proxy.
 * Path in your repo:  functions/ff.js   → serves at  https://<your-site>.pages.dev/ff?url=<encoded FF url>
 * Because it's the SAME origin as your dashboard, there is no CORS to fight at all.
 *
 * In index.html, set:   const FF_PROXY='/ff?url=';
 */
const ALLOW = ['nfs.faireconomy.media'];   // host-locked — not an open proxy
const CACHE_SECONDS = 600;                  // 10-min edge cache

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });

  const target = new URL(request.url).searchParams.get('url');
  if (!target) return json({ error: 'missing ?url=' }, 400);

  let t;
  try { t = new URL(target); } catch { return json({ error: 'bad url' }, 400); }
  if (!ALLOW.includes(t.hostname)) return json({ error: 'host not allowed' }, 403);

  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), request);
  let resp = await cache.match(cacheKey);
  if (!resp) {
    const upstream = await fetch(t.toString(), {
      headers: { accept: 'application/json', 'user-agent': 'ff-pages-proxy' },
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
    });
    resp = new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        ...cors(),
        'content-type': 'application/json; charset=utf-8',
        'cache-control': `public, max-age=${CACHE_SECONDS}`,
      },
    });
    if (upstream.ok) context.waitUntil(cache.put(cacheKey, resp.clone()));
  }
  return resp;
}

const cors = () => ({
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': '*',
});
const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors(), 'content-type': 'application/json' } });
