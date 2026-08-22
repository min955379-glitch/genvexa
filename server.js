import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 4173);
const app = express();
app.use(express.json({ limit: '2mb' }));

const dataDir = path.join(__dirname, 'data');
const publicDir = path.join(__dirname, 'public');
try { fs.mkdirSync(dataDir, { recursive: true }); } catch { /* serverless bundles can be read-only */ }
try { fs.mkdirSync(path.join(publicDir, 'images'), { recursive: true }); } catch { /* static assets are already bundled on Vercel */ }

const now = Date.now();
const seedPrompts = [
  {
    id: 'community_4bf39330-56f2-4a44-8e85-c137a7368d7b',
    title: 'Calm premium advertising poster for a fictional organic tea brand',
    excerpt: 'Create a calm premium advertising poster for a fictional organic tea brand “ZEN LEAF”.',
    prompt: 'Create a calm premium advertising poster for a fictional organic tea brand "ZEN LEAF". FORMAT: 4:5 vertical, minimalist wellness layout. SUBJECT: a delicate glass teapot of golden herbal tea beside a single porcelain cup, fresh green leaves and a curl of gentle steam. BACKGROUND: soft sage-to-cream gradient with subtle rice-paper texture, tranquil empty space. LIGHTING: soft diffused natural morning light, delicate reflections, serene mood. TYPOGRAPHY: refined thin serif brand name "ZEN LEAF" centered top, tiny tagline "Breathe. Sip. Restore." at the bottom. FINISH: 8k, photorealistic, calm premium wellness aesthetic.',
    image: '/images/zen-leaf.png',
    model: 'GPT Image',
    category: 'Ads & Product',
    tags: ['wellness', 'product', 'minimal', 'tea'],
    creator: { name: 'Alexei Sazonow', handle: '@alexei', avatar: 'AS', color: '#f0b84e' },
    likes: 136,
    copies: 424,
    views: 8800,
    featured: true,
    status: 'published',
    ratio: '4:5',
    createdAt: now - 1000 * 60 * 60 * 3,
    sourceUrl: 'https://www.meigen.ai/prompt/community_4bf39330-56f2-4a44-8e85-c137a7368d7b'
  },
  {
    id: '2054447319001571357',
    title: 'Premium wellness advertising poster for a tea brand',
    excerpt: 'A polished commercial poster that makes a quiet cup of tea feel like a ritual.',
    prompt: 'Create a premium wellness advertising poster for a tea brand. Design it as a polished commercial poster with soft natural morning light, an elegant ceramic cup, delicate botanicals, calm negative space, a warm cream and sage palette, tactile paper grain, restrained serif typography, and a refined editorial art direction. Keep the composition uncluttered and photorealistic.',
    image: '/images/tea-poster.jpg',
    model: 'GPT Image',
    category: 'Ads & Product',
    tags: ['commercial', 'wellness', 'editorial'],
    creator: { name: 'Genvexa Community', handle: '@community', avatar: 'MC', color: '#7b63d4' },
    likes: 47,
    copies: 212,
    views: 1100,
    featured: false,
    status: 'published',
    ratio: '4:5',
    createdAt: now - 1000 * 60 * 60 * 7,
    sourceUrl: 'https://www.meigen.ai/prompt/2054447319001571357'
  },
  {
    id: 'community_2c432f6b-faaf-437a-b37c-23ae9489893b',
    title: 'Premium luxury advertising poster for KUWOLI Tea & Co.',
    excerpt: 'A dark, heritage-inspired luxury tea campaign with a cinematic product focus.',
    prompt: 'Create a premium luxury advertising poster for "KUWOLI Tea & Co." that blends Japanese tea culture, dark cinematic lighting, a hero tea tin, subtle botanical shadows, rich charcoal and warm amber tones, a generous field of negative space, and understated high-end serif typography. Photorealistic commercial product photography, tactile materials, sophisticated and quiet.',
    image: '/images/kuwoli-tea.png',
    model: 'Nano Banana Pro',
    category: 'Brand & Logo',
    tags: ['luxury', 'packaging', 'tea', 'brand'],
    creator: { name: 'Larus Canus', handle: '@mrlarus', avatar: 'LC', color: '#d2665a' },
    likes: 215,
    copies: 692,
    views: 11300,
    featured: true,
    status: 'published',
    ratio: '4:5',
    createdAt: now - 1000 * 60 * 60 * 13,
    sourceUrl: 'https://www.meigen.ai/prompt/community_2c432f6b-faaf-437a-b37c-23ae9489893b'
  },
  {
    id: 'community_aa9cab52-e108-4dd6-9de2-714fa65b1b62',
    title: 'Excellent Mint Tea product advertising poster',
    excerpt: 'Fresh mint, clean packaging, and a bright commercial color system.',
    prompt: 'Create an attractive and professional Excellent Mint Tea product advertising poster. Keep the packaging clean and premium, use fresh mint leaves, cool green and bright white tones, soft studio shadows, a clear product hierarchy, tasteful headline placement, and a polished FMCG campaign finish. High detail, crisp reflections, commercial photography.',
    image: '/images/mint-tea.png',
    model: 'GPT Image',
    category: 'Ads & Product',
    tags: ['food', 'packaging', 'fresh', 'commercial'],
    creator: { name: 'Mira Studio', handle: '@mirastudio', avatar: 'MS', color: '#63b87c' },
    likes: 79,
    copies: 301,
    views: 2800,
    featured: false,
    status: 'published',
    ratio: '4:5',
    createdAt: now - 1000 * 60 * 60 * 24,
    sourceUrl: 'https://www.meigen.ai/prompt/community_aa9cab52-e108-4dd6-9de2-714fa65b1b62'
  },
  {
    id: '2068271487166124323',
    title: 'Bright, airy flowing color visual',
    excerpt: 'A soft abstract visual built from light, haze, and long flowing color trails.',
    prompt: 'Create a bright, translucent, airy information visual around [specific theme]. The core is not a sharp realistic subject; dissolve the theme into softly focused color mist and slender falling fluid streaks, as if light were stretched and water vapor had blurred the background. Concentrate the color in the middle, leave generous breathing room, use a luminous editorial finish, and preserve a calm sense of motion.',
    image: '/images/flowing-light.jpg',
    model: 'Nano Banana',
    category: 'Illustration & 3D',
    tags: ['abstract', 'soft light', 'editorial'],
    creator: { name: '刘伯庸', handle: '@user_9619', avatar: '刘', color: '#58a9bc' },
    likes: 0,
    copies: 86,
    views: 620,
    featured: false,
    status: 'published',
    ratio: '2:3',
    createdAt: now - 1000 * 60 * 60 * 29,
    sourceUrl: 'https://www.meigen.ai/prompt/2068271487166124323'
  },
  {
    id: '2015257114529419733',
    title: 'Clean 3×3 storyboard grid',
    excerpt: 'Nine equal panels with an overall 4:5 ratio for structured visual storytelling.',
    prompt: 'A clean 3×3 storyboard grid with nine equal-sized panels and an overall 4:5 aspect ratio. Build a clear visual narrative from wide establishing shot to close-up details, maintain one coherent palette and character design throughout, leave subtle gutters between panels, and use a premium cinematic pre-production board aesthetic.',
    image: '/images/storyboard.jpg',
    model: 'Seedance',
    category: 'Storyboard & Characters',
    tags: ['storyboard', 'cinematic', 'grid'],
    creator: { name: 'Studio K', handle: '@studiok', avatar: 'SK', color: '#e48950' },
    likes: 64,
    copies: 188,
    views: 1940,
    featured: false,
    status: 'published',
    ratio: '4:5',
    createdAt: now - 1000 * 60 * 60 * 36,
    sourceUrl: 'https://www.meigen.ai/prompt/2015257114529419733'
  },
  {
    id: 'community_44f8bae7-5634-44c7-80c0-29e8ecd7fd32',
    title: 'Luxury organic matcha packaging concept',
    excerpt: 'A distinctive premium packaging direction for a modern matcha brand.',
    prompt: 'A highly distinctive and premium commercial packaging concept for a luxury organic matcha brand. Design a sculptural tea package with a restrained contemporary identity, natural paper textures, quiet Japanese references, a rich moss and cream palette, precise product photography, soft directional light, and a clean editorial campaign composition. Leave the brand name as a simple editable placeholder.',
    image: '/images/matcha-pack.png',
    model: 'GPT Image',
    category: 'Brand & Logo',
    tags: ['matcha', 'packaging', 'identity'],
    creator: { name: 'Chillai Kalan', handle: '@chillai', avatar: 'CK', color: '#6ca874' },
    likes: 92,
    copies: 277,
    views: 3370,
    featured: true,
    status: 'published',
    ratio: '4:5',
    createdAt: now - 1000 * 60 * 60 * 48,
    sourceUrl: 'https://www.meigen.ai/prompt/community_44f8bae7-5634-44c7-80c0-29e8ecd7fd32'
  },
  {
    id: '2064276536073551930',
    title: 'New Chinese tea brand package poster',
    excerpt: 'A vertical 9:16 hero visual for a refined modern Chinese tea line.',
    prompt: 'Generate a vertical 9:16 premium modern Chinese tea brand packaging key visual poster. Keep each image independent rather than a collage. Preserve the tea can silhouette, label hierarchy, material texture, and logo placement. Pair the package with a calm architectural background, elegant warm light, subtle ink-inspired botanical forms, and a highly finished luxury FMCG campaign style.',
    image: '/images/chinese-tea.jpg',
    model: 'Nano Banana Pro',
    category: 'Posters & Visuals',
    tags: ['chinese tea', 'poster', 'package'],
    creator: { name: 'Tea Archive', handle: '@tearchive', avatar: 'TA', color: '#bd7b4e' },
    likes: 35,
    copies: 143,
    views: 920,
    featured: false,
    status: 'published',
    ratio: '9:16',
    createdAt: now - 1000 * 60 * 60 * 55,
    sourceUrl: 'https://www.meigen.ai/prompt/2064276536073551930'
  },
  {
    id: '2082667261718872509',
    title: 'Emerald necklace cinematic fashion story',
    excerpt: 'A sequence of close-up luxury frames built around an emerald necklace.',
    prompt: 'The jewelry box slowly opens as warm golden light reveals a brilliant emerald necklace. Extreme macro close-up of the gemstone and diamond accents with breathtaking clarity, crystal reflections, and luxurious sparkle. A graceful woman prepares for an exclusive gala, delicately lifting the necklace, then fastens it around her neck. Finish with a high-fashion editorial portrait where the emerald is the unmistakable focal point.',
    image: '/images/prompt-04.png',
    model: 'GPT Image',
    category: 'Portraits',
    tags: ['jewelry', 'fashion', 'cinematic'],
    creator: { name: 'Abdullah', handle: '@itxabdullaa', avatar: 'AB', color: '#bb70aa' },
    likes: 83,
    copies: 190,
    views: 2120,
    featured: false,
    status: 'published',
    ratio: '4:5',
    createdAt: now - 1000 * 60 * 60 * 72,
    sourceUrl: 'https://www.meigen.ai/prompt/2082667261718872509'
  },
  {
    id: '2070893129939464263',
    title: 'French apartment lifestyle portrait',
    excerpt: 'A relaxed, editorial portrait with a quietly cinematic morning mood.',
    prompt: '9:16 vertical, a relaxed French lifestyle portrait in a sunlit apartment living room, captured as a candid frame from a high-end lifestyle magazine. Keep the mood warm, natural, intimate, and mature, with soft daylight, lived-in textures, a calm neutral palette, and unforced expression. Avoid influencer styling and studio polish; make it feel observed, editorial, and beautifully real.',
    image: '/images/prompt-06.png',
    model: 'Nano Banana',
    category: 'Portraits',
    tags: ['portrait', 'lifestyle', 'editorial'],
    creator: { name: 'Liyue AI', handle: '@liyue_ai', avatar: 'LA', color: '#6f8fd0' },
    likes: 79,
    copies: 207,
    views: 2520,
    featured: false,
    status: 'published',
    ratio: '9:16',
    createdAt: now - 1000 * 60 * 60 * 90,
    sourceUrl: 'https://www.meigen.ai/prompt/2070893129939464263'
  },
  {
    id: '2044411171433075106',
    title: 'Ultra-realistic golden hour portrait',
    excerpt: 'A cinematic portrait setup with a warm, directional, late-day glow.',
    prompt: 'A cinematic golden hour portrait of a stylish man leaning against a classic car. Use a low perspective, warm rim light, subtle film grain, honest skin texture, quiet confidence, and a carefully controlled amber and shadow palette. Fashion editorial photography, 85mm lens, shallow depth of field, natural wind in the clothing, premium magazine finish.',
    image: '/images/prompt-03.png',
    model: 'GPT Image',
    category: 'Portraits',
    tags: ['cinematic', 'fashion', 'portrait'],
    creator: { name: 'Harboriis', handle: '@harboriis', avatar: 'H', color: '#c1815f' },
    likes: 112,
    copies: 348,
    views: 4500,
    featured: false,
    status: 'published',
    ratio: '4:5',
    createdAt: now - 1000 * 60 * 60 * 120,
    sourceUrl: 'https://www.meigen.ai/prompt/2044411171433075106'
  },
  {
    id: '2090083230317945129',
    title: 'One photo, one premium poster',
    excerpt: 'Turn every uploaded photo into a standalone premium poster, never a collage.',
    prompt: 'Please turn each uploaded photo into a standalone high-end design poster, one image per output with no multi-image collage. Use a 3:4 vertical composition, preserve the subject and important details from the original photo, add an art-directed background and refined typography, and keep the visual system consistent across the series.',
    image: '/images/prompt-01.png',
    model: 'GPT Image',
    category: 'Posters & Visuals',
    tags: ['poster', 'photo edit', 'series'],
    creator: { name: 'Community', handle: '@community', avatar: 'CO', color: '#8461d0' },
    likes: 51,
    copies: 174,
    views: 1470,
    featured: false,
    status: 'published',
    ratio: '3:4',
    createdAt: now - 1000 * 60 * 60 * 150,
    sourceUrl: 'https://www.meigen.ai/prompt/2090083230317945129'
  },
  {
    id: '2090042212885098527',
    title: 'Athletic motion campaign storyboard',
    excerpt: 'A flexible sports visual system for trail running, swimming, or skateboarding.',
    prompt: '[Sport]: {trail running / swimming / skateboarding / cycling}. Build a premium campaign image system with a strong sense of motion, one hero athlete, crisp directional light, graphic color blocking, intentional negative space for copy, and three supporting detail frames. Keep the subject recognizable and the visual language consistent across every frame.',
    image: '/images/prompt-02.png',
    model: 'Seedance',
    category: 'Videos',
    tags: ['sports', 'motion', 'campaign'],
    creator: { name: 'Motion Lab', handle: '@motionlab', avatar: 'ML', color: '#e27d5f' },
    likes: 66,
    copies: 141,
    views: 2080,
    featured: false,
    ratio: '16:9',
    status: 'published',
    createdAt: now - 1000 * 60 * 60 * 178,
    sourceUrl: 'https://www.meigen.ai/prompt/2090042212885098527'
  }
];

