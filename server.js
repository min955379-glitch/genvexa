import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 4173);
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '6mb' }));

const dataDir = path.join(__dirname, 'data');
const publicDir = path.join(__dirname, 'public');
try { fs.mkdirSync(dataDir, { recursive: true }); } catch { /* read-only serverless bundle */ }
try { fs.mkdirSync(path.join(publicDir, 'images'), { recursive: true }); } catch { /* static files are bundled */ }

const now = Date.now();
const rawSupabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_URL = rawSupabaseUrl && rawSupabaseUrl.startsWith('http') ? rawSupabaseUrl : rawSupabaseUrl ? `https://${rawSupabaseUrl}.supabase.co` : '';
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
let supabaseAdmin = null;
try { if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }); } catch (error) { console.error('Supabase server client is not configured:', error.message); }
const ADMIN_USERNAME = String(process.env.GENVEXA_ADMIN_USERNAME || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.GENVEXA_ADMIN_PASSWORD || '');
const LEGACY_AUTH_ENABLED = Boolean(!supabaseAdmin && process.env.ENABLE_LEGACY_AUTH === 'true' && ADMIN_USERNAME && ADMIN_PASSWORD);
const SESSION_SECRET = String(process.env.GENVEXA_SESSION_SECRET || (LEGACY_AUTH_ENABLED ? crypto.randomBytes(32).toString('hex') : 'supabase-managed-session'));
const SESSION_COOKIE = 'genvexa_session';
const SESSION_MAX_AGE = 60 * 60 * 8;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_VIDEO_BYTES = 3 * 1024 * 1024;
const ALLOWED_MEDIA_HOSTS = new Set(['images.meigen.ai', 'cdn.faymas.in', 'pbs.twimg.com']);
const loginFailures = new Map();
const revokedSessions = new Map();

