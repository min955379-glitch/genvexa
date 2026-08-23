import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft, ArrowUpRight, BarChart3, Bookmark, Bot, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Clapperboard, Clipboard, Clock3, Command, Copy, Crown, Download, Ellipsis,
  ExternalLink, Eye, EyeOff, FileImage, Filter, FolderHeart, GalleryHorizontalEnd, Grid2X2, Heart,
  ImagePlus, LayoutDashboard, LifeBuoy, LogIn, LogOut, Mail, Menu, MessageCircle, Moon, MoreHorizontal,
  PanelLeftClose, PanelLeftOpen, PenLine, Play, Plus, Search, Settings2, ShieldCheck, Sparkles, Sun,
  Star, Tag, Trash2, TrendingUp, Upload, UserPlus, Users, X
} from 'lucide-react';
import { supabase, supabaseConfigured } from './lib/supabase';
import './styles.css';

const categories = [
  { name: 'All', icon: GalleryHorizontalEnd },
  { name: 'Ads & Product', icon: Tag },
  { name: 'Brand & Logo', icon: Sparkles },
  { name: 'Videos', icon: Clapperboard },
  { name: 'Illustration & 3D', icon: Bot },
  { name: 'Posters & Visuals', icon: FileImage },
  { name: 'Portraits', icon: UserPlus },
  { name: 'Storyboard & Characters', icon: Grid2X2 },
  { name: 'Wallpaper', icon: Sparkles }
];

const modelTabs = ['All', 'GPT Image', 'Seedance', 'Nanobanana', 'Midjourney', 'Gemini'];
const modelOptions = ['GPT Image', 'Nano Banana', 'Nano Banana Pro', 'Seedance', 'Midjourney', 'Gemini'];

const skills = [
  { title: 'Ad Studio', description: 'Turn a product idea into a complete commercial visual direction.', icon: Sparkles, color: 'coral', tags: ['product', 'campaign'] },
  { title: 'Portrait Director', description: 'Build consistent character portraits with camera and lighting notes.', icon: Sparkles, color: 'lilac', tags: ['portrait', 'editorial'] },
  { title: 'Storyboard Kit', description: 'Shape a rough idea into a cinematic sequence ready for video models.', icon: Clapperboard, color: 'mint', tags: ['video', 'sequence'] },
  { title: 'Brand Builder', description: 'Explore packaging, logo, and visual identity concepts in one flow.', icon: Sparkles, color: 'sun', tags: ['identity', 'brand'] }
];

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  }
  const response = await fetch(path, { ...options, credentials: 'same-origin', headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function getStoredUser() {
  try {
    const user = JSON.parse(localStorage.getItem('genvexa_user') || 'null');
    if (user?.role === 'admin') { localStorage.removeItem('genvexa_user'); return null; }
    return user;
  } catch { return null; }
}
function setStoredUser(user) {
  if (user?.role === 'admin') localStorage.removeItem('genvexa_user');
  else if (user) localStorage.setItem('genvexa_user', JSON.stringify(user));
  else localStorage.removeItem('genvexa_user');
}
function getAdminSnapshot() {
  try { return JSON.parse(localStorage.getItem('genvexa_admin_snapshot') || 'null'); } catch { return null; }
}
function setAdminSnapshot(snapshot) {
  if (snapshot) localStorage.setItem('genvexa_admin_snapshot', JSON.stringify(snapshot));
  else localStorage.removeItem('genvexa_admin_snapshot');
}
function mergeAdminSnapshot(items, savedItems, key = 'id', deletedIds = []) {
  const removed = new Set(Array.isArray(deletedIds) ? deletedIds : []);
  const base = items.filter(item => !removed.has(item[key]));
  if (!Array.isArray(savedItems) || !savedItems.length) return base;
  const saved = new Map(savedItems.map(item => [item[key], item]));
  const merged = base.map(item => saved.has(item[key]) ? { ...item, ...saved.get(item[key]) } : item);
  const existing = new Set(base.map(item => item[key]));
  return [...merged, ...savedItems.filter(item => !existing.has(item[key]) && !removed.has(item[key]))];
}
function getHistory() {
  try { return JSON.parse(localStorage.getItem('genvexa_history') || '[]'); } catch { return []; }
}
function addHistory(id) {
  const next = [id, ...getHistory().filter(item => item !== id)].slice(0, 30);
  localStorage.setItem('genvexa_history', JSON.stringify(next));
}
function formatCount(value) {
  const n = Number(value || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}
function timeAgo(timestamp) {
  const minutes = Math.max(1, Math.floor((Date.now() - Number(timestamp || Date.now())) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
function initials(name = '') {
  return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'ME';
}

function App() {
  const [user, setUser] = useState(getStoredUser);
  const [path, setPath] = useState(window.location.pathname);
  const [authReady, setAuthReady] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('genvexa_theme') || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('genvexa_theme', theme);
  }, [theme]);
  useEffect(() => {
    const handlePop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePop);
    let active = true;
    const restore = async (session) => {
      if (!session) { if (active) { setUser(null); setStoredUser(null); setAuthReady(true); } return; }
      try { const data = await api('/api/auth/session'); if (active) { setUser(data.user); setStoredUser(data.user); } }
      catch { if (active) { setUser(null); setStoredUser(null); } }
      finally { if (active) setAuthReady(true); }
    };
    if (supabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => restore(data.session)).catch(() => setAuthReady(true));
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { window.setTimeout(() => restore(session), 0); });
      return () => { active = false; listener.subscription.unsubscribe(); window.removeEventListener('popstate', handlePop); };
    }
    api('/api/auth/session').then(data => { if (active) { setUser(data.user); setStoredUser(data.user); } }).catch(() => { if (active) { setUser(null); setStoredUser(null); } }).finally(() => { if (active) setAuthReady(true); });
    return () => { active = false; window.removeEventListener('popstate', handlePop); };
  }, []);

  const navigate = (nextPath, replace = false) => {
    if (replace) window.history.replaceState({}, '', nextPath);
    else window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  };
  const onLogin = (nextUser) => { setUser(nextUser); setStoredUser(nextUser); };
  const onLogout = () => { if (supabase) supabase.auth.signOut().catch(() => {}); else api('/api/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); setStoredUser(null); navigate('/'); };
  const toggleTheme = () => setTheme(current => current === 'light' ? 'dark' : 'light');

  if (!authReady && path.startsWith('/admin')) return <div className="boot-screen"><span className="brand-mark"><Crown size={18} fill="currentColor" /></span><strong>Loading secure workspace…</strong></div>;
  if (path.startsWith('/admin') && !user && supabaseConfigured) return <AuthPage mode="login" redirect="/admin" adminOnly navigate={navigate} theme={theme} onToggleTheme={toggleTheme} />;
  if (path.startsWith('/admin')) return <AdminApp user={user} onLogin={onLogin} onLogout={onLogout} navigate={navigate} theme={theme} onToggleTheme={toggleTheme} />;
  if (path === '/login' || path === '/signup' || path === '/forgot-password' || path === '/reset-password' || path === '/verify-email' || path === '/auth/callback' || path === '/auth/error') return <AuthPage mode={path.replace('/', '')} navigate={navigate} theme={theme} onToggleTheme={toggleTheme} />;
  if (path === '/terms' || path === '/privacy-policy' || path === '/refund-policy' || path === '/app') return <InfoPage path={path} navigate={navigate} theme={theme} onToggleTheme={toggleTheme} />;
  if (path.startsWith('/prompt/')) return <MainApp user={user} onLogin={onLogin} onLogout={onLogout} navigate={navigate} initialPromptId={decodeURIComponent(path.replace('/prompt/', ''))} theme={theme} onToggleTheme={toggleTheme} />;
  if (path !== '/') return <NotFound navigate={navigate} theme={theme} onToggleTheme={toggleTheme} />;
  return <MainApp user={user} onLogin={onLogin} onLogout={onLogout} navigate={navigate} theme={theme} onToggleTheme={toggleTheme} />;
}

function MainApp({ user, onLogin, onLogout, navigate, initialPromptId, theme, onToggleTheme }) {
  const [view, setView] = useState('home');
  const [category, setCategory] = useState('All');
  const [model, setModel] = useState('All');
  const [sort, setSort] = useState('featured');
  const [search, setSearch] = useState('');
  const [prompts, setPrompts] = useState([]);
  const [totalPrompts, setTotalPrompts] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [liked, setLiked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('genvexa_likes') || '[]'); } catch { return []; }
  });
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [queryOpen, setQueryOpen] = useState(false);

  const showToast = (message, tone = 'default') => {
    setToast({ message, tone });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(null), 3000);
  };

  const loadPrompts = async (offset = 0, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const params = new URLSearchParams({ model, category, sort, search, limit: '28', offset: String(offset) });
      const data = await api(`/api/prompts?${params.toString()}`);
      setPrompts(current => append ? [...current, ...(data.prompts || [])] : (data.prompts || []));
      setTotalPrompts(data.total ?? data.prompts?.length ?? 0);
      setHasMore(Boolean(data.hasMore));
    } catch (error) { showToast(error.message, 'error'); }
    finally { if (append) setLoadingMore(false); else setLoading(false); }
  };
  const loadMore = () => { if (!loadingMore && hasMore) loadPrompts(prompts.length, true); };

  useEffect(() => {
    const timer = window.setTimeout(() => loadPrompts(), search ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [model, category, sort, search]);
  useEffect(() => {
    if (!initialPromptId || selectedPrompt) return;
    const localPrompt = prompts.find(prompt => prompt.id === initialPromptId);
    if (localPrompt) { setSelectedPrompt(localPrompt); addHistory(localPrompt.id); return; }
    api(`/api/prompts/${encodeURIComponent(initialPromptId)}`).then(data => { setSelectedPrompt(data.prompt); addHistory(data.prompt.id); }).catch(() => {});
  }, [initialPromptId, prompts, selectedPrompt]);
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setQueryOpen(true); }
      if (event.key === 'Escape') { setQueryOpen(false); setSelectedPrompt(null); setModal(null); if (initialPromptId) navigate('/', true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visiblePrompts = useMemo(() => {
    if (view === 'favorites') return prompts.filter(prompt => user?.favorites?.includes(prompt.id));
    if (view === 'history') {
      const ids = getHistory();
      return ids.map(id => prompts.find(prompt => prompt.id === id)).filter(Boolean);
    }
    return prompts;
  }, [prompts, view, user]);

  const selectView = (nextView) => {
    setView(nextView);
    setMobileSidebar(false);
    if (nextView === 'home') { setCategory('All'); setSearch(''); }
    if (nextView === 'favorites' || nextView === 'history') { setCategory('All'); setSearch(''); }
  };

  const openPrompt = async (prompt) => {
    addHistory(prompt.id);
    setSelectedPrompt(prompt);
    if (window.location.pathname !== `/prompt/${encodeURIComponent(prompt.id)}`) navigate(`/prompt/${encodeURIComponent(prompt.id)}`);
    try {
      const data = await api(`/api/prompts/${prompt.id}`);
      setSelectedPrompt(data.prompt);
    } catch { /* keep the card data available if the detail call is unavailable */ }
  };

  const handleCopy = async (prompt) => {
    try { await navigator.clipboard?.writeText(prompt.prompt); } catch { /* clipboard can be unavailable in a sandbox */ }
    if (user) {
      try {
        const result = await api(`/api/prompts/${prompt.id}/copy`, { method: 'POST', body: JSON.stringify({}) });
        setPrompts(items => items.map(item => item.id === prompt.id ? { ...item, copies: result.copies } : item));
      } catch { /* the UI still gives feedback */ }
    }
    addHistory(prompt.id);
    showToast('Prompt copied to clipboard', 'success');
  };

  const toggleLike = async (prompt) => {
    if (!user) { setModal('auth'); return; }
    const isLiked = liked.includes(prompt.id);
    const next = isLiked ? liked.filter(id => id !== prompt.id) : [...liked, prompt.id];
    setLiked(next);
    localStorage.setItem('genvexa_likes', JSON.stringify(next));
    setPrompts(items => items.map(item => item.id === prompt.id ? { ...item, likes: Math.max(0, Number(item.likes || 0) + (isLiked ? -1 : 1)) } : item));
    try { await api(`/api/prompts/${prompt.id}/like`, { method: 'POST', body: JSON.stringify({ liked: !isLiked }) }); } catch { /* optimistic local state is enough for demo mode */ }
  };

  const toggleFavorite = async (prompt) => {
    if (!user) { setModal('auth'); return; }
    const favorite = !(user.favorites || []).includes(prompt.id);
    const nextUser = { ...user, favorites: favorite ? [...(user.favorites || []), prompt.id] : (user.favorites || []).filter(id => id !== prompt.id) };
    onLogin(nextUser);
    try { await api(`/api/prompts/${prompt.id}/favorite`, { method: 'POST', body: JSON.stringify({ userId: user.id, favorite }) }); } catch { /* optimistic local state */ }
    showToast(favorite ? 'Saved to Favorites' : 'Removed from Favorites', 'success');
  };

  const submitLogin = async (identifier, password) => {
    if (supabaseConfigured && supabase) {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
      if (error || !authData.session) throw new Error('Unable to sign in. Please check your credentials and try again.');
      const profile = await api('/api/auth/session');
      onLogin(profile.user); setModal(null); showToast(`Welcome back, ${profile.user.name.split(' ')[0]}`, 'success'); return;
    }
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: identifier, password }) });
    onLogin(data.user); setModal(null); showToast(`Welcome back, ${data.user.name.split(' ')[0]}`, 'success');
  };
  const submitRegister = async (username, email, password) => {
    if (supabaseConfigured && supabase) {
      const { data: authData, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: username, username } } });
      if (error) throw new Error('Unable to create your account. Check your details and try again.');
      if (!authData.session) { setModal(null); navigate(`/verify-email?email=${encodeURIComponent(email)}`); return; }
      const profile = await api('/api/auth/session'); onLogin(profile.user); setModal(null); showToast('Your account is ready.', 'success'); return;
    }
    const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) });
    onLogin(data.user); setModal(null); showToast(`Welcome to Genvexa, ${data.user.name.split(' ')[0]}`, 'success');
  };

  const submitPublish = async (payload) => {
    await api('/api/prompts', { method: 'POST', body: JSON.stringify({ ...payload, creator: user ? { name: user.name, handle: `@${user.name.toLowerCase().replace(/\s+/g, '')}`, avatar: user.avatar || initials(user.name), color: '#7561d8' } : undefined }) });
    setModal(null);
    showToast('Submitted for review and added to the moderation queue.', 'success');
    loadPrompts();
  };

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        category={category}
        onView={selectView}
        onSearch={() => { setView('home'); setQueryOpen(true); setMobileSidebar(false); }}
        onCategory={(next) => { setCategory(next); setView('home'); setMobileSidebar(false); }}
        onPublish={() => setModal('publish')}
        onCloseMobile={() => setMobileSidebar(false)}
        mobileOpen={mobileSidebar}
      />
      {mobileSidebar && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileSidebar(false)} />}
      <main className="main-stage">
        <Topbar
          user={user}
          search={search}
          onSearch={() => setQueryOpen(true)}
          onPublish={() => setModal('publish')}
          onAccount={() => setModal('account')}
          onMenu={() => setMobileSidebar(true)}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
        {view === 'home' && (
          <HomeView
            prompts={visiblePrompts}
            loading={loading}
            model={model}
            setModel={setModel}
            sort={sort}
            setSort={setSort}
            category={category}
            setCategory={setCategory}
            liked={liked}
            user={user}
            onOpen={openPrompt}
            onCopy={handleCopy}
            onLike={toggleLike}
            onFavorite={toggleFavorite}
            onClear={() => { setSearch(''); setCategory('All'); setModel('All'); }}
            search={search}
            totalCount={totalPrompts}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          />
        )}
        {view === 'skills' && <SkillsView onUse={(skill) => { setSelectedPrompt({ ...(prompts[0] || {}), title: skill.title, prompt: `${skill.description}\n\nCreate a complete prompt for this direction.`, model: 'GPT Image' }); setModal(null); }} />}
        {view === 'history' && <CollectionView type="history" prompts={visiblePrompts} onOpen={openPrompt} onCopy={handleCopy} onLike={toggleLike} liked={liked} emptyMessage="Your viewed prompts will appear here." />}
        {view === 'favorites' && <CollectionView type="favorites" prompts={visiblePrompts} onOpen={openPrompt} onCopy={handleCopy} onLike={toggleLike} liked={liked} emptyMessage={user ? 'Save prompts you want to reuse and they will appear here.' : 'Sign in to keep your favorites in sync.'} />}
        <Footer />
      </main>

      {queryOpen && <SearchPalette value={search} onChange={setSearch} onClose={() => setQueryOpen(false)} onSubmit={() => { setQueryOpen(false); setView('home'); }} />}
      {selectedPrompt && <PromptModal prompt={selectedPrompt} prompts={prompts} liked={liked.includes(selectedPrompt.id)} favorite={Boolean(user?.favorites?.includes(selectedPrompt.id))} onClose={() => { setSelectedPrompt(null); if (initialPromptId) navigate('/', true); }} onCopy={handleCopy} onLike={toggleLike} onFavorite={toggleFavorite} onOpen={openPrompt} />}
      {modal === 'auth' && <AuthModal onClose={() => setModal(null)} onSubmit={submitLogin} onRegister={submitRegister} />}
      {modal === 'account' && <AccountPopover user={user} onClose={() => setModal(null)} onLogin={() => setModal('auth')} onLogout={onLogout} onAdmin={() => { setModal(null); navigate('/admin'); }} />}
      {modal === 'publish' && <PublishModal user={user} onClose={() => setModal(null)} onSubmit={submitPublish} onLogin={() => setModal('auth')} />}
      {toast && <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite"><span className="toast-check">{toast.tone === 'error' ? <X size={14} /> : <Check size={14} />}</span>{toast.message}</div>}
    </div>
  );
}