const seedUsers = [
  { id: 'u_admin', name: 'Ava Chen', username: 'usertestpro', email: 'usertestpro@genvexa.local', role: 'admin', status: 'active', avatar: 'AC', credits: 9999, joinedAt: now - 1000 * 60 * 60 * 24 * 90, favorites: [] },
  { id: 'u_alexei', name: 'Alexei Sazonow', email: 'alexei@example.com', role: 'creator', status: 'active', avatar: 'AS', credits: 120, joinedAt: now - 1000 * 60 * 60 * 24 * 45, favorites: ['community_4bf39330-56f2-4a44-8e85-c137a7368d7b'] },
  { id: 'u_mira', name: 'Mira Studio', email: 'mira@example.com', role: 'creator', status: 'active', avatar: 'MS', credits: 80, joinedAt: now - 1000 * 60 * 60 * 24 * 31, favorites: [] },
  { id: 'u_oliver', name: 'Oliver Park', email: 'oliver@example.com', role: 'member', status: 'active', avatar: 'OP', credits: 25, joinedAt: now - 1000 * 60 * 60 * 24 * 12, favorites: [] },
  { id: 'u_sana', name: 'Sana Malik', email: 'sana@example.com', role: 'member', status: 'pending', avatar: 'SM', credits: 50, joinedAt: now - 1000 * 60 * 60 * 24 * 3, favorites: [] }
];