function load(name, fallback) {
  const file = path.join(dataDir, `${name}.json`);
  if (!fs.existsSync(file)) {
    try { fs.writeFileSync(file, JSON.stringify(fallback, null, 2)); } catch { /* bundled fallback */ }
  }
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function save(name, value) {
  try { fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(value, null, 2)); } catch { /* Vercel filesystem is ephemeral/read-only */ }
}
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(String(password), salt, 64).toString('hex')}`;
}
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  try {
    const [salt, hash] = stored.split(':');
    const actual = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}
function safeUser(user) {
  if (!user) return null;
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}
function getCookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((all, pair) => {
    const index = pair.indexOf('=');
    if (index < 0) return all;
    const key = pair.slice(0, index).trim();
    all[key] = decodeURIComponent(pair.slice(index + 1).trim());
    return all;
  }, {});
}
function signSession(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}
function readSession(req) {
  const cookies = getCookies(req);
  const token = cookies[SESSION_COOKIE] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  try {
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    const revokedUntil = revokedSessions.get(payload.jti);
    if (revokedUntil && revokedUntil > Date.now()) return null;
    if (revokedUntil) revokedSessions.delete(payload.jti);
    return payload;
  } catch { return null; }
}
function setSessionCookie(res, token) {
  const secure = isProduction || process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`);
}
function clearSessionCookie(res) {
  const secure = isProduction || process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`);
}
function makeSession(user) {
  const issuedAt = Math.floor(Date.now() / 1000);
  return signSession({ sub: user.id, role: user.role, iat: issuedAt, exp: issuedAt + SESSION_MAX_AGE, jti: crypto.randomUUID() });
}
function initials(name = '') { return String(name).split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'GX'; }
function findPrompt(id) { return prompts.find(prompt => prompt.id === id); }
function findUser(id) { return users.find(user => user.id === id); }
function normalizeModel(value) {
  const model = String(value || '').trim();
  const low = model.toLowerCase().replace(/\s/g, '');
  if (low.includes('nano')) return 'Nano Banana';
  if (low.includes('gpt') || low.includes('chatgpt')) return 'GPT Image';
  if (low.includes('seedance')) return 'Seedance';
  if (low.includes('midjourney')) return 'Midjourney';
  if (low.includes('gemini')) return 'Gemini';
  return model || 'GPT Image';
}
function cleanTitle(title, prompt = '') {
  let value = String(title || '').replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s+/g, ' ').trim();
  const invalid = new Set(['{', '[', ']', '[Main Roles]', 'undefined', 'null', '']);
  if (invalid.has(value) || value.length < 3 || /^\{?\s*\"?\w+\"?\s*:/.test(value) || value === String(prompt || '').trim()) {
    value = String(prompt || '').split(/\r?\n/).map(line => line.trim()).find(Boolean) || 'Untitled prompt';
    value = value.replace(/^(Create image|Create an image|Prompt:|Image prompt:)\s*/i, '');
  }
  if (value.length > 96) value = `${value.slice(0, 92).replace(/\s+\S*$/, '')}…`;
  return value || 'Untitled prompt';
}
function mediaUrl(value) {
  if (!value || typeof value !== 'string' || value.startsWith('/') || value.startsWith('data:')) return value;
  try {
    const url = new URL(value);
    if (ALLOWED_MEDIA_HOSTS.has(url.hostname)) return `/api/media?url=${encodeURIComponent(value)}`;
  } catch { /* keep malformed external values unchanged for validation/fallback */ }
  return value;
}
function publicPrompt(prompt) {
  const images = Array.isArray(prompt.images) && prompt.images.length ? prompt.images : (prompt.image ? [prompt.image] : []);
  return {
    ...prompt,
    title: cleanTitle(prompt.title, prompt.prompt),
    model: normalizeModel(prompt.model),
    image: mediaUrl(prompt.image || images[0] || '/images/prompt-01.png'),
    images: images.map(mediaUrl),
    poster: mediaUrl(prompt.poster || prompt.image || images[0]),
    video: mediaUrl(prompt.video),
    tags: Array.isArray(prompt.tags) ? prompt.tags : [],
    creator: prompt.creator || { name: 'Genvexa Creator', handle: '@creator', avatar: 'GC', color: '#7561d8' }
  };
}
function adminPrompt(prompt) {
  const item = publicPrompt(prompt);
  return {
    id: item.id, title: item.title, excerpt: item.excerpt, image: item.image, poster: item.poster,
    video: item.video, mediaType: item.mediaType, model: item.model, category: item.category,
    creator: item.creator, likes: item.likes || 0, copies: item.copies || 0, views: item.views || 0,
    featured: Boolean(item.featured), status: item.status, ratio: item.ratio, createdAt: item.createdAt,
    sourceUrl: item.sourceUrl, imageCount: item.images?.length || 0
  };
}
function parsePageParam(value, fallback, maximum, name) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) throw new Error(`${name} must be a non-negative integer`);
  const parsed = Number(value);
  if ((name === 'limit' && parsed < 1) || (name !== 'limit' && parsed < 0) || parsed > maximum) throw new Error(`${name} is outside the allowed range`);
  return parsed;
}
function validateDataAsset(value, kind) {
  if (!value || !String(value).startsWith('data:')) return null;
  const [header, payload] = String(value).split(',', 2);
  const isImage = kind === 'image';
  const pattern = isImage ? /^data:image\/(png|jpe?g|webp|gif);base64$/i : /^data:video\/(mp4|webm|quicktime|ogg);base64$/i;
  if (!pattern.test(header || '') || !payload) return `Please upload a valid ${isImage ? 'image' : 'video'} file.`;
  try {
    const bytes = Buffer.from(payload, 'base64').length;
    const max = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (bytes > max) return `${isImage ? 'Image' : 'Video'} must be ${isImage ? '2 MB' : '3 MB'} or smaller.`;
  } catch { return `The uploaded ${isImage ? 'image' : 'video'} could not be read.`; }
  return null;
}
function bearerToken(req) { return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim(); }
function profileUser(authUser, profile = {}) {
  const email = authUser.email || profile.email || '';
  const name = profile.full_name || authUser.user_metadata?.full_name || email.split('@')[0] || 'Genvexa user';
  return { id: authUser.id, name, username: profile.username || authUser.user_metadata?.username || email.split('@')[0], email, avatar: profile.avatar_url || initials(name), avatarUrl: profile.avatar_url || null, role: profile.role || 'user', status: profile.status || 'active', joinedAt: profile.created_at || authUser.created_at, updatedAt: profile.updated_at, lastSignInAt: profile.last_sign_in_at || authUser.last_sign_in_at, emailVerifiedAt: profile.email_verified_at || authUser.email_confirmed_at || null, authProvider: profile.auth_provider || authUser.app_metadata?.provider || 'email', favorites: [] };
}
async function getSupabaseContext(req) {
  if (!supabaseAdmin) return null;
  const token = bearerToken(req);
  if (!token) return null;
  const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authUser) return null;
  let { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('id,full_name,username,email,avatar_url,role,status,created_at,updated_at,last_sign_in_at,email_verified_at,auth_provider').eq('id', authUser.id).maybeSingle();
  if (profileError) return { authUser, profile: null, profileError };
  if (!profile) {
    const { data: created, error: createError } = await supabaseAdmin.from('profiles').insert({ id: authUser.id, full_name: authUser.user_metadata?.full_name || '', username: authUser.user_metadata?.username || (authUser.email || '').split('@')[0], email: authUser.email || '', auth_provider: authUser.app_metadata?.provider || 'email', email_verified_at: authUser.email_confirmed_at || null }).select().single();
    if (!createError) return { authUser, profile: created };
  }
  const signInUpdate = {};
  if (authUser.email_confirmed_at && !profile?.email_verified_at) signInUpdate.email_verified_at = authUser.email_confirmed_at;
  if (authUser.last_sign_in_at && profile?.last_sign_in_at !== authUser.last_sign_in_at) signInUpdate.last_sign_in_at = authUser.last_sign_in_at;
  if (profile && Object.keys(signInUpdate).length) {
    const { data: updatedProfile } = await supabaseAdmin.from('profiles').update(signInUpdate).eq('id', authUser.id).select().single();
    profile = updatedProfile || { ...profile, ...signInUpdate };
  }
  return { authUser, profile };
}
async function requireUser(req, res, next) {
  if (supabaseAdmin) {
    const context = await getSupabaseContext(req);
    if (context?.profileError) return res.status(503).json({ error: 'Account data is not configured. Run the Supabase schema first.' });
    if (!context) return res.status(401).json({ error: 'Sign in is required' });
    const user = profileUser(context.authUser, context.profile);
    if (user.status !== 'active') return res.status(403).json({ error: 'This account is not active.' });
    req.user = user; req.authUser = context.authUser; return next();
  }
  if (!LEGACY_AUTH_ENABLED) return res.status(503).json({ error: 'Authentication is not configured for this deployment.' });
  const session = readSession(req); const user = session?.sub ? findUser(session.sub) : null;
  if (!session || !user || user.status !== 'active') return res.status(401).json({ error: 'Sign in is required' });
  req.user = user; req.session = session; return next();
}
async function requireAdmin(req, res, next) {
  if (supabaseAdmin) {
    const context = await getSupabaseContext(req);
    if (context?.profileError) return res.status(503).json({ error: 'Account data is not configured. Run the Supabase schema first.' });
    if (!context) return res.status(401).json({ error: 'Admin authentication required' });
    const user = profileUser(context.authUser, context.profile);
    if (user.role !== 'admin' || user.status !== 'active') return res.status(403).json({ error: 'Admin access is required.' });
    req.user = user; req.authUser = context.authUser; return next();
  }
  if (!LEGACY_AUTH_ENABLED) return res.status(503).json({ error: 'Authentication is not configured for this deployment.' });
  const session = readSession(req); const user = session?.sub ? findUser(session.sub) : null;
  if (!session || session.role !== 'admin' || !user || user.role !== 'admin' || user.status !== 'active') return res.status(401).json({ error: 'Admin authentication required' });
  req.user = user; req.session = session; return next();
}
function loginKey(req, loginId) { return `${req.ip || 'unknown'}:${loginId}`; }
function loginRateLimit(req, loginId) {
  const key = loginKey(req, loginId);
  const recent = (loginFailures.get(key) || []).filter(time => time > Date.now() - 10 * 60 * 1000);
  loginFailures.set(key, recent);
  return recent.length >= 5;
}
function failedLogin(req, loginId) {
  const key = loginKey(req, loginId);
  const recent = (loginFailures.get(key) || []).filter(time => time > Date.now() - 10 * 60 * 1000);
  recent.push(Date.now());
  loginFailures.set(key, recent);
}
function successfulLogin(req, loginId) { loginFailures.delete(loginKey(req, loginId)); }

let prompts = load('prompts', []);
let users = load('users', [
  { id: 'u_admin', name: 'Ava Chen', username: ADMIN_USERNAME, email: `${ADMIN_USERNAME}@genvexa.local`, role: 'admin', status: 'active', avatar: 'AC', joinedAt: now, favorites: [] }
]);
let activities = load('activities', []);
if (!prompts.length) prompts = [{ id: 'starter_01', title: 'A quiet editorial still life', excerpt: 'A clean starter prompt for the gallery.', prompt: 'Create a quiet editorial still life with soft daylight and tactile materials.', image: '/images/prompt-01.png', images: ['/images/prompt-01.png'], mediaType: 'image', model: 'GPT Image', category: 'Ads & Product', tags: ['editorial'], creator: { name: 'Genvexa', handle: '@genvexa', avatar: 'GX', color: '#7561d8' }, likes: 0, copies: 0, views: 0, featured: true, status: 'published', ratio: '4:5', createdAt: now, sourceUrl: '/' }];
prompts = prompts.map(prompt => ({ ...prompt, title: cleanTitle(prompt.title, prompt.prompt), model: normalizeModel(prompt.model), mediaType: prompt.mediaType || (prompt.video ? 'video' : 'image'), images: Array.isArray(prompt.images) && prompt.images.length ? prompt.images : (prompt.image ? [prompt.image] : []), tags: Array.isArray(prompt.tags) ? prompt.tags : [] }));
const adminUser = LEGACY_AUTH_ENABLED ? (users.find(user => user.role === 'admin') || users[0]) : null;
if (adminUser) {
  adminUser.role = 'admin';
  adminUser.username = ADMIN_USERNAME;
  adminUser.email = `${ADMIN_USERNAME}@genvexa.local`;
  adminUser.status = 'active';
  if (!adminUser.passwordHash) adminUser.passwordHash = hashPassword(ADMIN_PASSWORD);
}


const productionCsp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://images.meigen.ai https://cdn.faymas.in https://pbs.twimg.com; media-src 'self' https://images.meigen.ai https://cdn.faymas.in blob:; connect-src 'self' wss:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', isProduction || process.env.VERCEL ? productionCsp : "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://images.meigen.ai https://cdn.faymas.in https://pbs.twimg.com; media-src 'self' https://images.meigen.ai https://cdn.faymas.in blob:; connect-src 'self' ws: http://localhost:*; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (req.path.startsWith('/api/')) { res.setHeader('Cache-Control', 'no-store, private'); res.setHeader('Pragma', 'no-cache'); }
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'genvexa-gallery-studio', version: '2.0' }));

app.get('/api/media', async (req, res) => {
  try {
    const target = new URL(String(req.query.url || ''));
    if (!ALLOWED_MEDIA_HOSTS.has(target.hostname)) return res.status(400).json({ error: 'Media host is not allowed' });
    const headers = { 'User-Agent': 'Googlebot', 'Accept': req.headers.range ? '*/*' : 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' };
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await fetch(target, { headers, redirect: 'follow' });
    if (!upstream.ok || !upstream.body) return res.status(404).type('text/plain').send('Media unavailable');
    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    const length = upstream.headers.get('content-length');
    const range = upstream.headers.get('content-range');
    if (contentType) res.setHeader('Content-Type', contentType);
    if (length) res.setHeader('Content-Length', length);
    if (range) res.setHeader('Content-Range', range);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    Readable.fromWeb(upstream.body).pipe(res);
  } catch { res.status(400).json({ error: 'Invalid media URL' }); }
});

app.get('/api/auth/session', async (req, res) => {
  if (supabaseAdmin) {
    const context = await getSupabaseContext(req);
    if (context?.profileError) return res.status(503).json({ error: 'Account data is not configured. Run the Supabase schema first.' });
    if (!context) return res.status(401).json({ error: 'No active session' });
    const user = profileUser(context.authUser, context.profile);
    if (user.status !== 'active') return res.status(403).json({ error: 'This account is not active.' });
    return res.json({ user });
  }
  if (!LEGACY_AUTH_ENABLED) return res.status(503).json({ error: 'Authentication is not configured for this deployment.' });
  const session = readSession(req); const user = session?.sub ? findUser(session.sub) : null;
  if (!session || !user || user.status !== 'active') return res.status(401).json({ error: 'No active session' });
  return res.json({ user: safeUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  if (supabaseAdmin) return res.status(400).json({ error: 'Use the Supabase Auth client for sign in.' });
  if (!LEGACY_AUTH_ENABLED) return res.status(503).json({ error: 'Authentication is not configured for this deployment.' });
  const loginId = String(req.body?.username || req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!loginId || !password) return res.status(400).json({ error: 'Username/email and password are required' });
  if (loginRateLimit(req, loginId)) return res.status(429).set('Retry-After', '600').json({ error: 'Too many sign-in attempts. Try again later.' });
  const user = users.find(item => item.username?.toLowerCase() === loginId || item.email?.toLowerCase() === loginId);
  const valid = user && user.status === 'active' && (user.role === 'admin' ? loginId === ADMIN_USERNAME && password === ADMIN_PASSWORD : verifyPassword(password, user.passwordHash));
  if (!valid) { failedLogin(req, loginId); return res.status(401).json({ error: 'Invalid username or password' }); }
  successfulLogin(req, loginId); setSessionCookie(res, makeSession(user)); return res.json({ user: safeUser(user) });
});

app.post('/api/auth/register', (req, res) => {
  if (supabaseAdmin) return res.status(400).json({ error: 'Use the Supabase Auth client for registration.' });
  if (!LEGACY_AUTH_ENABLED) return res.status(503).json({ error: 'Authentication is not configured for this deployment.' });
  const username = String(req.body?.username || '').trim().toLowerCase();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!/^[a-z0-9_]{3,30}$/.test(username) || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: 'Use a valid username, email, and password of at least 8 characters.' });
  if (username === ADMIN_USERNAME || users.some(user => user.username?.toLowerCase() === username || user.email?.toLowerCase() === email)) return res.status(409).json({ error: 'That username or email is already in use.' });
  const user = { id: `u_${crypto.randomUUID()}`, name: username.replace(/[_-]/g, ' '), username, email, passwordHash: hashPassword(password), role: 'member', status: 'active', avatar: username.slice(0, 2).toUpperCase(), joinedAt: Date.now(), favorites: [] };
  users.push(user); save('users', users); addActivity('signup', `${user.name} joined the community`); setSessionCookie(res, makeSession(user)); return res.status(201).json({ user: safeUser(user) });
});

app.post('/api/auth/logout', (req, res) => { if (supabaseAdmin) return res.status(204).end(); const session = readSession(req); if (session?.jti) revokedSessions.set(session.jti, session.exp * 1000); clearSessionCookie(res); res.status(204).end(); });

app.get('/api/prompts', (req, res) => {
  try {
    const model = String(req.query.model || 'All');
    const category = String(req.query.category || 'All');
    const sort = String(req.query.sort || 'featured');
    const search = String(req.query.search || '').trim();
    if (search.length > 100) return res.status(400).json({ error: 'Search query is too long' });
    const limit = parsePageParam(req.query.limit, 28, 60, 'limit');
    const offset = parsePageParam(req.query.offset, 0, 1000000, 'offset');
    let result = prompts.filter(prompt => prompt.status === 'published');
    if (model !== 'All') result = result.filter(prompt => normalizeModel(prompt.model).toLowerCase().replace(/\s/g, '').includes(model.toLowerCase().replace(/\s/g, '')));
    if (category !== 'All') result = result.filter(prompt => prompt.category === category);
    if (search) { const needle = search.toLowerCase(); result = result.filter(prompt => `${prompt.title} ${prompt.excerpt} ${prompt.prompt} ${prompt.category} ${prompt.model} ${prompt.creator?.name || ''} ${(prompt.tags || []).join(' ')}`.toLowerCase().includes(needle)); }
    if (sort === 'newest') result.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    else if (sort === 'popular') result.sort((a, b) => (Number(b.likes || 0) + Number(b.copies || 0) / 2 + Number(b.views || 0) / 100) - (Number(a.likes || 0) + Number(a.copies || 0) / 2 + Number(a.views || 0) / 100));
    else result.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.createdAt || 0) - Number(a.createdAt || 0));
    const total = result.length;
    const page = result.slice(offset, offset + limit);
    res.json({ prompts: page.map(publicPrompt), total, offset, limit, hasMore: offset + page.length < total });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.get('/api/prompts/:id', (req, res) => {
  const prompt = findPrompt(req.params.id);
  if (!prompt || prompt.status !== 'published') return res.status(404).json({ error: 'Prompt not found' });
  prompt.views = Number(prompt.views || 0) + 1; save('prompts', prompts);
  res.json({ prompt: publicPrompt(prompt) });
});

app.post('/api/prompts/:id/copy', requireUser, (req, res) => {
  const prompt = findPrompt(req.params.id);
  if (!prompt || prompt.status !== 'published') return res.status(404).json({ error: 'Prompt not found' });
  prompt.copies = Number(prompt.copies || 0) + 1; save('prompts', prompts); addActivity('copy', `${req.user.name} copied “${cleanTitle(prompt.title, prompt.prompt)}”`, prompt.id);
  res.json({ ok: true, copies: prompt.copies });
});

app.post('/api/prompts/:id/like', requireUser, (req, res) => {
  const prompt = findPrompt(req.params.id);
  if (!prompt || prompt.status !== 'published') return res.status(404).json({ error: 'Prompt not found' });
  const liked = Boolean(req.body?.liked); prompt.likes = Math.max(0, Number(prompt.likes || 0) + (liked ? 1 : -1)); save('prompts', prompts);
  res.json({ ok: true, liked, likes: prompt.likes });
});

app.post('/api/prompts/:id/favorite', requireUser, (req, res) => {
  const prompt = findPrompt(req.params.id);
  if (!prompt || prompt.status !== 'published') return res.status(404).json({ error: 'Prompt not found' });
  const favorite = Boolean(req.body?.favorite); req.user.favorites = Array.isArray(req.user.favorites) ? req.user.favorites : [];
  if (favorite && !req.user.favorites.includes(prompt.id)) req.user.favorites.push(prompt.id);
  if (!favorite) req.user.favorites = req.user.favorites.filter(id => id !== prompt.id);
  save('users', users); res.json({ ok: true, favorite, favorites: req.user.favorites });
});

function createPromptHandler(req, res) {
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const promptText = String(body.prompt || '').trim();
  if (!title || title.length > 120 || !promptText || promptText.length > 20000) return res.status(400).json({ error: 'Title and prompt are required and must be within the allowed length.' });
  const imageError = validateDataAsset(body.image, 'image');
  const videoError = validateDataAsset(body.video, 'video');
  if (imageError || videoError) return res.status(413).json({ error: imageError || videoError });
  const creator = req.user?.role === 'admin' && body.creator ? body.creator : { name: req.user.name, handle: req.user.username ? `@${req.user.username}` : '@member', avatar: req.user.avatar || 'ME', color: '#7561d8' };
  const item = { id: `community_${crypto.randomUUID()}`, title: cleanTitle(title, promptText), excerpt: promptText.slice(0, 150), prompt: promptText, image: body.image || '/images/prompt-01.png', images: body.image ? [body.image] : ['/images/prompt-01.png'], poster: body.poster || body.image || '/images/prompt-01.png', video: body.video || null, mediaType: body.mediaType || (body.video ? 'video' : 'image'), model: normalizeModel(body.model), category: body.category || 'Ads & Product', tags: Array.isArray(body.tags) ? body.tags.slice(0, 12) : [], creator, likes: 0, copies: 0, views: 0, featured: false, status: req.user.role === 'admin' && body.status === 'published' ? 'published' : 'pending', ratio: body.ratio || '4:5', createdAt: Date.now(), sourceUrl: body.sourceUrl || '/' };
  prompts.unshift(item); save('prompts', prompts); addActivity('publish', `${creator.name} submitted “${item.title}”`, item.id);
  res.status(201).json({ prompt: publicPrompt(item) });
}
app.post('/api/prompts', requireUser, createPromptHandler);

app.use('/api/admin', (req, res, next) => req.method === 'OPTIONS' ? res.status(204).end() : next());
app.use('/api/admin', (req, res, next) => req.method === 'OPTIONS' ? res.status(204).end() : next());
app.use('/api/admin', requireAdmin);
app.post('/api/admin/prompts', createPromptHandler);
app.post('/api/admin/save', (req, res) => {
  const deletedPromptIds = Array.isArray(req.body?.deletedPromptIds) ? req.body.deletedPromptIds : [];
  if (!supabaseAdmin && deletedPromptIds.length) prompts = prompts.filter(prompt => !deletedPromptIds.includes(prompt.id));
  save('prompts', prompts); save('users', users); save('activities', activities);
  res.json({ ok: true, savedAt: new Date().toISOString(), deleted: deletedPromptIds.length });
});
async function supabaseCount(queryBuilder) {
  const { count, error } = await queryBuilder;
  if (error) throw error;
  return Number(count || 0);
}
async function writeAudit(action, actorId, targetUserId, metadata = {}, success = true) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('admin_audit_log').insert({ actor_id: actorId, action, target_user_id: targetUserId || null, metadata, success });
}
app.get('/api/admin/stats', async (_req, res) => {
  try {
    if (supabaseAdmin) {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [usersCount, verifiedCount, unverifiedCount, newUsersCount, creatorsCount] = await Promise.all([
        supabaseCount(supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true })),
        supabaseCount(supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).not('email_verified_at', 'is', null)),
        supabaseCount(supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).is('email_verified_at', null)),
        supabaseCount(supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo)),
        supabaseCount(supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'creator').eq('status', 'active'))
      ]);
      const published = prompts.filter(prompt => prompt.status === 'published');
      return res.json({ stats: { prompts: published.length, users: usersCount, creators: creatorsCount, verifiedUsers: verifiedCount, unverifiedUsers: unverifiedCount, newUsers: newUsersCount, pending: prompts.filter(prompt => prompt.status === 'pending').length, copies: prompts.reduce((sum, prompt) => sum + Number(prompt.copies || 0), 0), views: prompts.reduce((sum, prompt) => sum + Number(prompt.views || 0), 0), featured: prompts.filter(prompt => prompt.featured).length } });
    }
    const published = prompts.filter(prompt => prompt.status === 'published');
    return res.json({ stats: { prompts: published.length, users: users.length, creators: users.filter(user => user.role === 'creator' && user.status === 'active').length, pending: prompts.filter(prompt => prompt.status === 'pending').length, copies: prompts.reduce((sum, prompt) => sum + Number(prompt.copies || 0), 0), views: prompts.reduce((sum, prompt) => sum + Number(prompt.views || 0), 0), featured: prompts.filter(prompt => prompt.featured).length } });
  } catch (error) { return res.status(500).json({ error: 'Unable to load admin statistics.' }); }
});
app.get('/api/admin/prompts', (req, res) => {
  try {
    const q = String(req.query.search || '').trim().toLowerCase();
    const status = String(req.query.status || 'all');
    const limit = parsePageParam(req.query.limit, 25, 50, 'limit');
    const offset = parsePageParam(req.query.offset, 0, 1000000, 'offset');
    let result = prompts.slice();
    if (status !== 'all') result = result.filter(prompt => prompt.status === status);
    if (q.length > 100) return res.status(400).json({ error: 'Search query is too long' });
    if (q) result = result.filter(prompt => `${prompt.title} ${prompt.creator?.name || ''} ${prompt.model} ${prompt.category}`.toLowerCase().includes(q));
    result.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    const total = result.length; const page = result.slice(offset, offset + limit);
    res.json({ prompts: page.map(adminPrompt), total, offset, limit, hasMore: offset + page.length < total });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.patch('/api/admin/prompts/:id', (req, res) => {
  const prompt = findPrompt(req.params.id); if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
  ['status', 'featured', 'title', 'category', 'model'].forEach(key => { if (req.body?.[key] !== undefined) prompt[key] = key === 'model' ? normalizeModel(req.body[key]) : req.body[key]; });
  save('prompts', prompts);
  if (req.body?.status === 'published') addActivity('approve', `“${cleanTitle(prompt.title, prompt.prompt)}” was approved`, prompt.id);
  if (req.body?.featured === true) addActivity('feature', `“${cleanTitle(prompt.title, prompt.prompt)}” was featured`, prompt.id);
  res.json({ prompt: adminPrompt(prompt) });
});
app.delete('/api/admin/prompts/:id', (req, res) => {
  const index = prompts.findIndex(prompt => prompt.id === req.params.id); if (index < 0) return res.status(404).json({ error: 'Prompt not found' });
  const [removed] = prompts.splice(index, 1); save('prompts', prompts); addActivity('delete', `“${cleanTitle(removed.title, removed.prompt)}” was removed`, removed.id); res.json({ ok: true });
});
app.get('/api/admin/users', async (req, res) => {
  try {
    const limit = parsePageParam(req.query.limit, 25, 100, 'limit'); const offset = parsePageParam(req.query.offset, 0, 1000000, 'offset');
    const search = String(req.query.search || '').trim(); const status = String(req.query.status || 'all'); const verification = String(req.query.verification || 'all'); const role = String(req.query.role || 'all');
    if (supabaseAdmin) {
      let query = supabaseAdmin.from('profiles').select('id,full_name,username,email,avatar_url,role,status,created_at,updated_at,last_sign_in_at,email_verified_at,auth_provider', { count: 'exact' });
      if (search) {
        const safeSearch = search.replace(/[(),]/g, '');
        query = /^[0-9a-f-]{36}$/i.test(safeSearch) ? query.or(`full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,id.eq.${safeSearch}`) : query.or(`full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
      }
      if (status !== 'all') query = query.eq('status', status);
      if (role !== 'all') query = query.eq('role', role);
      if (verification === 'verified') query = query.not('email_verified_at', 'is', null);
      if (verification === 'unverified') query = query.is('email_verified_at', null);
      const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      if (error) throw error;
      const result = (data || []).map(profile => profileUser({ id: profile.id, email: profile.email, created_at: profile.created_at }, profile));
      return res.json({ users: result, total: Number(count || 0), offset, limit, hasMore: offset + result.length < Number(count || 0) });
    }
    let result = users.map(safeUser); if (status !== 'all') result = result.filter(user => user.status === status); if (role !== 'all') result = result.filter(user => user.role === role); if (search) result = result.filter(user => `${user.name} ${user.email} ${user.id}`.toLowerCase().includes(search.toLowerCase()));
    return res.json({ users: result.slice(offset, offset + limit), total: result.length, offset, limit, hasMore: offset + limit < result.length });
  } catch (error) { return res.status(500).json({ error: 'Unable to load users.' }); }
});
app.get('/api/admin/users/export', async (req, res) => {
  try {
    let rows;
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from('profiles').select('id,full_name,email,status,email_verified_at,auth_provider,role,created_at,last_sign_in_at').order('created_at', { ascending: false });
      if (error) throw error; rows = data || []; await writeAudit('user.export', req.user.id, null, { count: rows.length });
    } else rows = users.map(user => ({ id: user.id, full_name: user.name, email: user.email, status: user.status, email_verified_at: null, auth_provider: 'email', role: user.role, created_at: user.joinedAt, last_sign_in_at: null }));
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['User ID', 'Full Name', 'Email', 'Status', 'Email Verification', 'Auth Method', 'Role', 'Registered', 'Last Sign In'];
    const csv = [header, ...rows.map(row => [row.id, row.full_name, row.email, row.status, row.email_verified_at ? 'verified' : 'unverified', row.auth_provider || 'email', row.role, row.created_at, row.last_sign_in_at])].map(row => row.map(quote).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="genvexa-users.csv"'); return res.send(csv + '\n');
  } catch { return res.status(500).json({ error: 'Unable to export users.' }); }
});
app.get('/api/admin/users/:id', async (req, res) => {
  try {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from('profiles').select('id,full_name,username,email,avatar_url,role,status,created_at,updated_at,last_sign_in_at,email_verified_at,auth_provider').eq('id', req.params.id).maybeSingle();
      if (error) throw error; if (!data) return res.status(404).json({ error: 'User not found' });
      return res.json({ user: profileUser({ id: data.id, email: data.email, created_at: data.created_at }, data) });
    }
    const user = findUser(req.params.id); if (!user) return res.status(404).json({ error: 'User not found' }); return res.json({ user: safeUser(user) });
  } catch { return res.status(500).json({ error: 'Unable to load user details.' }); }
});
app.patch('/api/admin/users/:id', async (req, res) => {
  try {
    if (supabaseAdmin) {
      if (req.user.id === req.params.id && req.body?.role && req.body.role !== 'admin') return res.status(400).json({ error: 'You cannot remove your own administrator role.' });
      const updates = {}; if (req.body?.full_name !== undefined) updates.full_name = String(req.body.full_name).trim().slice(0, 80); if (req.body?.status && ['active', 'suspended', 'disabled'].includes(req.body.status)) updates.status = req.body.status; if (req.body?.role && ['user', 'creator', 'admin'].includes(req.body.role)) updates.role = req.body.role; updates.updated_at = new Date().toISOString();
      const { data, error } = await supabaseAdmin.from('profiles').update(updates).eq('id', req.params.id).select('id,full_name,username,email,avatar_url,role,status,created_at,updated_at,last_sign_in_at,email_verified_at,auth_provider').single();
      if (error) throw error; await writeAudit('user.update', req.user.id, req.params.id, updates); return res.json({ user: profileUser({ id: data.id, email: data.email, created_at: data.created_at }, data) });
    }
    const user = findUser(req.params.id); if (!user) return res.status(404).json({ error: 'User not found' }); if (user.id === adminUser?.id && req.body?.status === 'suspended') return res.status(400).json({ error: 'The primary admin cannot be suspended.' }); if (req.body?.status) user.status = String(req.body.status); if (req.body?.role && ['member', 'creator', 'admin'].includes(req.body.role)) user.role = req.body.role; save('users', users); return res.json({ user: safeUser(user) });
  } catch { return res.status(500).json({ error: 'Unable to update user.' }); }
});
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    if (supabaseAdmin) {
      if (req.user.id === req.params.id) return res.status(400).json({ error: 'You cannot delete your own account from this page.' });
      const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id); if (error) throw error; await writeAudit('user.delete', req.user.id, req.params.id); return res.json({ ok: true });
    }
    const index = users.findIndex(user => user.id === req.params.id); if (index < 0) return res.status(404).json({ error: 'User not found' }); if (users[index].role === 'admin') return res.status(400).json({ error: 'The primary admin cannot be deleted.' }); const [removed] = users.splice(index, 1); save('users', users); addActivity('delete', `${removed.name} was removed from the community`); return res.json({ ok: true });
  } catch { return res.status(500).json({ error: 'Unable to delete user.' }); }
});
app.get('/api/admin/activity', async (req, res) => {
  try {
    const limit = parsePageParam(req.query.limit, 20, 50, 'limit'); const offset = parsePageParam(req.query.offset, 0, 1000000, 'offset');
    if (supabaseAdmin) { const { data, count, error } = await supabaseAdmin.from('admin_audit_log').select('id,actor_id,action,target_user_id,metadata,success,created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1); if (error) throw error; return res.json({ activities: data || [], total: Number(count || 0), offset, limit, hasMore: offset + (data?.length || 0) < Number(count || 0) }); }
    const total = activities.length; const page = activities.slice(offset, offset + limit); return res.json({ activities: page, total, offset, limit, hasMore: offset + page.length < total });
  } catch (error) { return res.status(500).json({ error: 'Unable to load activity.' }); }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));

function addActivity(type, text, promptId) {
  activities.unshift({ id: crypto.randomUUID(), type, text, promptId, time: Date.now() });
  activities = activities.slice(0, 100); save('activities', activities);
}

app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError) return res.status(400).json({ error: 'Invalid JSON request body' });
  console.error(error);
  return res.status(500).json({ error: 'Internal server error' });
});

export default app;

if (!process.env.VERCEL) {
  if (isProduction) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || !req.accepts('html')) return next();
      const knownPage = req.path === '/' || /^\/(?:app|terms|privacy-policy|refund-policy)$/.test(req.path) || /^\/prompt\/[^/]+$/.test(req.path) || req.path === '/admin';
      if (!knownPage) return res.status(404).sendFile(path.join(publicDir, '404.html'));
      return res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
    app.listen(port, '0.0.0.0', () => console.log(`Genvexa Gallery Studio running at http://0.0.0.0:${port}`));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true, host: true, allowedHosts: true }, appType: 'spa' });
    app.use(vite.middlewares); app.listen(port, '0.0.0.0', () => console.log(`Genvexa Gallery Studio running at http://0.0.0.0:${port}`));
  }
}