function Sidebar({ view, category, onView, onSearch, onCategory, onPublish, mobileOpen, onCloseMobile }) {
  const navigation = [
    { name: 'Home', icon: GalleryHorizontalEnd, id: 'home' },
    { name: 'Search', icon: Search, id: 'search' },
    { name: 'History', icon: Clock3, id: 'history' },
    { name: 'Skills', icon: Sparkles, id: 'skills', badge: 'New' },
    { name: 'Favorites', icon: Heart, id: 'favorites' }
  ];
  return (
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-head">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); onView('home'); }}>
          <span className="brand-mark"><Crown size={18} fill="currentColor" strokeWidth={1.5} /></span>
          <span>Genvexa</span>
        </a>
        <button className="mobile-close" onClick={onCloseMobile} aria-label="Close navigation"><PanelLeftClose size={18} /></button>
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map(item => {
          const Icon = item.icon;
          const active = item.id === 'search' ? false : view === item.id;
          return <button key={item.id} className={`nav-row ${active ? 'nav-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => item.id === 'search' ? onSearch() : onView(item.id)}>
            <Icon size={17} strokeWidth={active ? 2.2 : 1.8} /><span>{item.name}</span>{item.badge && <span className="nav-badge">{item.badge}</span>}
          </button>;
        })}
      </nav>
      <div className="sidebar-section-label">Categories</div>
      <div className="category-list">
        {categories.map(item => {
          const Icon = item.icon;
          const active = category === item.name && view === 'home';
          return <button key={item.name} className={`category-row ${active ? 'category-active' : ''}`} aria-pressed={active} onClick={() => onCategory(item.name)}><Icon size={15} /><span>{item.name}</span></button>;
        })}
      </div>
      <div className="sidebar-section-label recent-label">Recent Updates</div>
      <div className="recent-link"><span className="recent-dot" />GPT Image 2 prompts <span className="recent-new">New</span></div>
      <div className="sidebar-section-label">More from us</div>
      <a className="external-row" href="https://github.com/jau123/MeiGen-AI-Design-MCP" target="_blank" rel="noreferrer"><span className="github-mark">⌁</span><span>MCP Server</span><span className="github-count">1.7k</span><ExternalLink size={12} /></a>
      <a className="external-row" href="/app"><span className="app-dot"><Sparkles size={12} /></span><span>Mobile App</span><span className="recent-new">New</span></a>
      <div className="sidebar-bottom">
        <button className="publish-card" onClick={onPublish}>
          <span className="publish-icon"><Upload size={17} /></span>
          <span><strong>Publish to the gallery</strong><small>Share an idea with the community</small></span>
          <ChevronRight size={15} />
        </button>
        <div className="sidebar-legal"><a href="/terms">Terms</a><span>·</span><a href="/privacy-policy">Privacy</a><span>·</span><a href="/refund-policy">Refund</a></div>
      </div>
    </aside>
  );
}

function Topbar({ user, search, onSearch, onPublish, onAccount, onMenu, theme, onToggleTheme }) {
  return <header className="topbar">
    <button className="menu-button" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button>
    <button className="top-search" onClick={onSearch} aria-label="Search prompts"><Search size={17} /><span>{search || 'Search prompts, styles, creators...'}</span><kbd><Command size={11} />K</kbd></button>
    <div className="topbar-actions">
      <button className="topbar-link desktop-only" onClick={onPublish}><Plus size={16} /> Publish</button>
      <button className="theme-button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button>
      <button className="account-button" onClick={onAccount} aria-label="Open account"><span className="avatar avatar-top" style={{ '--avatar-color': user?.color || '#b6a9e9' }}>{user?.avatar || 'ME'}</span><ChevronDown size={14} className="desktop-only" /></button>
    </div>
  </header>;
}

function HomeView({ prompts, loading, model, setModel, sort, setSort, category, setCategory, liked, user, onOpen, onCopy, onLike, onFavorite, onClear, search, totalCount, hasMore, loadingMore, onLoadMore }) {
  return <>
    <section className="hero-section">
      <div className="hero-eyebrow"><span className="eyebrow-dot" /> CURATED DAILY <span className="eyebrow-rule" /> <span className="eyebrow-muted">Ideas that are ready to create</span></div>
      <h1>Free AI Prompts <em>Gallery</em></h1>
      <p className="hero-copy">Browse thousands of prompts for GPT Image, Nano Banana, Seedance, Midjourney and more. Copy, remix, and make something you love.</p>
      <div className="hero-actions"><button className="button-primary" onClick={() => document.querySelector('.gallery-section')?.scrollIntoView({ behavior: 'smooth' })}>Explore prompts <ArrowDownIcon /></button><button className="button-quiet" onClick={() => document.querySelector('.how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>How it works <ArrowUpRight size={15} /></button></div>
      <div className="hero-stats"><span><strong>{totalCount ? `${formatCount(totalCount)}+` : '…'}</strong> prompts</span><span><strong>{modelTabs.length - 1}</strong> creative models</span><span><strong>Daily</strong> new ideas</span></div>
    </section>
    <section className="gallery-section">
      <div className="gallery-toolbar">
        <div className="model-tabs">
          {modelTabs.map(tab => <button key={tab} className={model === tab ? 'tab-active' : ''} aria-pressed={model === tab} onClick={() => setModel(tab)}>{tab}{tab === 'Seedance' && <span className="tab-new">2.0</span>}</button>)}
        </div>
        <div className="sort-tabs"><span className="sort-label">Sort by</span><button className={sort === 'featured' ? 'sort-active' : ''} aria-pressed={sort === 'featured'} onClick={() => setSort('featured')}><Star size={13} /> Featured</button><button className={sort === 'newest' ? 'sort-active' : ''} aria-pressed={sort === 'newest'} onClick={() => setSort('newest')}><Clock3 size={13} /> Newest</button><button className={sort === 'popular' ? 'sort-active' : ''} aria-pressed={sort === 'popular'} onClick={() => setSort('popular')}><TrendingUp size={13} /> Popular</button></div>
      </div>
      {category === 'Videos' && <div className="video-library-banner"><div className="video-banner-art"><span className="video-pulse" /><Play size={21} fill="currentColor" /></div><div className="video-banner-copy"><span className="section-kicker">SEEDANCE VIDEO LIBRARY</span><h3>Watch & remix video prompts.</h3><p>Play the original clips, copy the full production prompt, then use it as a starting point for your next scene.</p></div><div className="video-banner-metrics"><span><strong>{totalCount}</strong> video prompts</span><span><strong>15s</strong> cinematic clips</span></div></div>}
      <div className="gallery-heading"><div><span className="section-kicker">DISCOVER</span><h2>{search ? `Results for “${search}”` : category === 'All' ? 'Fresh inspiration' : category}</h2></div><div className="gallery-meta"><span>{loading ? 'Loading...' : `${totalCount || prompts.length} prompts`}</span><button className="filter-button" onClick={onClear}><Filter size={14} /> {category !== 'All' || model !== 'All' || search ? 'Clear filters' : 'All prompts'}</button></div></div>
      {loading ? <PromptSkeleton /> : prompts.length ? <div className="prompt-grid">{prompts.map(prompt => <PromptCard key={prompt.id} prompt={prompt} liked={liked.includes(prompt.id)} favorite={Boolean(user?.favorites?.includes(prompt.id))} onOpen={onOpen} onCopy={onCopy} onLike={onLike} onFavorite={onFavorite} />)}</div> : <EmptyState onClear={onClear} />}
      {!loading && prompts.length > 0 && hasMore && <div className="load-more-wrap"><button className="button-secondary" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? <><span className="spinner" /> Loading more...</> : <>Load more prompts <ChevronDown size={15} /></>}</button><span>Showing {prompts.length} of {totalCount}</span></div>}
    </section>
    <section className="how-it-works"><div className="section-kicker">MAKE IT YOURS</div><h2>Copy an idea. Make it yours.</h2><div className="steps"><Step icon={Copy} number="01" title="Find your spark" text="Browse curated prompts from creators around the world." /><Step icon={Clipboard} number="02" title="Copy or remix" text="Take the exact prompt or adapt it to your own idea." /><Step icon={Sparkles} number="03" title="Create magic" text="Use the prompt with the image in ChatGPT or any other model." /></div></section>
  </>;
}

function ArrowDownIcon() { return <span className="arrow-down">↓</span>; }
function Step({ icon: Icon, number, title, text }) { return <div className="step"><div className="step-icon"><Icon size={18} /></div><span className="step-number">{number}</span><h3>{title}</h3><p>{text}</p></div>; }

function PromptCard({ prompt, liked, favorite, onOpen, onCopy, onLike, onFavorite }) {
  const fallbackImage = (event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/prompt-01.png'; };
  return <article className="prompt-card" onClick={() => onOpen(prompt)}>
    <div className="card-image-wrap" style={{ '--ratio': prompt.mediaType === 'video' ? '1.55' : prompt.ratio === '16:9' ? '1.15' : prompt.ratio === '9:16' ? '.72' : prompt.ratio === '1:1' ? '1' : '.82' }}>
      {prompt.mediaType === 'video' ? <video className="card-image" src={prompt.video} poster={prompt.poster || prompt.image} muted loop playsInline preload="metadata" onError={event => { event.currentTarget.poster = '/images/prompt-01.png'; }} onMouseEnter={event => event.currentTarget.play().catch(() => {})} onMouseLeave={event => { event.currentTarget.pause(); event.currentTarget.currentTime = 0; }} /> : <img className="card-image" src={prompt.image} alt="" loading="lazy" onError={fallbackImage} />}
      <div className="card-image-shade" />
      <div className="card-topline"><span className="model-chip">{prompt.model}</span>{prompt.category === 'Videos' && <span className="video-chip"><Play size={10} fill="currentColor" /> {prompt.mediaType === 'video' ? 'Video' : 'Video prompt'}</span>}{prompt.featured && <span className="featured-chip"><Star size={11} fill="currentColor" /> Featured</span>}<button className="card-more" aria-label={`View details for ${prompt.title}`} onClick={(event) => { event.stopPropagation(); onOpen(prompt); }}><MoreHorizontal size={17} /></button></div>
      <div className="card-hover-actions"><button title="Copy prompt" aria-label={`Copy prompt: ${prompt.title}`} onClick={(event) => { event.stopPropagation(); onCopy(prompt); }}><Copy size={15} /></button><button title="View prompt" aria-label={`View details for ${prompt.title}`} onClick={(event) => { event.stopPropagation(); onOpen(prompt); }}><ArrowUpRight size={15} /></button></div>
    </div>
    <div className="card-content"><div className="card-title-row"><h3><button className="card-title-button" onClick={(event) => { event.stopPropagation(); onOpen(prompt); }}>{prompt.title}</button></h3><button className={`card-heart ${liked ? 'heart-on' : ''}`} aria-label={`${liked ? 'Unlike' : 'Like'} ${prompt.title}`} aria-pressed={liked} onClick={(event) => { event.stopPropagation(); onLike(prompt); }}>{liked ? <Heart size={16} fill="currentColor" /> : <Heart size={16} />}</button></div><p>{prompt.excerpt}</p><div className="card-footer"><span className="creator"><span className="avatar avatar-small" style={{ '--avatar-color': prompt.creator?.color }}>{prompt.creator?.avatar || initials(prompt.creator?.name)}</span><span>{prompt.creator?.name}</span></span><span className="card-stats"><span><Copy size={12} />{formatCount(prompt.copies)}</span><span><Heart size={12} />{formatCount(prompt.likes)}</span></span></div></div>
  </article>;
}

function PromptSkeleton() { return <div className="prompt-grid">{[1, 2, 3, 4, 5, 6].map(item => <div className="skeleton-card" key={item}><div className="skeleton-image" /><div className="skeleton-line large" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>)}</div>; }
function EmptyState({ onClear }) { return <div className="empty-state"><span className="empty-icon"><Search size={22} /></span><h3>No prompts found</h3><p>Try a different search or clear the filters to explore the full gallery.</p><button className="button-secondary" onClick={onClear}>Clear filters</button></div>; }

function CollectionView({ type, prompts, onOpen, onCopy, onLike, liked, emptyMessage }) {
  return <section className="collection-view"><div className="collection-heading"><div className="section-kicker">YOUR SPACE</div><h1>{type === 'history' ? 'History' : 'Favorites'}</h1><p>{type === 'history' ? 'Pick up where you left off.' : 'A private shelf for ideas worth keeping.'}</p></div>{prompts.length ? <div className="prompt-grid">{prompts.map(prompt => <PromptCard key={prompt.id} prompt={prompt} liked={liked.includes(prompt.id)} onOpen={onOpen} onCopy={onCopy} onLike={onLike} onFavorite={() => {}} />)}</div> : <div className="empty-state collection-empty"><span className="empty-icon">{type === 'history' ? <Clock3 size={22} /> : <Heart size={22} />}</span><h3>{type === 'history' ? 'Nothing here yet' : 'No favorites yet'}</h3><p>{emptyMessage}</p></div>}</section>;
}

function SkillsView({ onUse }) { return <section className="skills-view"><div className="skill-hero"><div><div className="section-kicker">CREATIVE TOOLS</div><h1>Skills for better ideas.</h1><p>Start with a direction, not a blank page. Each skill gives you a focused creative workflow you can reuse.</p></div><div className="skill-orbit"><Sparkles size={26} /><span /><span /><span /></div></div><div className="skill-grid">{skills.map(skill => { const Icon = skill.icon; return <article className={`skill-card skill-${skill.color}`} key={skill.title}><div className="skill-icon"><Icon size={20} /></div><div className="skill-card-top"><span className="skill-pill">SKILL</span><ArrowUpRight size={16} /></div><h3>{skill.title}</h3><p>{skill.description}</p><div className="skill-tags">{skill.tags.map(tag => <span key={tag}>#{tag}</span>)}</div><button className="skill-use" onClick={() => onUse(skill)}>Use skill <ChevronRight size={15} /></button></article>; })}</div><div className="skills-note"><span><CircleHelp size={17} /></span><p><strong>What are Skills?</strong> Focused prompt recipes that help you move from a rough idea to a more useful first draft.</p></div></section>; }

function Footer() { return <footer className="site-footer"><div className="footer-brand"><span className="brand-mark brand-mark-small"><Crown size={13} fill="currentColor" /></span><strong>Genvexa</strong><span>Discover. Copy. Create.</span></div><div className="footer-links"><a href="/terms">Terms</a><a href="/privacy-policy">Privacy</a><a href="/refund-policy">Refunds</a><span>© 2026 Genvexa Studio</span></div></footer>; }

function AuthPage({ mode, navigate, theme, onToggleTheme, redirect = '/', adminOnly = false }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get('email') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [consent, setConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendWait, setResendWait] = useState(0);
  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot-password';
  const isReset = mode === 'reset-password';
  const isVerify = mode === 'verify-email';
  const isCallback = mode === 'auth/callback';
  const isError = mode === 'auth/error';

  useEffect(() => {
    if (isCallback) {
      if (!supabase) { navigate('/auth/error?error=auth_not_configured', true); return; }
      const code = new URLSearchParams(window.location.search).get('code');
      const finish = async () => {
        if (code) { const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code); if (exchangeError) throw exchangeError; }
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session) throw new Error('session_expired');
        navigate('/');
      };
      finish().catch(() => navigate('/auth/error?error=session_expired', true));
    }
  }, [isCallback]);
  useEffect(() => { if (resendWait > 0) { const timer = window.setInterval(() => setResendWait(value => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer); } }, [resendWait]);
  useEffect(() => { if (isReset && supabase) supabase.auth.getSession().then(({ data }) => { if (!data.session) setError('This reset link is invalid or has expired. Request a new one.'); }); }, [isReset]);

  const authUnavailable = !supabaseConfigured && !isError && !isCallback;
  const safeError = new URLSearchParams(window.location.search).get('error');
  const submit = async event => {
    event.preventDefault(); setError(''); setSuccess('');
    if (authUnavailable) { setError('Authentication is not configured yet.'); return; }
    if (isSignup && password !== confirm) { setError('Passwords do not match.'); return; }
    if (isSignup && !consent) { setError('Please agree to the Terms and Privacy Policy.'); return; }
    setLoading(true);
    try {
      if (isLogin) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError || !data.session) throw new Error('Unable to sign in. Please check your credentials and try again.');
        const profileResponse = await api('/api/auth/session');
        if (adminOnly && profileResponse.user.role !== 'admin') { await supabase.auth.signOut(); throw new Error('This account does not have admin access.'); }
        navigate(adminOnly ? '/admin' : (redirect !== '/' ? redirect : profileResponse.user.role === 'admin' ? '/admin' : '/'));
      } else if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
        if (signUpError) throw new Error('Unable to create your account. Please check your details and try again.');
        if (data.session) navigate('/'); else navigate(`/verify-email?email=${encodeURIComponent(email)}`);
      } else if (isForgot) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (resetError) throw new Error('Unable to send reset instructions right now. Please try again.');
        setSuccess('If an account exists for this email, you will receive password reset instructions shortly.');
      } else if (isReset) {
        if (!password || password.length < 8) throw new Error('Use a password with at least 8 characters.');
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw new Error('This reset link is invalid or has expired. Request a new one.');
        setSuccess('Your password has been updated successfully.'); setPassword(''); setConfirm('');
      }
    } catch (err) { setError(err.message || 'Unable to complete that request. Please try again.'); }
    finally { setLoading(false); }
  };
  const resend = async () => {
    if (!supabase || resendWait > 0 || !email) return;
    setLoading(true); setError(''); setSuccess('');
    try { const { error: resendError } = await supabase.auth.resend({ type: 'signup', email }); if (resendError) throw resendError; setSuccess('Verification email sent. Check your inbox.'); setResendWait(60); }
    catch { setError('Unable to resend the email right now. Please try again later.'); }
    finally { setLoading(false); }
  };
  if (isCallback) return <AuthShell theme={theme} onToggleTheme={onToggleTheme} navigate={navigate}><div className="auth-state"><span className="auth-spinner" /><h1>Finishing sign in…</h1><p>We are securely completing your session.</p></div></AuthShell>;
  if (isError) return <AuthShell theme={theme} onToggleTheme={onToggleTheme} navigate={navigate}><div className="auth-state"><span className="auth-state-icon auth-state-error"><X size={20} /></span><span className="section-kicker">SIGN IN ERROR</span><h1>We could not finish that.</h1><p>{safeError === 'auth_not_configured' ? 'Authentication is not configured for this deployment.' : 'The authentication link may have expired. Start again from the sign-in page.'}</p><button className="button-primary button-wide" onClick={() => navigate('/login')}>Back to sign in</button></div></AuthShell>;
  if (isVerify) return <AuthShell theme={theme} onToggleTheme={onToggleTheme} navigate={navigate}><div className="auth-state"><span className="auth-state-icon"><MailIcon /></span><span className="section-kicker">EMAIL VERIFICATION</span><h1>Check your email.</h1><p>We sent a verification link to <strong>{email || 'your email address'}</strong>. Verify your account before signing in.</p>{success && <div className="auth-success" role="status">{success}</div>}{error && <div className="form-error" role="alert">{error}</div>}<button className="button-secondary button-wide" disabled={loading || resendWait > 0} onClick={resend}>{resendWait > 0 ? `Resend available in ${resendWait}s` : loading ? 'Sending…' : 'Resend verification email'}</button><button className="auth-link-button" onClick={() => navigate('/login')}><ArrowLeft size={14} /> Back to sign in</button></div></AuthShell>;
  const heading = isLogin ? 'Welcome back' : isSignup ? 'Create your account' : isForgot ? 'Forgot your password?' : isReset ? 'Set a new password' : 'Secure account';
  const subtext = isLogin ? 'Sign in to continue to your account.' : isSignup ? 'Join Genvexa and get started in minutes.' : isForgot ? 'Enter your email and we will send reset instructions.' : isReset ? 'Choose a strong password for your account.' : 'Continue securely.';
  return <AuthShell theme={theme} onToggleTheme={onToggleTheme} navigate={navigate}><div className="auth-page-card"><span className="section-kicker">{isLogin ? 'SIGN IN' : isSignup ? 'JOIN GENVEXA' : 'ACCOUNT SECURITY'}</span><h1>{heading}</h1><p className="auth-page-subtext">{subtext}</p>{authUnavailable && <div className="auth-config-warning" role="alert">Authentication is not configured for this deployment yet. Add the Supabase public environment variables to enable this flow.</div>}{success && <div className="auth-success" role="status">{success}</div>}{error && <div className="form-error" role="alert">{error}</div>}{!authUnavailable && <form onSubmit={submit} autoComplete={isReset ? 'off' : 'on'}>{isSignup && <label>Full name<input name="name" autoComplete="name" maxLength="80" required value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Your full name" /></label>}<label>Email address<input name="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" aria-describedby="email-help" /><small id="email-help">We will never reveal whether an email is registered.</small></label>{!isForgot && <><PasswordField label={isReset ? 'New password' : 'Password'} value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword(value => !value)} autoComplete={isReset ? 'new-password' : 'current-password'} minLength={isSignup || isReset ? 8 : undefined} /><>{(isSignup || isReset) && <PasswordRequirements value={password} />}</>{isSignup && <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} visible={showConfirm} onToggle={() => setShowConfirm(value => !value)} autoComplete="new-password" minLength={8} />}</>}{isSignup && <label className="consent-row"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> <span>I agree to the <a href="/terms">Terms of Service</a> and <a href="/privacy-policy">Privacy Policy</a>.</span></label>}<button className="button-primary button-wide" disabled={loading}>{loading ? 'Please wait…' : isLogin ? 'Sign in' : isSignup ? 'Create account' : isReset ? 'Update password' : 'Send reset instructions'} <ArrowUpRight size={15} /></button></form>}{isLogin && <button className="auth-forgot-link" onClick={() => navigate('/forgot-password')}>Forgot password?</button>}<div className="auth-page-footer">{isLogin ? <>New to Genvexa? <button onClick={() => navigate('/signup')}>Create an account</button></> : isSignup ? <>Already have an account? <button onClick={() => navigate('/login')}>Sign in</button></> : <button onClick={() => navigate('/login')}><ArrowLeft size={14} /> Back to sign in</button>}</div></div></AuthShell>;
}
function PasswordField({ label, value, onChange, visible, onToggle, autoComplete, minLength }) { return <label>{label}<span className="password-input-wrap"><input name={label.toLowerCase().replace(/\s+/g, '-')} type={visible ? 'text' : 'password'} autoComplete={autoComplete} minLength={minLength} required value={value} onChange={event => onChange(event.target.value)} placeholder="••••••••" /><button type="button" className="password-toggle" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} onClick={onToggle}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>; }
function PasswordRequirements({ value }) { const checks = [{ label: '8 or more characters', ok: value.length >= 8 }, { label: 'One uppercase letter', ok: /[A-Z]/.test(value) }, { label: 'One number', ok: /\d/.test(value) }]; return <ul className="password-requirements">{checks.map(check => <li key={check.label} className={check.ok ? 'requirement-ok' : ''}><span>{check.ok ? <Check size={12} /> : <span className="requirement-dot" />}</span>{check.label}</li>)}</ul>; }
function MailIcon() { return <Mail size={20} />; }
function AuthShell({ children, theme, onToggleTheme, navigate }) { return <div className="auth-page"><header className="auth-page-header"><a className="brand" href="/" onClick={event => { event.preventDefault(); navigate('/'); }}><span className="brand-mark"><Crown size={18} fill="currentColor" /></span><span>Genvexa</span></a><div className="auth-page-actions"><button className="theme-button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button><button className="auth-home-link" onClick={() => navigate('/')}>Back to gallery</button></div></header><main className="auth-page-main">{children}</main></div>; }

const legalPages = {
  '/terms': { label: 'TERMS OF SERVICE', title: 'A clear, calm agreement.', intro: 'These terms explain how Genvexa works and what you can expect when you browse, save, copy, and publish creative prompts.', sections: [['Using Genvexa', 'Use the gallery lawfully, respect creator rights, and do not submit content you do not have permission to share. You must be at least 13 years old, or use the service with a guardian.'], ['Community content', 'You keep ownership of content you submit. By publishing it, you grant Genvexa a limited license to host, display, resize, and distribute it inside the service. You can request removal of your submission.'], ['Safety and availability', 'We may review, hide, or remove content that violates these terms or community rules. The gallery is provided as-is and creative results can vary.']] },
  '/privacy-policy': { label: 'PRIVACY POLICY', title: 'Your ideas stay yours.', intro: 'Genvexa collects only what is needed to operate the gallery, keep accounts secure, and improve the product.', sections: [['What we collect', 'Account details, saved favorites, browsing history, prompt interactions, and technical logs needed to keep the service reliable.'], ['How we use it', 'We use information to provide the gallery, protect accounts, respond to support requests, and understand product performance. We do not sell personal information.'], ['Your choices', 'You can request access, correction, export, or deletion of your account data by contacting privacy@genvexa.app.']] },
  '/refund-policy': { label: 'REFUND POLICY', title: 'Simple, transparent support.', intro: 'Genvexa does not currently sell subscriptions. If you need help with an account or a billing issue from a future paid feature, contact support before disputing a charge.', sections: [['Contact support', 'Email support@genvexa.app with your account email, order details, and a short description of the issue.'], ['Review', 'We confirm receipt within two business days and review platform-related issues fairly.'], ['Payment provider rules', 'Any refund is returned through the original payment method and remains subject to the payment provider’s processing timelines.']] },
  '/app': { label: 'GENVEXA MOBILE', title: 'Inspiration, anywhere.', intro: 'The Genvexa mobile experience is coming soon. Until then, the responsive web app works beautifully on your phone.', sections: [['Browse on the go', 'Search the complete prompt library, explore visual categories, and open full prompt details from any screen.'], ['Keep your shelf in sync', 'Sign in to keep Favorites and History available across the devices you use.'], ['Get notified', 'Follow Genvexa on social or check back here for the mobile release announcement.']] }
};
function InfoPage({ path, navigate, theme, onToggleTheme }) {
  const page = legalPages[path];
  useEffect(() => { const previous = document.title; document.title = `${page.title} · Genvexa`; return () => { document.title = previous; }; }, [page.title]);
  return <div className="info-shell"><header className="info-header"><a className="brand" href="/" onClick={event => { event.preventDefault(); navigate('/'); }}><span className="brand-mark"><Crown size={18} fill="currentColor" /></span><span>Genvexa</span></a><div className="info-header-actions"><button className="theme-button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button><button className="button-secondary" onClick={() => navigate('/')}><ArrowLeft size={15} /> Back to gallery</button></div></header><main className="info-main"><span className="section-kicker">{page.label}</span><h1>{page.title}</h1><p className="info-intro">{page.intro}</p><div className="info-sections">{page.sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}</div><div className="info-contact"><strong>Need help?</strong><span>support@genvexa.app</span></div></main><Footer /></div>;
}
function NotFound({ navigate, theme, onToggleTheme }) { useEffect(() => { const previous = document.title; document.title = 'Page not found · Genvexa'; return () => { document.title = previous; }; }, []); return <div className="not-found-shell"><div className="not-found-actions"><button className="theme-button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button></div><span className="brand-mark"><Crown size={18} fill="currentColor" /></span><span className="section-kicker">404 · PAGE NOT FOUND</span><h1>That page wandered off.</h1><p>The link is no longer here, but there are plenty of good ideas waiting in the gallery.</p><button className="button-primary" onClick={() => navigate('/')}><ArrowLeft size={15} /> Back to gallery</button></div>; }

function SearchPalette({ value, onChange, onClose, onSubmit }) {
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="search-palette" role="dialog" aria-modal="true" aria-labelledby="search-dialog-title"><div className="palette-input"><Search size={19} /><input id="search-dialog-title" aria-label="Search prompts, models, creators" ref={input} value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => event.key === 'Enter' && onSubmit()} placeholder="Search prompts, models, creators..." /><kbd>ESC</kbd></div><div className="palette-body">{value ? <div className="palette-hint"><Sparkles size={16} /><span>Results update as you type. Press <strong>Enter</strong> to view them.</span></div> : <><div className="palette-label">Try searching for</div><div className="suggestion-row"><button onClick={() => onChange('product photography')}>product photography</button><button onClick={() => onChange('cinematic portrait')}>cinematic portrait</button><button onClick={() => onChange('tea packaging')}>tea packaging</button></div><div className="palette-label palette-bottom-label">Quick actions</div><button className="palette-action" onClick={onSubmit}><GalleryHorizontalEnd size={16} /><span>Browse all prompts</span><span className="action-key">↵</span></button><button className="palette-action" onClick={onClose}><Plus size={16} /><span>Close search</span><span className="action-key">esc</span></button></>}</div></div></div>;
}

function PromptModal({ prompt, prompts, liked, favorite, onClose, onCopy, onLike, onFavorite, onOpen }) {
  const related = prompts.filter(item => item.id !== prompt.id && (item.category === prompt.category || item.model === prompt.model)).slice(0, 3);
  const mediaImages = prompt.images?.length ? prompt.images : [prompt.image];
  const [activeImage, setActiveImage] = useState(0);
  useEffect(() => setActiveImage(0), [prompt.id]);
  const fallbackImage = event => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/prompt-01.png'; };
  return <div className="modal-backdrop prompt-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="prompt-modal" role="dialog" aria-modal="true" aria-labelledby="prompt-dialog-title"><button className="modal-close" aria-label="Close prompt details" onClick={onClose}><X size={18} /></button><div className="prompt-modal-media">{prompt.mediaType === 'video' ? <video className="prompt-modal-video" src={prompt.video} poster={prompt.poster || prompt.image} controls autoPlay muted loop playsInline aria-label={`Video preview for ${prompt.title}`} onError={event => { event.currentTarget.poster = '/images/prompt-01.png'; }} /> : <img src={mediaImages[activeImage] || prompt.image} alt={prompt.title} onError={fallbackImage} />}<div className="media-float"><span className="model-chip">{prompt.model}</span><span className="ratio-chip">{prompt.ratio}</span>{prompt.category === 'Videos' && <span className="video-chip"><Play size={10} fill="currentColor" /> {prompt.mediaType === 'video' ? 'Video' : 'Video prompt'}</span>}</div>{prompt.mediaType !== 'video' && mediaImages.length > 1 && <div className="media-thumbs" aria-label="Prompt result images">{mediaImages.map((image, index) => <button type="button" key={image} className={activeImage === index ? 'media-thumb-active' : ''} aria-label={`Show result image ${index + 1}`} aria-pressed={activeImage === index} onClick={() => setActiveImage(index)}><img src={image} alt="" onError={fallbackImage} /><span>{index + 1}</span></button>)}</div>}</div><div className="prompt-modal-detail"><div className="detail-header"><div><span className="section-kicker">PROMPT DETAILS</span><h2 id="prompt-dialog-title">{prompt.title}</h2><div className="detail-creator"><span className="avatar avatar-small" style={{ '--avatar-color': prompt.creator?.color }}>{prompt.creator?.avatar}</span><span>{prompt.creator?.name}</span><span className="detail-dot">·</span><span>{timeAgo(prompt.createdAt)}</span></div></div><button className={`round-icon ${liked ? 'round-liked' : ''}`} aria-label={`${liked ? 'Unlike' : 'Like'} ${prompt.title}`} aria-pressed={liked} onClick={() => onLike(prompt)}>{liked ? <Heart size={17} fill="currentColor" /> : <Heart size={17} />}</button></div><div className="prompt-box"><div className="prompt-box-top"><span>Prompt</span><button aria-label={`Copy full prompt for ${prompt.title}`} onClick={() => onCopy(prompt)}><Copy size={14} /> Copy</button></div><p>{prompt.prompt}</p><div className="tag-row">{prompt.tags?.map(tag => <span key={tag}>#{tag}</span>)}</div></div><div className="modal-actions"><button className="button-primary button-wide" onClick={() => onCopy(prompt)}><Copy size={16} /> Copy prompt</button><button className={`button-secondary save-button ${favorite ? 'save-on' : ''}`} aria-pressed={favorite} onClick={() => onFavorite(prompt)}>{favorite ? <Bookmark size={16} fill="currentColor" /> : <Bookmark size={16} />} {favorite ? 'Saved' : 'Save'}</button><a className="source-link" href={prompt.sourceUrl} target="_blank" rel="noreferrer">View source <ExternalLink size={13} /></a></div><div className="related-section"><div className="related-heading"><span>More like this</span><span className="related-count">{related.length} results</span></div><div className="related-row">{related.map(item => <button className="related-card" aria-label={`Open ${item.title}`} key={item.id} onClick={() => onOpen(item)}><img src={item.image} alt="" onError={fallbackImage} /><span>{item.title}</span></button>)}</div></div></div></div></div>;
}

function AuthModal({ onClose, onSubmit, onRegister }) {
  const [mode, setMode] = useState('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => { event.preventDefault(); setLoading(true); setError(''); try { if (mode === 'login') await onSubmit(identifier, password); else await onRegister(username, email, password); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title"><button className="modal-close" aria-label="Close sign in" onClick={onClose}><X size={18} /></button><div className="auth-logo"><span className="brand-mark"><Crown size={19} fill="currentColor" /></span></div><span className="section-kicker">WELCOME TO GENVEXA</span><h2 id="auth-dialog-title">{mode === 'login' ? 'Keep your ideas close.' : 'Create your workspace.'}</h2><p>{mode === 'login' ? 'Sign in to sync favorites and history across devices.' : 'Create an account to save prompts and build your private shelf.'}</p><form onSubmit={submit} autoComplete={mode === 'login' ? 'on' : 'off'}>{mode === 'login' ? <label>Email or username<input name="username" autoComplete="username" type="text" required value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="you@example.com or username" /></label> : <><label>Username<input name="username" autoComplete="off" pattern="[a-zA-Z0-9_]{3,30}" required value={username} onChange={event => setUsername(event.target.value)} placeholder="your_username" /></label><label>Email<input name="email" autoComplete="email" type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label></>}<label>Password<input name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" minLength={mode === 'login' ? undefined : 8} required value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button-primary button-wide" disabled={loading}>{loading ? (mode === 'login' ? 'Signing in…' : 'Creating…') : (mode === 'login' ? 'Continue' : 'Create account')} <ArrowUpRight size={15} /></button></form><button className="auth-switch" onClick={() => { setMode(value => value === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button><small className="auth-footnote">By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy-policy">Privacy Policy</a>.</small></div></div>;
}

function AccountPopover({ user, onClose, onLogin, onLogout, onAdmin }) {
  return <div className="popover-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="account-popover">{user ? <><div className="account-summary"><span className="avatar avatar-large" style={{ '--avatar-color': user.color || '#b6a9e9' }}>{user.avatar || initials(user.name)}</span><div><strong>{user.name}</strong><span>{user.email}</span></div></div>{user.role === 'admin' && <button className="popover-row" onClick={onAdmin}><ShieldCheck size={16} /><span>Open admin portal</span><ArrowUpRight size={14} /></button>}<button className="popover-row" onClick={onLogout}><LogOut size={16} /><span>Sign out</span></button></> : <><div className="account-summary"><span className="avatar avatar-large">ME</span><div><strong>Guest workspace</strong><span>Sign in to sync your account</span></div></div><button className="button-primary button-wide" onClick={onLogin}><LogIn size={16} /> Sign in</button></>}</div></div>;
}

function PublishModal({ user, onClose, onSubmit, onLogin }) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState('Ads & Product');
  const [model, setModel] = useState('GPT Image');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event) => { event.preventDefault(); if (!user) { onLogin(); return; } setSubmitting(true); try { await onSubmit({ title, prompt, category, model, excerpt: prompt.slice(0, 110) }); } catch (error) { window.alert(error.message); } finally { setSubmitting(false); } };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="publish-modal" role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title"><button className="modal-close" aria-label="Close publish dialog" onClick={onClose}><X size={18} /></button><div className="publish-top"><span className="publish-big-icon"><Upload size={21} /></span><div><span className="section-kicker">COMMUNITY SUBMISSIONS</span><h2 id="publish-dialog-title">Share a prompt with the community.</h2><p>Publish a useful idea and help the next creator start faster.</p></div></div><form onSubmit={submit}><label>Prompt title<input required value={title} onChange={event => setTitle(event.target.value)} placeholder="Give your idea a clear name" /></label><label>Prompt<textarea required value={prompt} onChange={event => setPrompt(event.target.value)} rows="7" placeholder="Write the full prompt so others can remix it..." /></label><div className="form-grid"><label>Category<select value={category} onChange={event => setCategory(event.target.value)}>{categories.filter(item => item.name !== 'All').map(item => <option key={item.name}>{item.name}</option>)}</select></label><label>Model<select value={model} onChange={event => setModel(event.target.value)}>{modelOptions.map(option => <option key={option}>{option}</option>)}</select></label></div><div className="publish-foot"><span><ShieldCheck size={14} /> Every submission is reviewed</span><button className="button-primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit for review'} <ArrowUpRight size={15} /></button></div></form></div></div>;
}

function AdminApp({ user, onLogin, onLogout, navigate, theme, onToggleTheme }) {
  const [toast, setToast] = useState(null);
  const showToast = (message, tone = 'success') => { setToast({ message, tone }); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => setToast(null), 3200); };
  if (!user || user.role !== 'admin') return <AdminGate onLogin={onLogin} navigate={navigate} theme={theme} onToggleTheme={onToggleTheme} />;
  return <AdminPortal user={user} onLogout={onLogout} navigate={navigate} toast={toast} showToast={showToast} theme={theme} onToggleTheme={onToggleTheme} />;
}

function AdminGate({ onLogin, navigate, theme, onToggleTheme }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => { event.preventDefault(); setLoading(true); setError(''); try {
    if (supabaseConfigured && supabase) {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email: username, password });
      if (error || !authData.session) throw new Error('Unable to sign in. Please check your credentials and try again.');
      const profile = await api('/api/auth/session'); if (profile.user.role !== 'admin') { await supabase.auth.signOut(); throw new Error('This account does not have admin access.'); }
      onLogin(profile.user);
    } else {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      if (data.user.role !== 'admin') throw new Error('This account does not have admin access.'); onLogin(data.user);
    }
  } catch (err) { setError(err.message); } finally { setLoading(false); } };
  return <div className="admin-gate"><div className="admin-gate-brand"><span className="brand-mark"><Crown size={18} fill="currentColor" /></span><strong>Genvexa</strong><span>Control room</span><button className="theme-button admin-gate-theme" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button></div><main className="admin-gate-card" role="main"><div className="admin-lock"><ShieldCheck size={22} /></div><span className="section-kicker">RESTRICTED WORKSPACE</span><h1>Sign in to the admin portal.</h1><p>Manage prompts, creators, reviews, and platform activity from one place.</p><form onSubmit={submit} autoComplete="off"><label>Username<input name="username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} type="text" required /></label><label>Password<input name="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} type="password" required /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button-primary button-wide" disabled={loading}>{loading ? 'Checking access...' : 'Enter control room'} <ArrowUpRight size={15} /></button></form><button className="back-to-site" onClick={() => navigate('/')}><ArrowLeft size={15} /> Back to gallery</button></main></div>;
}

function AdminPortal({ user, onLogout, navigate, toast, showToast, theme, onToggleTheme }) {
  const [section, setSection] = useState('overview');
  const [stats, setStats] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [promptTotal, setPromptTotal] = useState(0);
  const [promptHasMore, setPromptHasMore] = useState(false);
  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userHasMore, setUserHasMore] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userStatus, setUserStatus] = useState('all');
  const [userVerification, setUserVerification] = useState('all');
  const [userRole, setUserRole] = useState('all');
  const [userLoading, setUserLoading] = useState(false);
  const [activities, setActivities] = useState([]);
  const [promptFilter, setPromptFilter] = useState('all');
  const [promptSearch, setPromptSearch] = useState('');
  const [adminModal, setAdminModal] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [systemHealthy, setSystemHealthy] = useState(null);
  const [promptLoading, setPromptLoading] = useState(true);
  const [promptLoadingMore, setPromptLoadingMore] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [deletedPromptIds, setDeletedPromptIds] = useState(() => getAdminSnapshot()?.deletedPromptIds || []);
  const [savedAt, setSavedAt] = useState(() => getAdminSnapshot()?.savedAt || null);
  const [savedSnapshot] = useState(getAdminSnapshot);
  const promptDraftApplied = useRef(false);
  const promptAbort = useRef(null);

  const loadMeta = async () => {
    setMetaLoading(true);
    try {
      const [healthData, statsData, activityData] = await Promise.all([api('/api/health'), api('/api/admin/stats'), api('/api/admin/activity?limit=20&offset=0')]);
      setSystemHealthy(Boolean(healthData.ok)); setStats(statsData.stats); setActivities(activityData.activities || []);
    } catch (error) { showToast(error.message, 'error'); }
    finally { setMetaLoading(false); }
  };
  const loadUsers = async (offset = 0, append = false) => {
    if (!append) setUserLoading(true);
    try {
      const params = new URLSearchParams({ limit: '25', offset: String(offset), search: userSearch, status: userStatus, verification: userVerification, role: userRole });
      const data = await api(`/api/admin/users?${params.toString()}`);
      const serverUsers = data.users || [];
      const sourceUsers = !supabaseConfigured && !append && !userSearch && userStatus === 'all' && userVerification === 'all' && userRole === 'all' ? mergeAdminSnapshot(serverUsers, savedSnapshot?.users) : serverUsers;
      setUsers(current => append ? [...current, ...sourceUsers] : sourceUsers);
      setUserTotal(data.total || 0); setUserHasMore(Boolean(data.hasMore));
    } catch (error) { showToast(error.message, 'error'); }
    finally { if (!append) setUserLoading(false); }
  };
  const loadPrompts = async (offset = 0, append = false) => {
    promptAbort.current?.abort();
    const controller = new AbortController(); promptAbort.current = controller;
    if (append) setPromptLoadingMore(true); else setPromptLoading(true);
    try {
      const data = await api(`/api/admin/prompts?status=${promptFilter}&search=${encodeURIComponent(promptSearch)}&limit=25&offset=${offset}`, { signal: controller.signal });
      const serverItems = data.prompts || [];
      const shouldApplySavedPromptState = !promptDraftApplied.current && !append && !promptSearch && promptFilter === 'all';
      const sourceItems = shouldApplySavedPromptState ? mergeAdminSnapshot(serverItems, savedSnapshot?.prompts, 'id', deletedPromptIds) : serverItems.filter(item => !deletedPromptIds.includes(item.id));
      promptDraftApplied.current = true;
      setPrompts(current => append ? [...current, ...sourceItems] : sourceItems);
      setPromptTotal(Math.max(0, (data.total || 0) - deletedPromptIds.length)); setPromptHasMore(Boolean(data.hasMore));
    } catch (error) { if (error.name !== 'AbortError') showToast(error.message, 'error'); }
    finally { if (!controller.signal.aborted) { if (append) setPromptLoadingMore(false); else setPromptLoading(false); } }
  };
  useEffect(() => { loadMeta(); return () => promptAbort.current?.abort(); }, []);
  useEffect(() => { const timer = window.setTimeout(() => loadPrompts(0, false), promptSearch ? 350 : 0); return () => window.clearTimeout(timer); }, [promptFilter, promptSearch]);
  useEffect(() => { const timer = window.setTimeout(() => loadUsers(0, false), userSearch ? 350 : 0); return () => window.clearTimeout(timer); }, [userSearch, userStatus, userVerification, userRole]);

  const updatePrompt = async (id, patch) => { try { await api(`/api/admin/prompts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); setPrompts(items => items.map(item => item.id === id ? { ...item, ...patch } : item)); showToast(patch.status === 'published' ? 'Prompt approved and published' : patch.featured ? 'Prompt featured' : 'Prompt updated'); setDirty(true); loadMeta(); } catch (error) { showToast(error.message, 'error'); } };
  const deletePrompt = async (id) => { if (!window.confirm('Remove this prompt from the gallery?')) return; try { await api(`/api/admin/prompts/${id}`, { method: 'DELETE' }); setDeletedPromptIds(ids => ids.includes(id) ? ids : [...ids, id]); setPrompts(items => items.filter(item => item.id !== id)); setPromptTotal(value => Math.max(0, value - 1)); setDirty(true); showToast('Prompt removed — press Save changes to keep it removed.'); loadMeta(); } catch (error) { showToast(error.message, 'error'); } };
  const updateUser = async (id, patch) => { try { await api(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); setUsers(items => items.map(item => item.id === id ? { ...item, ...patch } : item)); showToast('User updated'); setDirty(true); } catch (error) { showToast(error.message, 'error'); } };
  const deleteUser = async (id) => { if (!window.confirm('Permanently remove this account?')) return; try { await api(`/api/admin/users/${id}`, { method: 'DELETE' }); setUsers(items => items.filter(item => item.id !== id)); setDirty(true); showToast('User removed — press Save changes to keep it removed.'); } catch (error) { showToast(error.message, 'error'); } };
  const openUser = async id => { try { const data = await api(`/api/admin/users/${id}`); setSelectedUser(data.user); } catch (error) { showToast(error.message, 'error'); } };
  const exportUsers = async () => {
    try {
      const headers = {};
      if (supabase) { const { data: { session } } = await supabase.auth.getSession(); if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`; }
      const response = await fetch('/api/admin/users/export', { credentials: 'same-origin', headers });
      if (!response.ok) throw new Error('Unable to export users right now.');
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'genvexa-users.csv'; link.click(); URL.revokeObjectURL(url); showToast('User CSV exported');
    } catch (error) { showToast(error.message, 'error'); }
  };
  const saveChanges = async () => {
    const saved = new Date().toISOString();
    setAdminSnapshot({ savedAt: saved, prompts, users, deletedPromptIds });
    setSavedAt(saved);
    setDirty(false);
    try { await api('/api/admin/save', { method: 'POST', body: JSON.stringify({ savedAt: saved, deletedPromptIds }) }); showToast('Changes saved successfully'); }
    catch (error) { showToast(`Saved on this device. ${error.message}`, 'error'); }
  };

  const navItems = [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'prompts', label: 'Prompts', icon: FileImage, badge: stats?.pending || 0 }, { id: 'users', label: 'Users', icon: Users }, { id: 'activity', label: 'Activity', icon: BarChart3 }];
  return <div className="admin-shell"><aside className="admin-sidebar"><div className="admin-brand"><span className="brand-mark"><Crown size={17} fill="currentColor" /></span><div><strong>Genvexa</strong><small>Admin studio</small></div></div><div className="admin-nav-label">Workspace</div>{navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={`admin-nav-row ${section === item.id ? 'admin-nav-active' : ''}`} aria-current={section === item.id ? 'page' : undefined} aria-label={item.label} onClick={() => setSection(item.id)}><Icon size={17} /><span>{item.label}</span>{item.badge ? <span className="admin-nav-badge">{item.badge}</span> : null}</button>; })}<div className="admin-nav-label admin-nav-label-gap">System</div><button className="admin-nav-row" aria-label="Open settings" onClick={() => showToast('Settings are available in your deployment configuration')}><Settings2 size={17} /><span>Settings</span></button><button className="admin-nav-row" aria-label="View public gallery" onClick={() => navigate('/')}><ExternalLink size={17} /><span>View gallery</span></button><div className="admin-sidebar-bottom"><div className="system-status"><span className="status-pulse" /><span>{metaLoading ? 'Checking services…' : systemHealthy ? 'Services healthy' : 'Service check failed'}</span></div><button className="admin-user" onClick={onLogout} aria-label="Sign out"><span className="avatar avatar-small admin-avatar">{user.avatar}</span><span><strong>{user.name}</strong><small>Administrator</small></span><LogOut size={14} /></button></div></aside><main className="admin-main"><header className="admin-topbar"><div><span className="admin-breadcrumb">CONTROL ROOM <span>/</span> {section}</span><h1>{section === 'overview' ? `Welcome back, ${user.name.split(' ')[0]}.` : section[0].toUpperCase() + section.slice(1)}</h1></div><div className="admin-top-actions"><button className="theme-button admin-theme-button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button><button className={`admin-save ${dirty ? 'admin-save-dirty' : ''}`} onClick={saveChanges} aria-label={dirty ? 'Save changes' : 'All changes saved'}><Check size={15} /> {dirty ? 'Save changes' : savedAt ? 'Saved' : 'Save'}</button><button className="admin-help" onClick={() => showToast('For help, contact support@genvexa.app')}><LifeBuoy size={16} /> Help center</button><button className="admin-create" onClick={() => setAdminModal('create')}><Plus size={16} /> New prompt</button></div></header>{section === 'overview' && <AdminOverview stats={stats} prompts={prompts} users={users} activities={activities} onNavigate={setSection} onApprove={(id) => updatePrompt(id, { status: 'published' })} onOpenPrompt={(prompt) => showToast(`Open “${prompt.title}” from the Prompts tab`)} />}{section === 'prompts' && <AdminPrompts prompts={prompts} total={promptTotal} hasMore={promptHasMore} filter={promptFilter} setFilter={setPromptFilter} search={promptSearch} setSearch={setPromptSearch} onUpdate={updatePrompt} onDelete={deletePrompt} loading={promptLoading} loadingMore={promptLoadingMore} onLoadMore={() => loadPrompts(prompts.length, true)} />}{section === 'users' && <AdminUsers stats={stats} users={users} total={userTotal} hasMore={userHasMore} loading={userLoading} search={userSearch} setSearch={setUserSearch} status={userStatus} setStatus={setUserStatus} verification={userVerification} setVerification={setUserVerification} role={userRole} setRole={setUserRole} onLoadMore={() => loadUsers(users.length, true)} onUpdate={updateUser} onDelete={deleteUser} onOpen={openUser} onExport={exportUsers} onInvite={() => showToast('Create accounts from the public sign-up page.')} />}{section === 'activity' && <AdminActivity activities={activities} prompts={prompts} onAction={() => showToast('Activity records are read-only audit entries')} />}</main>{adminModal === 'create' && <AdminPromptModal onClose={() => setAdminModal(null)} onSave={async payload => { try { const data = await api('/api/admin/prompts', { method: 'POST', body: JSON.stringify({ ...payload, status: 'published', creator: { name: user.name, handle: '@admin', avatar: user.avatar, color: '#7561d8' } }) }); setAdminModal(null); setPrompts(items => [data.prompt, ...items.filter(item => item.id !== data.prompt.id)].slice(0, 25)); setPromptTotal(value => value + 1); setDirty(true); showToast('Prompt created — press Save changes to keep a browser backup.'); } catch (error) { showToast(error.message, 'error'); } }} />}{selectedUser && <AdminUserDetails user={selectedUser} onClose={() => setSelectedUser(null)} />}{toast && <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite"><span className="toast-check">{toast.tone === 'error' ? <X size={14} /> : <Check size={14} />}</span>{toast.message}</div>}</div>;
}

function AdminOverview({ stats, prompts, users, activities, onNavigate, onApprove, onOpenPrompt }) {
  const cards = [{ label: 'Published prompts', value: stats?.prompts ?? '—', change: 'Live total', icon: FileImage, color: 'purple' }, { label: 'Active creators', value: stats?.creators ?? '—', change: 'Live total', icon: Users, color: 'blue' }, { label: 'Pending review', value: stats?.pending ?? '—', change: 'Needs action', icon: ShieldCheck, color: 'orange' }, { label: 'Prompt copies', value: formatCount(stats?.copies), change: 'Live total', icon: Copy, color: 'green' }];
  const pending = prompts.filter(prompt => prompt.status === 'pending').slice(0, 4);
  const metrics = [{ label: 'Published', value: Number(stats?.prompts || 0), color: 'purple' }, { label: 'Creators', value: Number(stats?.creators || 0), color: 'blue' }, { label: 'Copies', value: Number(stats?.copies || 0), color: 'green' }, { label: 'Views', value: Number(stats?.views || 0), color: 'orange' }];
  const maxMetric = Math.max(...metrics.map(metric => metric.value), 1);
  return <div className="admin-content"><div className="admin-stats">{cards.map(card => { const Icon = card.icon; return <div className="admin-stat-card" key={card.label}><div className={`stat-icon stat-${card.color}`}><Icon size={18} /></div><span className="admin-stat-label">{card.label}</span><strong>{card.value}</strong><span className={`stat-change ${card.color === 'orange' ? 'stat-alert' : ''}`}>{card.color === 'orange' ? 'Review queue' : <><TrendingUp size={12} /> {card.change} <small>updated now</small></>}</span></div>; })}</div><div className="admin-grid-main"><section className="panel performance-panel"><div className="panel-head"><div><span className="admin-panel-kicker">LIVE TOTALS</span><h2>Gallery performance</h2></div><button className="range-select" aria-label="View prompt library" onClick={() => onNavigate('prompts')}>View library <ArrowUpRight size={14} /></button></div><div className="metric-bars">{metrics.map(metric => <div className="metric-bar" key={metric.label}><div className="metric-bar-head"><span>{metric.label}</span><b>{formatCount(metric.value)}</b></div><div className="metric-bar-track"><span className={`metric-fill metric-fill-${metric.color}`} style={{ width: `${Math.max(7, metric.value / maxMetric * 100)}%` }} /></div></div>)}</div><div className="chart-footnote"><TrendingUp size={14} /> Values are calculated from the current content library.</div></section><section className="panel activity-panel"><div className="panel-head"><div><span className="admin-panel-kicker">LIVE FEED</span><h2>Recent activity</h2></div><button className="text-button" onClick={() => onNavigate('activity')}>View all <ArrowUpRight size={14} /></button></div><div className="activity-list">{activities.slice(0, 5).map(activity => <ActivityItem activity={activity} key={activity.id} />)}</div></section></div><div className="admin-grid-bottom"><section className="panel pending-panel"><div className="panel-head"><div><span className="admin-panel-kicker">MODERATION</span><h2>Needs your attention</h2></div><button className="text-button" onClick={() => onNavigate('prompts')}>See queue <ArrowUpRight size={14} /></button></div>{pending.length ? <div className="pending-list">{pending.map(prompt => <div className="pending-row" key={prompt.id}><img src={prompt.image} alt={`Preview for ${prompt.title}`} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/prompt-01.png'; }} /><div className="pending-info"><strong>{prompt.title}</strong><span>{prompt.creator?.name} · {timeAgo(prompt.createdAt)}</span></div><div className="pending-actions"><button className="reject-button" onClick={() => onApprove(prompt.id)}>Approve</button><button className="icon-button" title="Open prompt" aria-label={`Open ${prompt.title}`} onClick={() => onOpenPrompt(prompt)}><ArrowUpRight size={15} /></button></div></div>)}</div> : <div className="panel-empty"><Check size={19} /> Nothing waiting for review</div>}</section><section className="panel creators-panel"><div className="panel-head"><div><span className="admin-panel-kicker">COMMUNITY</span><h2>Top creators</h2></div><button className="text-button" onClick={() => onNavigate('users')}>All users <ArrowUpRight size={14} /></button></div><div className="creator-rank-list">{users.slice(0, 4).map((item, index) => <div className="creator-rank" key={item.id}><span className="rank-number">0{index + 1}</span><span className="avatar avatar-small" style={{ '--avatar-color': item.color || '#b6a9e9' }}>{item.avatar}</span><div><strong>{item.name}</strong><span>{item.role === 'creator' ? 'Creator' : item.role === 'admin' ? 'Admin' : 'Member'}</span></div><b>{item.role === 'creator' ? 'Creator' : item.role === 'admin' ? 'Admin' : 'Member'}</b></div>)}</div></section></div></div>;
}

function ActivityItem({ activity }) {
  const action = activity.type || activity.action || 'event';
  const icons = { publish: Upload, feature: Star, signup: UserPlus, copy: Copy, approve: Check, delete: Trash2, 'user.update': PenLine, 'user.delete': Trash2, export: Download };
  const Icon = icons[action] || icons[action.split('.').pop()] || MessageCircle;
  const text = activity.text || `${action.replace(/[._]/g, ' ')}${activity.target_user_id ? ` · ${activity.target_user_id}` : ''}`;
  const timestamp = activity.time || activity.created_at;
  return <div className="activity-item"><span className={`activity-icon activity-${action.replace('.', '-')}`}><Icon size={14} /></span><div><p>{text}</p><span>{timeAgo(timestamp)}</span></div></div>;
}

function AdminPrompts({ prompts, total, hasMore, filter, setFilter, search, setSearch, onUpdate, onDelete, loading, loadingMore, onLoadMore }) {
  return <div className="admin-content"><div className="section-toolbar"><div className="admin-search"><Search size={16} /><input aria-label="Search prompts and creators" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search prompts, creators..." /></div><div className="filter-pills" role="group" aria-label="Prompt status filter">{[['all', 'All prompts'], ['published', 'Published'], ['pending', 'Pending'], ['rejected', 'Rejected']].map(([id, label]) => <button key={id} className={filter === id ? 'filter-pill-active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div><button className="filter-square" aria-label="Clear prompt filters" title="Clear filters" onClick={() => { setFilter('all'); setSearch(''); }}><Filter size={15} /></button></div><section className="panel admin-table-panel"><div className="admin-table-head"><div><span className="admin-panel-kicker">CONTENT LIBRARY</span><h2>{filter === 'all' ? 'All prompts' : `${filter[0].toUpperCase() + filter.slice(1)} prompts`}</h2></div><span className="table-count">{total} items</span></div>{loading ? <div className="table-loading" role="status"><span className="spinner" /> Loading prompt library...</div> : <><div className="admin-table-wrap"><table className="admin-table"><caption className="sr-only">Prompt content library</caption><thead><tr><th scope="col">Prompt</th><th scope="col">Creator</th><th scope="col">Model</th><th scope="col">Status</th><th scope="col">Engagement</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{prompts.map(prompt => <tr key={prompt.id}><td><div className="table-prompt"><img src={prompt.image} alt={`Preview for ${prompt.title}`} loading="lazy" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/prompt-01.png'; }} /><div><strong>{prompt.title}</strong><span>{prompt.category} · {timeAgo(prompt.createdAt)}</span></div></div></td><td><div className="table-creator"><span className="avatar avatar-tiny" style={{ '--avatar-color': prompt.creator?.color }}>{prompt.creator?.avatar}</span>{prompt.creator?.name}</div></td><td><span className="table-model">{prompt.model}</span></td><td><span className={`status-badge status-${prompt.status}`}>{prompt.status === 'published' ? <Check size={11} /> : prompt.status === 'pending' ? <Clock3 size={11} /> : <X size={11} />}{prompt.status}</span>{prompt.featured && <span className="mini-featured"><Star size={10} fill="currentColor" /></span>}</td><td><div className="engagement"><span><Copy size={12} /> {formatCount(prompt.copies)}</span><span><Heart size={12} /> {formatCount(prompt.likes)}</span></div></td><td><div className="table-actions">{prompt.status === 'pending' && <button className="approve-icon" aria-label={`Approve ${prompt.title}`} title="Approve" onClick={() => onUpdate(prompt.id, { status: 'published' })}><Check size={15} /></button>}{prompt.status === 'published' && <button className="feature-icon" aria-label={`${prompt.featured ? 'Unfeature' : 'Feature'} ${prompt.title}`} title={prompt.featured ? 'Unfeature' : 'Feature'} onClick={() => onUpdate(prompt.id, { featured: !prompt.featured })}><Star size={15} fill={prompt.featured ? 'currentColor' : 'none'} /></button>}<button className="delete-icon" aria-label={`Delete ${prompt.title}`} title="Delete" onClick={() => onDelete(prompt.id)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{!prompts.length && <div className="table-empty">No prompts match this filter.</div>}</div>{hasMore && <div className="admin-load-more"><button className="button-secondary" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? <><span className="spinner" /> Loading...</> : <>Load more prompts <ChevronDown size={15} /></>}</button><span>Showing {prompts.length} of {total}</span></div>}</>}</section></div>;
}

function AdminUsers({ stats, users, total, hasMore, loading, search, setSearch, status, setStatus, verification, setVerification, role, setRole, onLoadMore, onUpdate, onDelete, onOpen, onExport, onInvite }) {
  const dateLabel = value => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  return <div className="admin-content"><div className="admin-page-intro"><div><span className="admin-panel-kicker">COMMUNITY DIRECTORY</span><h2>Users</h2><p>Manage registered users, account status, verification, and activity.</p></div><div className="admin-page-intro-actions"><button className="admin-secondary" onClick={onExport}><Download size={15} /> Export CSV</button><button className="admin-create" onClick={onInvite}><UserPlus size={16} /> Sign-up instructions</button></div></div><div className="user-summary-stats"><div><span>Total users</span><strong>{stats?.users ?? '—'}</strong></div><div><span>Verified</span><strong>{stats?.verifiedUsers ?? '—'}</strong></div><div><span>Unverified</span><strong>{stats?.unverifiedUsers ?? '—'}</strong></div><div><span>New in 30 days</span><strong>{stats?.newUsers ?? '—'}</strong></div></div><div className="user-filter-toolbar"><div className="admin-search"><Search size={16} /><input aria-label="Search users" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search users..." /></div><select aria-label="Filter users by status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="disabled">Disabled</option></select><select aria-label="Filter users by verification" value={verification} onChange={event => setVerification(event.target.value)}><option value="all">All verification</option><option value="verified">Verified</option><option value="unverified">Unverified</option></select><select aria-label="Filter users by role" value={role} onChange={event => setRole(event.target.value)}><option value="all">All roles</option><option value="user">User</option><option value="creator">Creator</option><option value="admin">Admin</option></select></div><section className="panel admin-table-panel"><div className="admin-table-head"><div><span className="admin-panel-kicker">ACCOUNT DIRECTORY</span><h2>{total} registered users</h2></div><span className="table-count">Server-paginated</span></div>{loading ? <div className="table-loading" role="status"><span className="spinner" /> Loading users...</div> : <><div className="admin-table-wrap"><table className="admin-table users-table"><caption className="sr-only">Genvexa registered users</caption><thead><tr><th scope="col">User</th><th scope="col">Email</th><th scope="col">Status</th><th scope="col">Verification</th><th scope="col">Auth method</th><th scope="col">Registered</th><th scope="col">Last sign-in</th><th scope="col">Role</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{users.map(item => <tr key={item.id}><td><div className="table-creator"><span className="avatar avatar-small" style={{ '--avatar-color': item.color || '#b6a9e9' }}>{item.avatar || initials(item.name)}</span><button className="user-name-button" onClick={() => onOpen(item.id)}>{item.name || 'Unnamed user'}</button></div></td><td>{item.email || '—'}</td><td><span className={`status-badge status-${item.status === 'active' ? 'published' : 'pending'}`}><span className="status-dot" />{item.status || 'unknown'}</span></td><td><span className={`verification-badge ${item.emailVerifiedAt ? 'verification-verified' : 'verification-unverified'}`}>{item.emailVerifiedAt ? <Check size={11} /> : <Clock3 size={11} />}{item.emailVerifiedAt ? 'Verified' : 'Unverified'}</span></td><td>{item.authProvider || 'email'}</td><td>{dateLabel(item.joinedAt)}</td><td>{dateLabel(item.lastSignInAt)}</td><td><span className={`role-badge role-${item.role}`}>{item.role || 'user'}</span></td><td><div className="user-actions"><button className="user-action" aria-label={`${item.status === 'active' ? 'Suspend' : 'Activate'} ${item.name}`} onClick={() => onUpdate(item.id, { status: item.status === 'active' ? 'suspended' : 'active' })}>{item.status === 'active' ? 'Suspend' : 'Activate'}</button>{item.role !== 'admin' && <button className="user-delete" aria-label={`Remove ${item.name}`} onClick={() => onDelete(item.id)}>Remove</button>}</div></td></tr>)}</tbody></table>{!users.length && <div className="table-empty">{search || status !== 'all' || verification !== 'all' || role !== 'all' ? 'No matching users.' : 'Registered users will appear here.'}</div>}</div>{hasMore && <div className="admin-load-more"><button className="button-secondary" onClick={onLoadMore}>Load more users <ChevronDown size={15} /></button><span>Showing {users.length} of {total}</span></div>}</>}</section></div>;
}

function AdminUserDetails({ user, onClose }) { const dateLabel = value => value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; return <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><div className="user-details-modal" role="dialog" aria-modal="true" aria-labelledby="user-details-title"><button className="modal-close" aria-label="Close user details" onClick={onClose}><X size={18} /></button><div className="user-details-head"><span className="avatar avatar-large" style={{ '--avatar-color': user.color || '#7561d8' }}>{user.avatar || initials(user.name)}</span><div><span className="admin-panel-kicker">USER PROFILE</span><h2 id="user-details-title">{user.name || 'Unnamed user'}</h2><p>{user.email || 'No email available'}</p></div></div><div className="user-detail-grid"><div><span>User ID</span><strong>{user.id}</strong></div><div><span>Role</span><strong>{user.role || 'user'}</strong></div><div><span>Status</span><strong>{user.status || 'unknown'}</strong></div><div><span>Email verification</span><strong>{user.emailVerifiedAt ? 'Verified' : 'Unverified'}</strong></div><div><span>Authentication</span><strong>{user.authProvider || 'email'}</strong></div><div><span>Registered</span><strong>{dateLabel(user.joinedAt)}</strong></div><div><span>Last sign-in</span><strong>{dateLabel(user.lastSignInAt)}</strong></div></div></div></div>; }

function AdminActivity({ activities, prompts, onAction }) {
  const [newestFirst, setNewestFirst] = useState(true);
  const visible = newestFirst ? activities : [...activities].reverse();
  return <div className="admin-content"><div className="admin-page-intro"><div><span className="admin-panel-kicker">AUDIT LOG</span><h2>Platform activity</h2><p>A running log of important events across the gallery.</p></div><button className="range-select" onClick={() => setNewestFirst(value => !value)} aria-label="Toggle activity order"><Clock3 size={14} /> {newestFirst ? 'Latest first' : 'Oldest first'} <ChevronDown size={14} /></button></div><section className="panel full-activity-panel"><div className="full-activity-list">{visible.map(activity => <div className="full-activity-row" key={activity.id}><ActivityItem activity={activity} /><span className="activity-id">{activity.promptId ? prompts.find(prompt => prompt.id === activity.promptId)?.title || 'Prompt record' : activity.target_user_id ? `User ${activity.target_user_id}` : 'Account event'}</span><button className="icon-button" aria-label="View activity details" onClick={onAction}><Ellipsis size={16} /></button></div>)}</div></section></div>;
}

function AdminPromptModal({ onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState('Ads & Product');
  const [model, setModel] = useState('GPT Image');
  const [image, setImage] = useState('');
  const [imageName, setImageName] = useState('');
  const [imageError, setImageError] = useState('');
  const [video, setVideo] = useState('');
  const [videoName, setVideoName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoError, setVideoError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const imageInputId = 'admin-prompt-image';
  const videoInputId = 'admin-prompt-video';
  const maxImageBytes = 2 * 1024 * 1024;
  const maxVideoBytes = 3 * 1024 * 1024;

  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > maxImageBytes) {
      setImage(''); setImageName(''); setImageError('Image must be 2 MB or smaller.'); event.target.value = ''; return;
    }
    setImageError('');
    const reader = new FileReader();
    reader.onload = () => { setImage(String(reader.result || '')); setImageName(file.name); };
    reader.onerror = () => { setImage(''); setImageName(''); setImageError('The image could not be read.'); };
    reader.readAsDataURL(file);
  };
  const handleVideo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) { setVideoError('Please choose a video file.'); event.target.value = ''; return; }
    if (file.size > maxVideoBytes) {
      setVideo(''); setVideoName(''); setVideoError('Video uploads must be 3 MB or smaller. Paste a hosted video URL for larger files.'); event.target.value = ''; return;
    }
    setVideoError(''); setVideoUrl('');
    const reader = new FileReader();
    reader.onload = () => { setVideo(String(reader.result || '')); setVideoName(file.name); };
    reader.onerror = () => { setVideo(''); setVideoName(''); setVideoError('The video could not be read.'); };
    reader.readAsDataURL(file);
  };
  const removeImage = () => { setImage(''); setImageName(''); setImageError(''); const input = document.getElementById(imageInputId); if (input) input.value = ''; };
  const removeVideo = () => { setVideo(''); setVideoName(''); setVideoUrl(''); setVideoError(''); const input = document.getElementById(videoInputId); if (input) input.value = ''; };
  const selectedVideo = video || videoUrl.trim();
  const submit = async (event) => {
    event.preventDefault();
    if (imageError || videoError) return;
    setSaving(true); setError('');
    try { await onSave({ title, prompt, category, model, image, poster: image, video: selectedVideo, mediaType: selectedVideo ? 'video' : 'image', excerpt: prompt.slice(0, 110) }); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="admin-prompt-modal" role="dialog" aria-modal="true" aria-labelledby="admin-prompt-dialog-title"><button className="modal-close" aria-label="Close create prompt dialog" onClick={onClose}><X size={18} /></button><span className="section-kicker">CONTENT LIBRARY</span><h2 id="admin-prompt-dialog-title">Create a prompt</h2><p>Add a prompt and optional image or video media directly to the gallery.</p><form onSubmit={submit}><label>Title<input required value={title} onChange={event => setTitle(event.target.value)} placeholder="Prompt title" /></label><label>Prompt<textarea required value={prompt} onChange={event => setPrompt(event.target.value)} rows="7" placeholder="Write the prompt..." /></label><div className="admin-upload-field"><div className="upload-field-label"><span>Cover image</span><small>Optional · maximum 2 MB</small></div>{image ? <div className="image-upload-preview"><img src={image} alt="Selected cover preview" /><div><strong>{imageName}</strong><span>Ready to attach to this prompt</span></div><button type="button" className="remove-upload" aria-label="Remove cover image" onClick={removeImage}><X size={14} /></button></div> : <label className={`image-upload ${imageError ? 'image-upload-error' : ''}`} htmlFor={imageInputId}><ImagePlus size={20} /><span><strong>Choose an image</strong><small>PNG, JPG, GIF, or WebP · 2 MB max</small></span><input id={imageInputId} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImage} /></label>}{imageError && <div className="upload-error-text">{imageError}</div>}</div><div className="admin-upload-field"><div className="upload-field-label"><span>Video result</span><small>Optional · upload up to 3 MB or use a hosted URL</small></div>{selectedVideo ? <div className="video-upload-preview"><video src={selectedVideo} controls muted playsInline /><div><strong>{videoName || videoUrl}</strong><span>{video ? 'Local video ready to attach' : 'Hosted video URL ready'}</span></div><button type="button" className="remove-upload" aria-label="Remove video" onClick={removeVideo}><X size={14} /></button></div> : <label className={`image-upload video-upload ${videoError ? 'image-upload-error' : ''}`} htmlFor={videoInputId}><Clapperboard size={20} /><span><strong>Upload a video</strong><small>MP4, WebM, MOV, or OGG · 3 MB max</small></span><input id={videoInputId} type="file" accept="video/mp4,video/webm,video/quicktime,video/ogg" onChange={handleVideo} /></label>}{!selectedVideo && <div className="video-url-row"><span>or paste video URL</span><input aria-label="Hosted video URL" type="url" value={videoUrl} onChange={event => { setVideoUrl(event.target.value); setVideo(''); setVideoName(''); setVideoError(''); }} placeholder="https://cdn.example.com/video.mp4" /></div>}{videoError && <div className="upload-error-text">{videoError}</div>}</div><div className="form-grid"><label>Category<select value={category} onChange={event => setCategory(event.target.value)}>{categories.filter(item => item.name !== 'All').map(item => <option key={item.name}>{item.name}</option>)}</select></label><label>Model<select value={model} onChange={event => setModel(event.target.value)}>{modelOptions.map(option => <option key={option}>{option}</option>)}</select></label></div>{error && <div className="form-error">{error}</div>}<div className="admin-modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" disabled={saving || Boolean(imageError) || Boolean(videoError)}>{saving ? 'Creating...' : 'Create prompt'} <ArrowUpRight size={15} /></button></div></form></div></div>;
}


createRoot(document.getElementById('root')).render(<App />);