function load(name, fallback) {
  const file = path.join(dataDir, `${name}.json`);
  if (!fs.existsSync(file)) {
    try { fs.writeFileSync(file, JSON.stringify(fallback, null, 2)); } catch { /* use the bundled fallback in read-only serverless mode */ }
  }
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function save(name, value) {
  try { fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(value, null, 2)); } catch { /* Vercel functions are ephemeral; use a managed database for durable writes */ }
}
let prompts = load('prompts', seedPrompts);
let users = load('users', seedUsers);
let activities = load('activities', [
  { id: 'a1', type: 'publish', text: 'Alexei Sazonow published a new prompt', promptId: seedPrompts[0].id, time: now - 1000 * 60 * 11 },
  { id: 'a2', type: 'feature', text: '“Luxury organic matcha packaging concept” was featured', promptId: seedPrompts[6].id, time: now - 1000 * 60 * 47 },
  { id: 'a3', type: 'signup', text: 'Sana Malik joined the community', time: now - 1000 * 60 * 88 },
  { id: 'a4', type: 'copy', text: 'A prompt was copied 18 times in the last hour', promptId: seedPrompts[2].id, time: now - 1000 * 60 * 123 }
]);

function addActivity(type, text, promptId) {
  activities.unshift({ id: crypto.randomUUID(), type, text, promptId, time: Date.now() });
  activities = activities.slice(0, 80);
  save('activities', activities);
}
function publicPrompt(p) {
  return { ...p, sourceUrl: p.sourceUrl || 'https://www.meigen.ai/' };
}
function findPrompt(id) { return prompts.find(p => p.id === id); }
function findUser(id) { return users.find(u => u.id === id); }

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'genvexa-gallery-studio' }));

