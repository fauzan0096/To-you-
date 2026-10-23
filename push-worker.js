/*
  Connective push relay (Cloudflare Worker).
  It only wakes a phone up. It never sees chats or call audio.
  Needs one KV namespace bound with the variable name:  KV
*/
const enc = new TextEncoder();
const TOK = /^pc[a-z2-7]{20,40}$/;
// Only real browser push services are allowed, so nobody can use this worker as a proxy.
const HOSTS = /(^|\.)(googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;
const KINDS = { call: { ttl: 60, urgency: 'high' }, end: { ttl: 120, urgency: 'high' }, msg: { ttl: 86400, urgency: 'normal' } };

const b64u = (u) => btoa(String.fromCharCode(...new Uint8Array(u))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ub64 = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const hex = (u) => [...new Uint8Array(u)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400' };
const out = (body, status = 200, extra = {}) => new Response(body, { status, headers: { ...CORS, ...extra } });

async function getVapid(env) {
  let v = await env.KV.get('vapid', 'json');
  if (v && v.pub && v.priv) return v;
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  v = { pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)), priv: await crypto.subtle.exportKey('jwk', kp.privateKey) };
  await env.KV.put('vapid', JSON.stringify(v));
  return v;
}

async function vapidHeader(v, endpoint, subject) {
  const h = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const c = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', v.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(h + '.' + c));
  return 'vapid t=' + h + '.' + c + '.' + b64u(sig) + ', k=' + v.pub;
}

// RFC 8291 (aes128gcm) message encryption
async function encrypt(keys, plain) {
  const ua = ub64(keys.p256dh), auth = ub64(keys.auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256);
  const hkdf = async (salt, info, len, ikm) => new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), len * 8));
  const ikm = await hkdf(auth, cat(enc.encode('WebPush: info\0'), ua, asPub), 32, secret);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, enc.encode('Content-Encoding: aes128gcm\0'), 16, ikm);
  const nonce = await hkdf(salt, enc.encode('Content-Encoding: nonce\0'), 12, ikm);
  const ck = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, ck, cat(plain, new Uint8Array([2]))));
  const hdr = new Uint8Array(21 + 65);
  hdr.set(salt, 0); new DataView(hdr.buffer).setUint32(16, 4096); hdr[20] = 65; hdr.set(asPub, 21);
  return cat(hdr, ct);
}

const hits = new Map(); // best-effort rate limit per token (resets when the worker restarts)
function limited(tok) {
  const now = Date.now(), a = (hits.get(tok) || []).filter((t) => now - t < 60000);
  a.push(now); hits.set(tok, a);
  if (hits.size > 5000) hits.clear();
  return a.length > 30;
}

function okSub(sub) {
  try {
    const u = new URL(sub.endpoint);
    return u.protocol === 'https:' && HOSTS.test(u.hostname) && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string'
      && ub64(sub.keys.p256dh).length === 65 && ub64(sub.keys.auth).length === 16;
  } catch (e) { return false; }
}

async function json(req) { try { return JSON.parse(await req.text()); } catch (e) { return null; } }

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return out(null, 204);
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '');
    try {
      if (req.method === 'GET' && path === '/vapid') return out((await getVapid(env)).pub, 200, { 'content-type': 'text/plain' });
      if (req.method === 'GET' && (path === '' || path === '/')) return out('Connective push relay is running.', 200, { 'content-type': 'text/plain' });

      if (req.method === 'POST' && path === '/register') {
        const b = await json(req);
        if (!b || !TOK.test(b.tok || '') || typeof b.sec !== 'string' || b.sec.length < 16 || b.sec.length > 100 || !b.sub || !okSub(b.sub)) return out('bad request', 400);
        const sh = await sha(b.sec), old = await env.KV.get('s:' + b.tok, 'json');
        if (old && old.sh !== sh) return out('token taken', 403);
        await env.KV.put('s:' + b.tok, JSON.stringify({ sub: { endpoint: b.sub.endpoint, keys: { p256dh: b.sub.keys.p256dh, auth: b.sub.keys.auth } }, sh }), { expirationTtl: 90 * 86400 });
        return out('ok');
      }

      if (req.method === 'POST' && path === '/unregister') {
        const b = await json(req);
        if (!b || !TOK.test(b.tok || '') || typeof b.sec !== 'string') return out('bad request', 400);
        const old = await env.KV.get('s:' + b.tok, 'json');
        if (old && old.sh === await sha(b.sec)) await env.KV.delete('s:' + b.tok);
        return out('ok');
      }

      const m = /^\/ring\/([a-z0-9]+)$/.exec(path);
      if (req.method === 'POST' && m && TOK.test(m[1])) {
        if (limited(m[1])) return out('slow down', 429);
        const b = (await json(req)) || {};
        const k = KINDS[b.k] ? b.k : 'msg';
        const rec = await env.KV.get('s:' + m[1], 'json');
        if (!rec) return out('unknown', 404);
        const v = await getVapid(env);
        const payload = enc.encode(JSON.stringify({ k, n: String(b.n || '').slice(0, 30), v: b.v ? 1 : 0 }));
        const r = await fetch(rec.sub.endpoint, {
          method: 'POST',
          headers: {
            Authorization: await vapidHeader(v, rec.sub.endpoint, 'https://' + url.host),
            'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
            TTL: String(KINDS[k].ttl), Urgency: KINDS[k].urgency,
          },
          body: await encrypt(rec.sub.keys, payload),
        });
        if (r.status === 404 || r.status === 410) { await env.KV.delete('s:' + m[1]); return out('gone', 410); }
        return out(r.ok ? 'sent' : 'push service said ' + r.status, r.ok ? 200 : 502);
      }
      return out('not found', 404);
    } catch (e) {
      return out('error', 500);
    }
  },
};