app.get('/api/prompts', (req, res) => {
  const { model = 'All', category = 'All', sort = 'featured', search = '', status = 'published' } = req.query;
  let result = prompts.filter(p => status === 'all' ? true : p.status === status);
  if (model !== 'All') {
    const needle = String(model).toLowerCase().replace(/\s/g, '');
    result = result.filter(p => p.model.toLowerCase().replace(/\s/g, '').includes(needle));
  }
  if (category !== 'All') result = result.filter(p => p.category === category);
  if (search) {
    const needle = String(search).toLowerCase();
    result = result.filter(p => `${p.title} ${p.excerpt} ${p.prompt} ${p.category} ${p.model} ${p.creator.name} ${p.tags.join(' ')}`.toLowerCase().includes(needle));
  }
  if (sort === 'newest') result.sort((a, b) => b.createdAt - a.createdAt);
  else if (sort === 'popular') result.sort((a, b) => (b.likes + b.copies / 2 + b.views / 100) - (a.likes + a.copies / 2 + a.views / 100));
  else result.sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAt - a.createdAt);
  res.json({ prompts: result.map(publicPrompt), total: result.length });
});

app.get('/api/prompts/:id', (req, res) => {
  const prompt = findPrompt(req.params.id);
  if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
  prompt.views = (prompt.views || 0) + 1;
  save('prompts', prompts);
  res.json({ prompt: publicPrompt(prompt) });
});

app.post('/api/prompts/:id/copy', (req, res) => {
  const prompt = findPrompt(req.params.id);
  if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
  prompt.copies = (prompt.copies || 0) + 1;
  save('prompts', prompts);
  addActivity('copy', `A prompt was copied from “${prompt.title}”`, prompt.id);
  res.json({ ok: true, copies: prompt.copies });
});

app.post('/api/prompts/:id/like', (req, res) => {
  const prompt = findPrompt(req.params.id);
  if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
  const liked = Boolean(req.body?.liked);
  const current = Number(prompt.likes || 0);
  prompt.likes = Math.max(0, liked ? current + 1 : current - 1);
  save('prompts', prompts);
  res.json({ ok: true, liked, likes: prompt.likes });
});

app.post('/api/prompts/:id/favorite', (req, res) => {
  const prompt = findPrompt(req.params.id);
  const user = findUser(req.body?.userId);
  if (!prompt || !user) return res.status(404).json({ error: 'Prompt or user not found' });
  const favorite = Boolean(req.body?.favorite);
  user.favorites = user.favorites || [];
  if (favorite && !user.favorites.includes(prompt.id)) user.favorites.push(prompt.id);
  if (!favorite) user.favorites = user.favorites.filter(id => id !== prompt.id);
  save('users', users);
  res.json({ ok: true, favorite, favorites: user.favorites });
});

app.post('/api/generations', (req, res) => {
  const prompt = req.body?.promptId ? findPrompt(req.body.promptId) : null;
  const image = prompt?.image || '/images/prompt-01.png';
  const result = { id: crypto.randomUUID(), image, poster: prompt?.poster || image, video: prompt?.video || null, mediaType: prompt?.mediaType || 'image', prompt: req.body?.prompt || prompt?.prompt || '', model: req.body?.model || prompt?.model || 'GPT Image', ratio: req.body?.ratio || prompt?.ratio || '4:5', createdAt: Date.now() };
  if (prompt) {
    prompt.copies = (prompt.copies || 0) + 1;
    save('prompts', prompts);
  }
  addActivity('generate', `A ${result.model} creation was generated`, prompt?.id);
  res.json({ generation: result, creditsRemaining: 24 });
});

app.post('/api/auth/login', (req, res) => {
  const loginId = String(req.body?.username || req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!loginId || !password) return res.status(400).json({ error: 'Username/email and password are required' });
  let user = users.find(u => u.email?.toLowerCase() === loginId || u.username?.toLowerCase() === loginId);
  const adminLogin = loginId === 'usertestpro' || user?.role === 'admin';
  if (adminLogin && password !== 'pass123pro') return res.status(401).json({ error: 'Invalid admin username or password' });
  if (!user) {
    const localPart = loginId.split('@')[0];
    const initials = localPart.split(/[._-]/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
    user = { id: `u_${crypto.randomUUID()}`, name: localPart.replace(/[._-]/g, ' '), username: loginId.includes('@') ? undefined : loginId, email: loginId.includes('@') ? loginId : `${loginId}@genvexa.local`, role: 'member', status: 'active', avatar: initials || 'ME', credits: 25, joinedAt: Date.now(), favorites: [] };
    users.push(user);
    save('users', users);
    addActivity('signup', `${user.name} joined the community`);
  }
  res.json({ token: `demo_${user.id}`, user });
});

app.get('/api/me/:id', (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

app.post('/api/prompts', (req, res) => {
  const body = req.body || {};
  if (!body.prompt || !body.title) return res.status(400).json({ error: 'Title and prompt are required' });
  const item = {
    id: `community_${crypto.randomUUID()}`,
    title: body.title,
    excerpt: body.excerpt || body.prompt.slice(0, 100),
    prompt: body.prompt,
    image: body.image || '/images/prompt-01.png',
    poster: body.poster || body.image || '/images/prompt-01.png',
    video: body.video || null,
    mediaType: body.mediaType || (body.video ? 'video' : 'image'),
    model: body.model || 'GPT Image',
    category: body.category || 'Ads & Product',
    tags: Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',').map(x => x.trim()).filter(Boolean),
    creator: body.creator || { name: 'You', handle: '@you', avatar: 'YO', color: '#7561d8' },
    likes: 0,
    copies: 0,
    views: 0,
    featured: false,
    status: body.status || 'pending',
    ratio: body.ratio || '4:5',
    createdAt: Date.now(),
    sourceUrl: body.sourceUrl || 'https://www.meigen.ai/'
  };
  prompts.unshift(item);
  save('prompts', prompts);
  addActivity('publish', `${item.creator.name} submitted “${item.title}” for review`, item.id);
  res.status(201).json({ prompt: publicPrompt(item) });
});

// Admin endpoints intentionally live behind a separate portal in the UI. Add auth middleware here when wiring a real identity provider.
app.get('/api/admin/stats', (_req, res) => {
  const published = prompts.filter(p => p.status === 'published');
  const pending = prompts.filter(p => p.status === 'pending');
  const totalCopies = prompts.reduce((sum, p) => sum + Number(p.copies || 0), 0);
  res.json({ stats: { prompts: published.length, users: users.length, pending: pending.length, copies: totalCopies, views: prompts.reduce((sum, p) => sum + Number(p.views || 0), 0), featured: prompts.filter(p => p.featured).length } });
});

app.get('/api/admin/prompts', (req, res) => {
  const q = String(req.query.search || '').toLowerCase();
  const status = String(req.query.status || 'all');
  let result = prompts.slice();
  if (status !== 'all') result = result.filter(p => p.status === status);
  if (q) result = result.filter(p => `${p.title} ${p.creator.name} ${p.model} ${p.category}`.toLowerCase().includes(q));
  result.sort((a, b) => b.createdAt - a.createdAt);
  res.json({ prompts: result.map(publicPrompt) });
});

app.patch('/api/admin/prompts/:id', (req, res) => {
  const prompt = findPrompt(req.params.id);
  if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
  const allowed = ['status', 'featured', 'title', 'category', 'model'];
  allowed.forEach(key => { if (req.body && req.body[key] !== undefined) prompt[key] = req.body[key]; });
  save('prompts', prompts);
  if (req.body?.status === 'published') addActivity('approve', `“${prompt.title}” was approved and published`, prompt.id);
  if (req.body?.featured === true) addActivity('feature', `“${prompt.title}” was featured`, prompt.id);
  res.json({ prompt: publicPrompt(prompt) });
});

app.delete('/api/admin/prompts/:id', (req, res) => {
  const index = prompts.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Prompt not found' });
  const [removed] = prompts.splice(index, 1);
  save('prompts', prompts);
  addActivity('delete', `“${removed.title}” was removed from the gallery`, removed.id);
  res.json({ ok: true });
});

app.get('/api/admin/users', (_req, res) => res.json({ users }));
app.patch('/api/admin/users/:id', (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (req.body?.status) user.status = req.body.status;
  if (req.body?.role) user.role = req.body.role;
  save('users', users);
  res.json({ user });
});
app.get('/api/admin/activity', (_req, res) => res.json({ activities }));

export default app;

// Vercel imports the Express app as a serverless function. Local development and
// self-hosted production keep using the same file as a normal HTTP server.
if (!process.env.VERCEL) {
  if (isProduction) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.use((req, res, next) => {
      if (req.method === 'GET' && req.accepts('html')) return res.sendFile(path.join(__dirname, 'dist', 'index.html'));
      return next();
    });
    app.listen(port, '0.0.0.0', () => console.log(`Genvexa Gallery Studio running at http://0.0.0.0:${port}`));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true, host: true, allowedHosts: true }, appType: 'spa' });
    app.use(vite.middlewares);
    app.listen(port, '0.0.0.0', () => console.log(`Genvexa Gallery Studio running at http://0.0.0.0:${port}`));
  }
}
