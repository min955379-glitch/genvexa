import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft, ArrowUpRight, BarChart3, Bookmark, Bot, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Clapperboard, Clipboard, Clock3, Command, Copy, Crown, Download, Ellipsis,
  ExternalLink, Eye, FileImage, Filter, FolderHeart, GalleryHorizontalEnd, Grid2X2, Heart,
  ImagePlus, LayoutDashboard, LifeBuoy, LogIn, LogOut, Menu, MessageCircle, MoreHorizontal,
  PanelLeftClose, PanelLeftOpen, PenLine, Play, Plus, Search, Settings2, ShieldCheck, Sparkles,
  Star, Tag, Trash2, TrendingUp, Upload, UserPlus, Users, WandSparkles, X, Zap
} from 'lucide-react';
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
const ratios = ['4:5', '1:1', '9:16', '16:9'];

const skills = [
  { title: 'Ad Studio', description: 'Turn a product idea into a complete commercial visual direction.', icon: Zap, color: 'coral', tags: ['product', 'campaign'] },
  { title: 'Portrait Director', description: 'Build consistent character portraits with camera and lighting notes.', icon: WandSparkles, color: 'lilac', tags: ['portrait', 'editorial'] },
  { title: 'Storyboard Kit', description: 'Shape a rough idea into a cinematic sequence ready for video models.', icon: Clapperboard, color: 'mint', tags: ['video', 'sequence'] },
  { title: 'Brand Builder', description: 'Explore packaging, logo, and visual identity concepts in one flow.', icon: Sparkles, color: 'sun', tags: ['identity', 'brand'] }
];

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const adminToken = sessionStorage.getItem('genvexa_admin_token');
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function getStoredUser() {
  try {
    const user = JSON.parse(localStorage.getItem('genvexa_user') || 'null');
    if (user?.role === 'admin') { localStorage.removeItem('genvexa_user'); sessionStorage.removeItem('genvexa_admin_token'); return null; }
    return user;
  } catch { return null; }
}
function setStoredUser(user) {
  if (user?.role === 'admin') localStorage.removeItem('genvexa_user');
  else if (user) localStorage.setItem('genvexa_user', JSON.stringify(user));
  else localStorage.removeItem('genvexa_user');
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

  useEffect(() => {
    const handlePop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = (nextPath) => {
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  };
  const onLogin = (nextUser, token) => {
    setUser(nextUser);
    setStoredUser(nextUser);
    if (nextUser?.role === 'admin') sessionStorage.setItem('genvexa_admin_token', token || '');
    else sessionStorage.removeItem('genvexa_admin_token');
  };
  const onLogout = () => { setUser(null); setStoredUser(null); sessionStorage.removeItem('genvexa_admin_token'); navigate('/'); };

  if (path.startsWith('/admin')) {
    return <AdminApp user={user} onLogin={onLogin} onLogout={onLogout} navigate={navigate} />;
  }
  return <MainApp user={user} onLogin={onLogin} onLogout={onLogout} navigate={navigate} />;
}

function MainApp({ user, onLogin, onLogout, navigate }) {
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

  useEffect(() => { loadPrompts(); }, [model, category, sort, search]);
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setQueryOpen(true); }
      if (event.key === 'Escape') { setQueryOpen(false); setSelectedPrompt(null); setModal(null); }
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
    try {
      const data = await api(`/api/prompts/${prompt.id}`);
      setSelectedPrompt(data.prompt);
    } catch { /* keep the card data available if the detail call is unavailable */ }
  };

  const handleCopy = async (prompt) => {
    try { await navigator.clipboard?.writeText(prompt.prompt); } catch { /* clipboard can be unavailable in a sandbox */ }
    try {
      const result = await api(`/api/prompts/${prompt.id}/copy`, { method: 'POST', body: JSON.stringify({}) });
      setPrompts(items => items.map(item => item.id === prompt.id ? { ...item, copies: result.copies } : item));
    } catch { /* the UI still gives feedback */ }
    addHistory(prompt.id);
    showToast('Prompt copied to clipboard', 'success');
  };

  const toggleLike = async (prompt) => {
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

  const submitLogin = async (email, password) => {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    onLogin(data.user, data.token);
    setModal(null);
    showToast(`Welcome back, ${data.user.name.split(' ')[0]}`, 'success');
  };

  const submitPublish = async (payload) => {
    await api('/api/prompts', { method: 'POST', body: JSON.stringify({ ...payload, creator: user ? { name: user.name, handle: `@${user.name.toLowerCase().replace(/\s+/g, '')}`, avatar: user.avatar || initials(user.name), color: '#7561d8' } : undefined }) });
    setModal(null);
    showToast('Submitted for review. You will earn 50 credits if featured.', 'success');
    loadPrompts();
  };

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        category={category}
        onView={selectView}
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
          onAdmin={() => navigate('/admin')}
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
            onGenerate={(prompt) => { setSelectedPrompt(prompt); setModal('generate'); }}
            onClear={() => { setSearch(''); setCategory('All'); setModel('All'); }}
            search={search}
            totalCount={totalPrompts}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          />
        )}
        {view === 'skills' && <SkillsView onUse={(skill) => { setModal('generate'); setSelectedPrompt({ ...prompts[0], title: skill.title, prompt: `${skill.description}\n\nCreate a complete prompt for this direction.`, model: 'GPT Image' }); }} />}
        {view === 'history' && <CollectionView type="history" prompts={visiblePrompts} onOpen={openPrompt} onCopy={handleCopy} onLike={toggleLike} liked={liked} emptyMessage="Your viewed prompts will appear here." />}
        {view === 'favorites' && <CollectionView type="favorites" prompts={visiblePrompts} onOpen={openPrompt} onCopy={handleCopy} onLike={toggleLike} liked={liked} emptyMessage={user ? 'Save prompts you want to reuse and they will appear here.' : 'Sign in to keep your favorites in sync.'} />}
        <Footer />
      </main>

      {queryOpen && <SearchPalette value={search} onChange={setSearch} onClose={() => setQueryOpen(false)} onSubmit={() => { setQueryOpen(false); setView('home'); }} />}
      {selectedPrompt && modal !== 'generate' && <PromptModal prompt={selectedPrompt} prompts={prompts} liked={liked.includes(selectedPrompt.id)} favorite={Boolean(user?.favorites?.includes(selectedPrompt.id))} onClose={() => setSelectedPrompt(null)} onCopy={handleCopy} onLike={toggleLike} onFavorite={toggleFavorite} onGenerate={() => setModal('generate')} onOpen={openPrompt} />}
      {modal === 'auth' && <AuthModal onClose={() => setModal(null)} onSubmit={submitLogin} />}
      {modal === 'account' && <AccountPopover user={user} onClose={() => setModal(null)} onLogin={() => setModal('auth')} onLogout={onLogout} onAdmin={() => { setModal(null); navigate('/admin'); }} />}
      {modal === 'generate' && selectedPrompt && <GenerateModal prompt={selectedPrompt} onClose={() => { setModal(null); setSelectedPrompt(null); }} onToast={showToast} />}
      {modal === 'publish' && <PublishModal user={user} onClose={() => setModal(null)} onSubmit={submitPublish} onLogin={() => setModal('auth')} />}
      {toast && <div className={`toast toast-${toast.tone}`}><span className="toast-check">{toast.tone === 'error' ? <X size={14} /> : <Check size={14} />}</span>{toast.message}</div>}
    </div>
  );
}

function Sidebar({ view, category, onView, onCategory, onPublish, mobileOpen, onCloseMobile }) {
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
        <button className="mobile-close" onClick={onCloseMobile}><PanelLeftClose size={18} /></button>
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map(item => {
          const Icon = item.icon;
          const active = item.id === 'search' ? false : view === item.id;
          return <button key={item.id} className={`nav-row ${active ? 'nav-active' : ''}`} onClick={() => item.id === 'search' ? onView('home') : onView(item.id)}>
            <Icon size={17} strokeWidth={active ? 2.2 : 1.8} /><span>{item.name}</span>{item.badge && <span className="nav-badge">{item.badge}</span>}
          </button>;
        })}
      </nav>
      <div className="sidebar-section-label">Categories</div>
      <div className="category-list">
        {categories.map(item => {
          const Icon = item.icon;
          const active = category === item.name && view === 'home';
          return <button key={item.name} className={`category-row ${active ? 'category-active' : ''}`} onClick={() => onCategory(item.name)}><Icon size={15} /><span>{item.name}</span></button>;
        })}
      </div>
      <div className="sidebar-section-label recent-label">Recent Updates</div>
      <div className="recent-link"><span className="recent-dot" />GPT Image 2 prompts <span className="recent-new">New</span></div>
      <div className="sidebar-section-label">More from us</div>
      <a className="external-row" href="https://github.com/jau123/MeiGen-AI-Design-MCP" target="_blank" rel="noreferrer"><span className="github-mark">⌁</span><span>MCP Server</span><span className="github-count">1.7k</span><ExternalLink size={12} /></a>
      <a className="external-row" href="/app" onClick={(event) => event.preventDefault()}><span className="app-dot"><Sparkles size={12} /></span><span>Mobile App</span><span className="recent-new">New</span></a>
      <div className="sidebar-bottom">
        <button className="publish-card" onClick={onPublish}>
          <span className="publish-icon"><Upload size={17} /></span>
          <span><strong>Publish & earn credits</strong><small>50 credits when featured</small></span>
          <ChevronRight size={15} />
        </button>
        <div className="sidebar-legal"><a href="/terms" onClick={(event) => event.preventDefault()}>Terms</a><span>·</span><a href="/privacy-policy" onClick={(event) => event.preventDefault()}>Privacy</a><span>·</span><a href="/refund-policy" onClick={(event) => event.preventDefault()}>Refund</a></div>
      </div>
    </aside>
  );
}

function Topbar({ user, search, onSearch, onPublish, onAccount, onMenu, onAdmin }) {
  return <header className="topbar">
    <button className="menu-button" onClick={onMenu}><Menu size={20} /></button>
    <button className="top-search" onClick={onSearch}><Search size={17} /><span>{search || 'Search prompts, styles, creators...'}</span><kbd><Command size={11} />K</kbd></button>
    <div className="topbar-actions">
      <button className="topbar-link desktop-only" onClick={onPublish}><Plus size={16} /> Publish</button>
      <button className="credits-pill" onClick={() => {}}><Zap size={14} fill="currentColor" />{user?.credits ?? 25}<span>credits</span></button>
      <button className="account-button" onClick={onAccount} aria-label="Open account"><span className="avatar avatar-top" style={{ '--avatar-color': user?.color || '#b6a9e9' }}>{user?.avatar || 'ME'}</span><ChevronDown size={14} className="desktop-only" /></button>
    </div>
  </header>;
}

function HomeView({ prompts, loading, model, setModel, sort, setSort, category, setCategory, liked, user, onOpen, onCopy, onLike, onFavorite, onGenerate, onClear, search, totalCount, hasMore, loadingMore, onLoadMore }) {
  return <>
    <section className="hero-section">
      <div className="hero-eyebrow"><span className="eyebrow-dot" /> CURATED DAILY <span className="eyebrow-rule" /> <span className="eyebrow-muted">Ideas that are ready to create</span></div>
      <h1>Free AI Prompts <em>Gallery</em></h1>
      <p className="hero-copy">Browse thousands of prompts for GPT Image, Nano Banana, Seedance, Midjourney and more. Copy, remix, and make something you love.</p>
      <div className="hero-actions"><button className="button-primary" onClick={() => document.querySelector('.gallery-section')?.scrollIntoView({ behavior: 'smooth' })}>Explore prompts <ArrowDownIcon /></button><button className="button-quiet" onClick={() => document.querySelector('.how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>How it works <ArrowUpRight size={15} /></button></div>
      <div className="hero-stats"><span><strong>12k+</strong> prompts</span><span><strong>5</strong> creative models</span><span><strong>Daily</strong> new ideas</span></div>
    </section>
    <section className="gallery-section">
      <div className="gallery-toolbar">
        <div className="model-tabs">
          {modelTabs.map(tab => <button key={tab} className={model === tab ? 'tab-active' : ''} onClick={() => setModel(tab)}>{tab}{tab === 'Seedance' && <span className="tab-new">2.0</span>}</button>)}
        </div>
        <div className="sort-tabs"><span className="sort-label">Sort by</span><button className={sort === 'featured' ? 'sort-active' : ''} onClick={() => setSort('featured')}><Star size={13} /> Featured</button><button className={sort === 'newest' ? 'sort-active' : ''} onClick={() => setSort('newest')}><Clock3 size={13} /> Newest</button><button className={sort === 'popular' ? 'sort-active' : ''} onClick={() => setSort('popular')}><TrendingUp size={13} /> Popular</button></div>
      </div>
      {category === 'Videos' && <div className="video-library-banner"><div className="video-banner-art"><span className="video-pulse" /><Play size={21} fill="currentColor" /></div><div className="video-banner-copy"><span className="section-kicker">SEEDANCE VIDEO LIBRARY</span><h3>Watch & remix video prompts.</h3><p>Play the original clips, copy the full production prompt, then use it as a starting point for your next scene.</p></div><div className="video-banner-metrics"><span><strong>{prompts.length}</strong> video prompts</span><span><strong>15s</strong> cinematic clips</span></div></div>}
      <div className="gallery-heading"><div><span className="section-kicker">DISCOVER</span><h2>{search ? `Results for “${search}”` : category === 'All' ? 'Fresh inspiration' : category}</h2></div><div className="gallery-meta"><span>{loading ? 'Loading...' : `${totalCount || prompts.length} prompts`}</span><button className="filter-button" onClick={onClear}><Filter size={14} /> {category !== 'All' || model !== 'All' || search ? 'Clear filters' : 'All prompts'}</button></div></div>
      {loading ? <PromptSkeleton /> : prompts.length ? <div className="prompt-grid">{prompts.map(prompt => <PromptCard key={prompt.id} prompt={prompt} liked={liked.includes(prompt.id)} favorite={Boolean(user?.favorites?.includes(prompt.id))} onOpen={onOpen} onCopy={onCopy} onLike={onLike} onFavorite={onFavorite} onGenerate={onGenerate} />)}</div> : <EmptyState onClear={onClear} />}
      {!loading && prompts.length > 0 && hasMore && <div className="load-more-wrap"><button className="button-secondary" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? <><span className="spinner" /> Loading more...</> : <>Load more prompts <ChevronDown size={15} /></>}</button><span>Showing {prompts.length} of {totalCount}</span></div>}
    </section>
    <section className="how-it-works"><div className="section-kicker">MAKE IT YOURS</div><h2>Copy an idea. Make it yours.</h2><div className="steps"><Step icon={Copy} number="01" title="Find your spark" text="Browse curated prompts from creators around the world." /><Step icon={Clipboard} number="02" title="Copy or remix" text="Take the exact prompt or adapt it to your own idea." /><Step icon={WandSparkles} number="03" title="Create magic" text="Generate a new image with the model and ratio you want." /></div></section>
  </>;
}

function ArrowDownIcon() { return <span className="arrow-down">↓</span>; }
function Step({ icon: Icon, number, title, text }) { return <div className="step"><div className="step-icon"><Icon size={18} /></div><span className="step-number">{number}</span><h3>{title}</h3><p>{text}</p></div>; }

function PromptCard({ prompt, liked, favorite, onOpen, onCopy, onLike, onFavorite, onGenerate }) {
  return <article className="prompt-card" onClick={() => onOpen(prompt)}>
    <div className="card-image-wrap" style={{ '--ratio': prompt.mediaType === 'video' ? '1.55' : prompt.ratio === '16:9' ? '1.15' : prompt.ratio === '9:16' ? '.72' : prompt.ratio === '1:1' ? '1' : '.82' }}>
      {prompt.mediaType === 'video' ? <video className="card-image" src={prompt.video} poster={prompt.poster || prompt.image} muted loop playsInline preload="metadata" onMouseEnter={event => event.currentTarget.play().catch(() => {})} onMouseLeave={event => { event.currentTarget.pause(); event.currentTarget.currentTime = 0; }} /> : <img className="card-image" src={prompt.image} alt={prompt.title} loading="lazy" />}
      <div className="card-image-shade" />
      <div className="card-topline"><span className="model-chip">{prompt.model}</span>{prompt.category === 'Videos' && <span className="video-chip"><Play size={10} fill="currentColor" /> {prompt.mediaType === 'video' ? 'Video' : 'Video prompt'}</span>}{prompt.featured && <span className="featured-chip"><Star size={11} fill="currentColor" /> Featured</span>}<button className="card-more" onClick={(event) => { event.stopPropagation(); onOpen(prompt); }}><MoreHorizontal size={17} /></button></div>
      <div className="card-hover-actions"><button title="Copy prompt" onClick={(event) => { event.stopPropagation(); onCopy(prompt); }}><Copy size={15} /></button><button title="Use this idea" onClick={(event) => { event.stopPropagation(); onGenerate(prompt); }}><Zap size={15} /></button></div>
    </div>
    <div className="card-content"><div className="card-title-row"><h3>{prompt.title}</h3><button className={`card-heart ${liked ? 'heart-on' : ''}`} onClick={(event) => { event.stopPropagation(); onLike(prompt); }}>{liked ? <Heart size={16} fill="currentColor" /> : <Heart size={16} />}</button></div><p>{prompt.excerpt}</p><div className="card-footer"><span className="creator"><span className="avatar avatar-small" style={{ '--avatar-color': prompt.creator?.color }}>{prompt.creator?.avatar || initials(prompt.creator?.name)}</span><span>{prompt.creator?.name}</span></span><span className="card-stats"><span><Copy size={12} />{formatCount(prompt.copies)}</span><span><Heart size={12} />{formatCount(prompt.likes)}</span></span></div></div>
  </article>;
}

function PromptSkeleton() { return <div className="prompt-grid">{[1, 2, 3, 4, 5, 6].map(item => <div className="skeleton-card" key={item}><div className="skeleton-image" /><div className="skeleton-line large" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>)}</div>; }
function EmptyState({ onClear }) { return <div className="empty-state"><span className="empty-icon"><Search size={22} /></span><h3>No prompts found</h3><p>Try a different search or clear the filters to explore the full gallery.</p><button className="button-secondary" onClick={onClear}>Clear filters</button></div>; }

function CollectionView({ type, prompts, onOpen, onCopy, onLike, liked, emptyMessage }) {
  return <section className="collection-view"><div className="collection-heading"><div className="section-kicker">YOUR SPACE</div><h1>{type === 'history' ? 'History' : 'Favorites'}</h1><p>{type === 'history' ? 'Pick up where you left off.' : 'A private shelf for ideas worth keeping.'}</p></div>{prompts.length ? <div className="prompt-grid">{prompts.map(prompt => <PromptCard key={prompt.id} prompt={prompt} liked={liked.includes(prompt.id)} onOpen={onOpen} onCopy={onCopy} onLike={onLike} onFavorite={() => {}} onGenerate={() => onOpen(prompt)} />)}</div> : <div className="empty-state collection-empty"><span className="empty-icon">{type === 'history' ? <Clock3 size={22} /> : <Heart size={22} />}</span><h3>{type === 'history' ? 'Nothing here yet' : 'No favorites yet'}</h3><p>{emptyMessage}</p></div>}</section>;
}

function SkillsView({ onUse }) { return <section className="skills-view"><div className="skill-hero"><div><div className="section-kicker">CREATIVE TOOLS</div><h1>Skills for better ideas.</h1><p>Start with a direction, not a blank page. Each skill gives you a focused creative workflow you can reuse.</p></div><div className="skill-orbit"><Sparkles size={26} /><span /><span /><span /></div></div><div className="skill-grid">{skills.map(skill => { const Icon = skill.icon; return <article className={`skill-card skill-${skill.color}`} key={skill.title}><div className="skill-icon"><Icon size={20} /></div><div className="skill-card-top"><span className="skill-pill">SKILL</span><ArrowUpRight size={16} /></div><h3>{skill.title}</h3><p>{skill.description}</p><div className="skill-tags">{skill.tags.map(tag => <span key={tag}>#{tag}</span>)}</div><button className="skill-use" onClick={() => onUse(skill)}>Use skill <ChevronRight size={15} /></button></article>; })}</div><div className="skills-note"><span><CircleHelp size={17} /></span><p><strong>What are Skills?</strong> Focused prompt recipes that help you move from a rough idea to a more useful first draft.</p></div></section>; }

function Footer() { return <footer className="site-footer"><div className="footer-brand"><span className="brand-mark brand-mark-small"><Crown size={13} fill="currentColor" /></span><strong>Genvexa</strong><span>Discover. Copy. Create.</span></div><div className="footer-links"><a href="/terms" onClick={(event) => event.preventDefault()}>Terms</a><a href="/privacy-policy" onClick={(event) => event.preventDefault()}>Privacy</a><a href="/refund-policy" onClick={(event) => event.preventDefault()}>Refunds</a><span>© 2026 Genvexa Studio</span></div></footer>; }

function SearchPalette({ value, onChange, onClose, onSubmit }) {
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); }, []);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="search-palette"><div className="palette-input"><Search size={19} /><input ref={input} value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => event.key === 'Enter' && onSubmit()} placeholder="Search prompts, models, creators..." /><kbd>ESC</kbd></div><div className="palette-body">{value ? <div className="palette-hint"><Sparkles size={16} /><span>Press <strong>Enter</strong> to explore matching prompts.</span></div> : <><div className="palette-label">Try searching for</div><div className="suggestion-row"><button onClick={() => onChange('product photography')}>product photography</button><button onClick={() => onChange('cinematic portrait')}>cinematic portrait</button><button onClick={() => onChange('tea packaging')}>tea packaging</button></div><div className="palette-label palette-bottom-label">Quick actions</div><button className="palette-action" onClick={onSubmit}><GalleryHorizontalEnd size={16} /><span>Browse all prompts</span><span className="action-key">↵</span></button><button className="palette-action" onClick={onClose}><Plus size={16} /><span>Close search</span><span className="action-key">esc</span></button></>}</div></div></div>;
}

function PromptModal({ prompt, prompts, liked, favorite, onClose, onCopy, onLike, onFavorite, onGenerate, onOpen }) {
  const related = prompts.filter(item => item.id !== prompt.id && (item.category === prompt.category || item.model === prompt.model)).slice(0, 3);
  const mediaImages = prompt.images?.length ? prompt.images : [prompt.image];
  const [activeImage, setActiveImage] = useState(0);
  useEffect(() => setActiveImage(0), [prompt.id]);
  return <div className="modal-backdrop prompt-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="prompt-modal"><button className="modal-close" onClick={onClose}><X size={18} /></button><div className="prompt-modal-media">{prompt.mediaType === 'video' ? <video className="prompt-modal-video" src={prompt.video} poster={prompt.poster || prompt.image} controls autoPlay muted loop playsInline /> : <img src={mediaImages[activeImage] || prompt.image} alt={prompt.title} />}<div className="media-float"><span className="model-chip">{prompt.model}</span><span className="ratio-chip">{prompt.ratio}</span>{prompt.category === 'Videos' && <span className="video-chip"><Play size={10} fill="currentColor" /> {prompt.mediaType === 'video' ? 'Video' : 'Video prompt'}</span>}</div>{prompt.mediaType !== 'video' && mediaImages.length > 1 && <div className="media-thumbs">{mediaImages.map((image, index) => <button key={image} className={activeImage === index ? 'media-thumb-active' : ''} onClick={() => setActiveImage(index)}><img src={image} alt={`Result ${index + 1}`} /><span>{index + 1}</span></button>)}</div>}</div><div className="prompt-modal-detail"><div className="detail-header"><div><span className="section-kicker">PROMPT DETAILS</span><h2>{prompt.title}</h2><div className="detail-creator"><span className="avatar avatar-small" style={{ '--avatar-color': prompt.creator?.color }}>{prompt.creator?.avatar}</span><span>{prompt.creator?.name}</span><span className="detail-dot">·</span><span>{timeAgo(prompt.createdAt)}</span></div></div><button className={`round-icon ${liked ? 'round-liked' : ''}`} onClick={() => onLike(prompt)}>{liked ? <Heart size={17} fill="currentColor" /> : <Heart size={17} />}</button></div><div className="prompt-box"><div className="prompt-box-top"><span>Prompt</span><button onClick={() => onCopy(prompt)}><Copy size={14} /> Copy</button></div><p>{prompt.prompt}</p><div className="tag-row">{prompt.tags?.map(tag => <span key={tag}>#{tag}</span>)}</div></div><div className="modal-actions"><button className="button-primary button-wide" onClick={onGenerate}><WandSparkles size={16} /> Use this idea</button><button className={`button-secondary save-button ${favorite ? 'save-on' : ''}`} onClick={() => onFavorite(prompt)}>{favorite ? <Bookmark size={16} fill="currentColor" /> : <Bookmark size={16} />} {favorite ? 'Saved' : 'Save'}</button><a className="source-link" href={prompt.sourceUrl} target="_blank" rel="noreferrer">View source <ExternalLink size={13} /></a></div><div className="related-section"><div className="related-heading"><span>More like this</span><span className="related-count">{related.length} results</span></div><div className="related-row">{related.map(item => <button className="related-card" key={item.id} onClick={() => onOpen(item)}><img src={item.image} alt="" /><span>{item.title}</span></button>)}</div></div></div></div></div>;
}


function AuthModal({ onClose, onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => { event.preventDefault(); setLoading(true); setError(''); try { await onSubmit(email, password); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="auth-modal"><button className="modal-close" onClick={onClose}><X size={18} /></button><div className="auth-logo"><span className="brand-mark"><Crown size={19} fill="currentColor" /></span></div><span className="section-kicker">WELCOME TO GENVEXA</span><h2>Keep your ideas close.</h2><p>Sign in to sync favorites, history, and credits across devices.</p><form onSubmit={submit}><label>Email or username<input type="text" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com or usertestpro" /></label><label>Password<input type="password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" /></label>{error && <div className="form-error">{error}</div>}<button className="button-primary button-wide" disabled={loading}>{loading ? 'Signing in...' : 'Continue'} <ArrowUpRight size={15} /></button></form><small className="auth-footnote">By continuing, you agree to our Terms and Privacy Policy.</small></div></div>;
}

function AccountPopover({ user, onClose, onLogin, onLogout, onAdmin }) {
  return <div className="popover-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="account-popover">{user ? <><div className="account-summary"><span className="avatar avatar-large" style={{ '--avatar-color': user.color || '#b6a9e9' }}>{user.avatar || initials(user.name)}</span><div><strong>{user.name}</strong><span>{user.email}</span></div></div><div className="account-credit"><span><Zap size={14} fill="currentColor" /> Available credits</span><strong>{user.credits ?? 25}</strong></div>{user.role === 'admin' && <button className="popover-row" onClick={onAdmin}><ShieldCheck size={16} /><span>Open admin portal</span><ArrowUpRight size={14} /></button>}<button className="popover-row" onClick={onLogout}><LogOut size={16} /><span>Sign out</span></button></> : <><div className="account-summary"><span className="avatar avatar-large">ME</span><div><strong>Guest workspace</strong><span>Sign in to sync your account</span></div></div><button className="button-primary button-wide" onClick={onLogin}><LogIn size={16} /> Sign in</button></>}</div></div>;
}

function GenerateModal({ prompt, onClose, onToast }) {
  const [text, setText] = useState(prompt.prompt || '');
  const [model, setModel] = useState(prompt.model || 'GPT Image');
  const [ratio, setRatio] = useState(prompt.ratio || '4:5');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const generate = async (event) => { event.preventDefault(); setGenerating(true); try { const data = await api('/api/generations', { method: 'POST', body: JSON.stringify({ promptId: prompt.id, prompt: text, model, ratio }) }); setResult(data.generation); onToast('Your creation is ready', 'success'); } catch (error) { onToast(error.message, 'error'); } finally { setGenerating(false); } };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className={`generate-modal ${result ? 'has-result' : ''}`}><div className="generate-head"><div><span className="section-kicker">CREATE WITH THIS IDEA</span><h2>{result ? 'Your creation is ready' : 'Make it yours'}</h2></div><button className="modal-close static-close" onClick={onClose}><X size={18} /></button></div>{result ? <div className="result-view"><div className="result-image-wrap">{result.mediaType === 'video' ? <video src={result.video || result.image} poster={result.poster || result.image} controls autoPlay muted loop playsInline /> : <img src={result.image} alt="Generated result" />}<span className="result-label"><Sparkles size={13} /> {result.mediaType === 'video' ? 'Video preview' : 'Generated preview'}</span></div><div className="result-info"><span className="result-status"><Check size={14} /> Generation complete</span><h3>{result.model} · {result.ratio}</h3><p>This demo is wired end-to-end. Connect your preferred image provider in <code>/api/generations</code> to return real generations.</p><button className="button-primary button-wide" onClick={() => { navigator.clipboard?.writeText(result.prompt); onToast('Prompt copied', 'success'); }}>Copy prompt <Copy size={15} /></button><button className="button-secondary button-wide" onClick={() => setResult(null)}>Make another</button></div></div> : <form className="generate-form" onSubmit={generate}><div className="generate-preview"><img src={prompt.image} alt="" /><div><strong>{prompt.title}</strong><span>{prompt.creator?.name} · {prompt.model}</span></div></div><label>Prompt<textarea value={text} onChange={event => setText(event.target.value)} rows="8" /></label><div className="form-grid"><label>Model<select value={model} onChange={event => setModel(event.target.value)}>{modelOptions.map(option => <option key={option}>{option}</option>)}</select></label><label>Aspect ratio<select value={ratio} onChange={event => setRatio(event.target.value)}>{ratios.map(option => <option key={option}>{option}</option>)}</select></label></div><div className="generate-foot"><span><Zap size={14} fill="currentColor" /> Uses 1 credit</span><button className="button-primary" disabled={generating}>{generating ? <><span className="spinner" /> Creating...</> : <><WandSparkles size={16} /> Generate preview</>}</button></div></form>}</div></div>;
}

function PublishModal({ user, onClose, onSubmit, onLogin }) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState('Ads & Product');
  const [model, setModel] = useState('GPT Image');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event) => { event.preventDefault(); if (!user) { onLogin(); return; } setSubmitting(true); try { await onSubmit({ title, prompt, category, model, excerpt: prompt.slice(0, 110) }); } catch (error) { window.alert(error.message); } finally { setSubmitting(false); } };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="publish-modal"><button className="modal-close" onClick={onClose}><X size={18} /></button><div className="publish-top"><span className="publish-big-icon"><Upload size={21} /></span><div><span className="section-kicker">COMMUNITY SUBMISSIONS</span><h2>Share a prompt, earn credits.</h2><p>Featured prompts earn <strong>50 credits</strong> and help the next creator start faster.</p></div></div><form onSubmit={submit}><label>Prompt title<input required value={title} onChange={event => setTitle(event.target.value)} placeholder="Give your idea a clear name" /></label><label>Prompt<textarea required value={prompt} onChange={event => setPrompt(event.target.value)} rows="7" placeholder="Write the full prompt so others can remix it..." /></label><div className="form-grid"><label>Category<select value={category} onChange={event => setCategory(event.target.value)}>{categories.filter(item => item.name !== 'All').map(item => <option key={item.name}>{item.name}</option>)}</select></label><label>Model<select value={model} onChange={event => setModel(event.target.value)}>{modelOptions.map(option => <option key={option}>{option}</option>)}</select></label></div><div className="publish-foot"><span><ShieldCheck size={14} /> Every submission is reviewed</span><button className="button-primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit for review'} <ArrowUpRight size={15} /></button></div></form></div></div>;
}

function AdminApp({ user, onLogin, onLogout, navigate }) {
  const [toast, setToast] = useState(null);
  const showToast = (message, tone = 'success') => { setToast({ message, tone }); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => setToast(null), 3200); };
  if (!user || user.role !== 'admin') return <AdminGate onLogin={onLogin} navigate={navigate} />;
  return <AdminPortal user={user} onLogout={onLogout} navigate={navigate} toast={toast} showToast={showToast} />;
}

function AdminGate({ onLogin, navigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => { event.preventDefault(); setLoading(true); setError(''); try { const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); if (data.user.role !== 'admin') throw new Error('This account does not have admin access.'); onLogin(data.user, data.token); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  return <div className="admin-gate"><div className="admin-gate-brand"><span className="brand-mark"><Crown size={18} fill="currentColor" /></span><strong>Genvexa</strong><span>Control room</span></div><div className="admin-gate-card"><div className="admin-lock"><ShieldCheck size={22} /></div><span className="section-kicker">RESTRICTED WORKSPACE</span><h1>Sign in to the admin portal.</h1><p>Manage prompts, creators, reviews, and platform activity from one place.</p><form onSubmit={submit} autoComplete="off"><label>Username or email<input name="username" autoComplete="off" value={email} onChange={event => setEmail(event.target.value)} type="text" required /></label><label>Password<input name="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} type="password" required /></label>{error && <div className="form-error">{error}</div>}<button className="button-primary button-wide" disabled={loading}>{loading ? 'Checking access...' : 'Enter control room'} <ArrowUpRight size={15} /></button></form><button className="back-to-site" onClick={() => navigate('/') }><ArrowLeft size={15} /> Back to gallery</button></div></div>;
}

function AdminPortal({ user, onLogout, navigate, toast, showToast }) {
  const [section, setSection] = useState('overview');
  const [stats, setStats] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [promptFilter, setPromptFilter] = useState('all');
  const [promptSearch, setPromptSearch] = useState('');
  const [adminModal, setAdminModal] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAdmin = async () => {
    setLoading(true);
    try {
      const [statsData, promptData, userData, activityData] = await Promise.all([api('/api/admin/stats'), api(`/api/admin/prompts?status=${promptFilter}&search=${encodeURIComponent(promptSearch)}`), api('/api/admin/users'), api('/api/admin/activity')]);
      setStats(statsData.stats); setPrompts(promptData.prompts || []); setUsers(userData.users || []); setActivities(activityData.activities || []);
    } catch (error) { showToast(error.message, 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadAdmin(); }, [promptFilter, promptSearch]);

  const updatePrompt = async (id, patch) => { try { await api(`/api/admin/prompts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); showToast(patch.status === 'published' ? 'Prompt approved and published' : patch.featured ? 'Prompt featured' : 'Prompt updated'); loadAdmin(); } catch (error) { showToast(error.message, 'error'); } };
  const deletePrompt = async (id) => { if (!window.confirm('Remove this prompt from the gallery?')) return; try { await api(`/api/admin/prompts/${id}`, { method: 'DELETE' }); showToast('Prompt removed'); loadAdmin(); } catch (error) { showToast(error.message, 'error'); } };
  const updateUser = async (id, patch) => { try { await api(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); showToast('User updated'); loadAdmin(); } catch (error) { showToast(error.message, 'error'); } };

  return <div className="admin-shell"><aside className="admin-sidebar"><div className="admin-brand"><span className="brand-mark"><Crown size={17} fill="currentColor" /></span><div><strong>Genvexa</strong><small>Admin studio</small></div></div><div className="admin-nav-label">Workspace</div>{[{ id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'prompts', label: 'Prompts', icon: FileImage, badge: stats?.pending || 0 }, { id: 'users', label: 'Users', icon: Users }, { id: 'activity', label: 'Activity', icon: BarChart3 }].map(item => { const Icon = item.icon; return <button key={item.id} className={`admin-nav-row ${section === item.id ? 'admin-nav-active' : ''}`} onClick={() => setSection(item.id)}><Icon size={17} /><span>{item.label}</span>{item.badge ? <span className="admin-nav-badge">{item.badge}</span> : null}</button>; })}<div className="admin-nav-label admin-nav-label-gap">System</div><button className="admin-nav-row" onClick={() => showToast('Settings are ready to connect to your deployment secrets')}><Settings2 size={17} /><span>Settings</span></button><button className="admin-nav-row" onClick={() => navigate('/')}><ExternalLink size={17} /><span>View gallery</span></button><div className="admin-sidebar-bottom"><div className="system-status"><span className="status-pulse" /><span>All systems operational</span></div><button className="admin-user" onClick={onLogout}><span className="avatar avatar-small admin-avatar">{user.avatar}</span><span><strong>{user.name}</strong><small>Administrator</small></span><LogOut size={14} /></button></div></aside><main className="admin-main"><header className="admin-topbar"><div><span className="admin-breadcrumb">CONTROL ROOM <span>/</span> {section}</span><h1>{section === 'overview' ? 'Good morning, Ava.' : section[0].toUpperCase() + section.slice(1)}</h1></div><div className="admin-top-actions"><button className="admin-help"><LifeBuoy size={16} /> Help center</button><button className="admin-create" onClick={() => setAdminModal('create')}><Plus size={16} /> New prompt</button></div></header>{section === 'overview' && <AdminOverview stats={stats} prompts={prompts} users={users} activities={activities} onNavigate={setSection} onApprove={(id) => updatePrompt(id, { status: 'published' })} />}{section === 'prompts' && <AdminPrompts prompts={prompts} filter={promptFilter} setFilter={setPromptFilter} search={promptSearch} setSearch={setPromptSearch} onUpdate={updatePrompt} onDelete={deletePrompt} loading={loading} />}{section === 'users' && <AdminUsers users={users} onUpdate={updateUser} />}{section === 'activity' && <AdminActivity activities={activities} prompts={prompts} />}</main>{adminModal === 'create' && <AdminPromptModal onClose={() => setAdminModal(null)} onSave={async payload => { try { await api('/api/admin/prompts', { method: 'POST', body: JSON.stringify({ ...payload, status: 'published', creator: { name: user.name, handle: '@admin', avatar: user.avatar, color: '#7561d8' } }) }); setAdminModal(null); showToast('Prompt created'); loadAdmin(); } catch (error) { showToast(error.message, 'error'); } }} />}{toast && <div className={`toast toast-${toast.tone}`}><span className="toast-check">{toast.tone === 'error' ? <X size={14} /> : <Check size={14} />}</span>{toast.message}</div>}</div>;
}

function AdminOverview({ stats, prompts, users, activities, onNavigate, onApprove }) {
  const cards = [{ label: 'Published prompts', value: stats?.prompts ?? '—', change: '+12.8%', icon: FileImage, color: 'purple' }, { label: 'Active creators', value: stats?.users ?? '—', change: '+8.4%', icon: Users, color: 'blue' }, { label: 'Pending review', value: stats?.pending ?? '—', change: 'Needs action', icon: ShieldCheck, color: 'orange' }, { label: 'Prompt copies', value: formatCount(stats?.copies), change: '+24.1%', icon: Copy, color: 'green' }];
  const pending = prompts.filter(prompt => prompt.status === 'pending').slice(0, 4);
  return <div className="admin-content"><div className="admin-stats">{cards.map(card => { const Icon = card.icon; return <div className="admin-stat-card" key={card.label}><div className={`stat-icon stat-${card.color}`}><Icon size={18} /></div><span className="admin-stat-label">{card.label}</span><strong>{card.value}</strong><span className={`stat-change ${card.color === 'orange' ? 'stat-alert' : ''}`}>{card.color === 'orange' ? 'Review queue' : <><TrendingUp size={12} /> {card.change} <small>vs last month</small></>}</span></div>; })}</div><div className="admin-grid-main"><section className="panel performance-panel"><div className="panel-head"><div><span className="admin-panel-kicker">GALLERY GROWTH</span><h2>Performance overview</h2></div><button className="range-select">Last 30 days <ChevronDown size={14} /></button></div><div className="chart-legend"><span><i className="legend-dot purple-dot" /> Prompt copies</span><span><i className="legend-dot blue-dot" /> New users</span></div><div className="fake-chart"><div className="chart-y"><span>600</span><span>450</span><span>300</span><span>150</span><span>0</span></div><div className="chart-area"><div className="grid-lines"><span /><span /><span /><span /><span /></div><svg className="chart-svg" viewBox="0 0 720 250" preserveAspectRatio="none"><defs><linearGradient id="purpleFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7d5ce4" stopOpacity=".24" /><stop offset="1" stopColor="#7d5ce4" stopOpacity="0" /></linearGradient></defs><path d="M0,203 C34,187 48,181 72,190 S112,169 138,179 S178,132 204,154 S243,122 276,135 S313,103 344,116 S380,142 410,106 S454,92 485,106 S518,65 548,75 S581,52 610,63 S658,24 720,38 L720,250 L0,250 Z" fill="url(#purpleFill)" /><path d="M0,203 C34,187 48,181 72,190 S112,169 138,179 S178,132 204,154 S243,122 276,135 S313,103 344,116 S380,142 410,106 S454,92 485,106 S518,65 548,75 S581,52 610,63 S658,24 720,38" fill="none" stroke="#7755db" strokeWidth="3" strokeLinecap="round" /><path d="M0,224 C37,216 60,210 89,220 S131,188 163,202 S205,174 237,191 S280,170 315,176 S353,190 390,166 S427,182 457,153 S500,155 536,142 S577,124 609,142 S662,116 720,115" fill="none" stroke="#8cb7e8" strokeWidth="2" strokeDasharray="4 6" strokeLinecap="round" /></svg><div className="chart-x"><span>Jul 24</span><span>Jul 30</span><span>Aug 05</span><span>Aug 11</span><span>Aug 17</span><span>Aug 22</span></div></div></div></section><section className="panel activity-panel"><div className="panel-head"><div><span className="admin-panel-kicker">LIVE FEED</span><h2>Recent activity</h2></div><button className="text-button" onClick={() => onNavigate('activity')}>View all <ArrowUpRight size={14} /></button></div><div className="activity-list">{activities.slice(0, 5).map(activity => <ActivityItem activity={activity} key={activity.id} />)}</div></section></div><div className="admin-grid-bottom"><section className="panel pending-panel"><div className="panel-head"><div><span className="admin-panel-kicker">MODERATION</span><h2>Needs your attention</h2></div><button className="text-button" onClick={() => onNavigate('prompts')}>See queue <ArrowUpRight size={14} /></button></div>{pending.length ? <div className="pending-list">{pending.map(prompt => <div className="pending-row" key={prompt.id}><img src={prompt.image} alt="" /><div className="pending-info"><strong>{prompt.title}</strong><span>{prompt.creator?.name} · {timeAgo(prompt.createdAt)}</span></div><div className="pending-actions"><button className="reject-button" onClick={() => onApprove(prompt.id)}>Approve</button><button className="icon-button" title="Open"><ArrowUpRight size={15} /></button></div></div>)}</div> : <div className="panel-empty"><Check size={19} /> Nothing waiting for review</div>}</section><section className="panel creators-panel"><div className="panel-head"><div><span className="admin-panel-kicker">COMMUNITY</span><h2>Top creators</h2></div><button className="text-button" onClick={() => onNavigate('users')}>All users <ArrowUpRight size={14} /></button></div><div className="creator-rank-list">{users.slice(0, 4).map((item, index) => <div className="creator-rank" key={item.id}><span className="rank-number">0{index + 1}</span><span className="avatar avatar-small" style={{ '--avatar-color': item.color || '#b6a9e9' }}>{item.avatar}</span><div><strong>{item.name}</strong><span>{item.role === 'creator' ? 'Creator' : 'Member'}</span></div><b>{item.credits}<small> credits</small></b></div>)}</div></section></div></div>;
}

function ActivityItem({ activity }) { const icons = { publish: Upload, feature: Star, signup: UserPlus, copy: Copy, generate: Sparkles, approve: Check, delete: Trash2 }; const Icon = icons[activity.type] || MessageCircle; return <div className="activity-item"><span className={`activity-icon activity-${activity.type}`}><Icon size={14} /></span><div><p>{activity.text}</p><span>{timeAgo(activity.time)}</span></div></div>; }

function AdminPrompts({ prompts, filter, setFilter, search, setSearch, onUpdate, onDelete, loading }) { return <div className="admin-content"><div className="section-toolbar"><div className="admin-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search prompts, creators..." /></div><div className="filter-pills">{[['all', 'All prompts'], ['published', 'Published'], ['pending', 'Pending'], ['rejected', 'Rejected']].map(([id, label]) => <button key={id} className={filter === id ? 'filter-pill-active' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div><button className="filter-square"><Filter size={15} /></button></div><section className="panel admin-table-panel"><div className="admin-table-head"><div><span className="admin-panel-kicker">CONTENT LIBRARY</span><h2>{filter === 'all' ? 'All prompts' : `${filter[0].toUpperCase() + filter.slice(1)} prompts`}</h2></div><span className="table-count">{prompts.length} items</span></div>{loading ? <div className="table-loading"><span className="spinner" /> Loading prompt library...</div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Prompt</th><th>Creator</th><th>Model</th><th>Status</th><th>Engagement</th><th /></tr></thead><tbody>{prompts.map(prompt => <tr key={prompt.id}><td><div className="table-prompt"><img src={prompt.image} alt="" /><div><strong>{prompt.title}</strong><span>{prompt.category} · {timeAgo(prompt.createdAt)}</span></div></div></td><td><div className="table-creator"><span className="avatar avatar-tiny" style={{ '--avatar-color': prompt.creator?.color }}>{prompt.creator?.avatar}</span>{prompt.creator?.name}</div></td><td><span className="table-model">{prompt.model}</span></td><td><span className={`status-badge status-${prompt.status}`}>{prompt.status === 'published' ? <Check size={11} /> : prompt.status === 'pending' ? <Clock3 size={11} /> : <X size={11} />}{prompt.status}</span>{prompt.featured && <span className="mini-featured"><Star size={10} fill="currentColor" /></span>}</td><td><div className="engagement"><span><Copy size={12} /> {formatCount(prompt.copies)}</span><span><Heart size={12} /> {formatCount(prompt.likes)}</span></div></td><td><div className="table-actions">{prompt.status === 'pending' && <button className="approve-icon" title="Approve" onClick={() => onUpdate(prompt.id, { status: 'published' })}><Check size={15} /></button>}{prompt.status === 'published' && <button className="feature-icon" title={prompt.featured ? 'Unfeature' : 'Feature'} onClick={() => onUpdate(prompt.id, { featured: !prompt.featured })}><Star size={15} fill={prompt.featured ? 'currentColor' : 'none'} /></button>}<button className="delete-icon" title="Delete" onClick={() => onDelete(prompt.id)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{!prompts.length && <div className="table-empty">No prompts match this filter.</div>}</div>}</section></div>; }

function AdminUsers({ users, onUpdate }) { return <div className="admin-content"><div className="admin-page-intro"><div><span className="admin-panel-kicker">COMMUNITY DIRECTORY</span><h2>Creators & members</h2><p>Manage access, roles, and account health.</p></div><button className="admin-create"><UserPlus size={16} /> Invite creator</button></div><section className="panel admin-table-panel"><div className="admin-table-wrap"><table className="admin-table users-table"><thead><tr><th>User</th><th>Role</th><th>Joined</th><th>Credits</th><th>Status</th><th /></tr></thead><tbody>{users.map(item => <tr key={item.id}><td><div className="table-prompt"><span className="avatar avatar-small" style={{ '--avatar-color': item.color || '#b6a9e9' }}>{item.avatar}</span><div><strong>{item.name}</strong><span>{item.email}</span></div></div></td><td><span className={`role-badge role-${item.role}`}>{item.role}</span></td><td>{new Date(item.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td><td><strong className="credit-number"><Zap size={13} fill="currentColor" /> {item.credits}</strong></td><td><span className={`status-badge status-${item.status === 'active' ? 'published' : 'pending'}`}><span className="status-dot" />{item.status}</span></td><td><button className="user-action" onClick={() => onUpdate(item.id, { status: item.status === 'active' ? 'suspended' : 'active' })}>{item.status === 'active' ? 'Suspend' : 'Activate'}</button></td></tr>)}</tbody></table></div></section></div>; }

function AdminActivity({ activities, prompts }) { return <div className="admin-content"><div className="admin-page-intro"><div><span className="admin-panel-kicker">AUDIT LOG</span><h2>Platform activity</h2><p>A running log of important events across the gallery.</p></div><button className="range-select"><Clock3 size={14} /> Latest first <ChevronDown size={14} /></button></div><section className="panel full-activity-panel"><div className="full-activity-list">{activities.map(activity => <div className="full-activity-row" key={activity.id}><ActivityItem activity={activity} /><span className="activity-id">{activity.promptId ? prompts.find(prompt => prompt.id === activity.promptId)?.title || 'Prompt record' : 'Account event'}</span><button className="icon-button"><Ellipsis size={16} /></button></div>)}</div></section></div>; }

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
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="admin-prompt-modal"><button className="modal-close" onClick={onClose}><X size={18} /></button><span className="section-kicker">CONTENT LIBRARY</span><h2>Create a prompt</h2><p>Add a prompt and optional image or video media directly to the gallery.</p><form onSubmit={submit}><label>Title<input required value={title} onChange={event => setTitle(event.target.value)} placeholder="Prompt title" /></label><label>Prompt<textarea required value={prompt} onChange={event => setPrompt(event.target.value)} rows="7" placeholder="Write the prompt..." /></label><div className="admin-upload-field"><div className="upload-field-label"><span>Cover image</span><small>Optional · maximum 2 MB</small></div>{image ? <div className="image-upload-preview"><img src={image} alt="Selected cover preview" /><div><strong>{imageName}</strong><span>Ready to attach to this prompt</span></div><button type="button" className="remove-upload" onClick={removeImage}><X size={14} /></button></div> : <label className={`image-upload ${imageError ? 'image-upload-error' : ''}`} htmlFor={imageInputId}><ImagePlus size={20} /><span><strong>Choose an image</strong><small>PNG, JPG, GIF, or WebP · 2 MB max</small></span><input id={imageInputId} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImage} /></label>}{imageError && <div className="upload-error-text">{imageError}</div>}</div><div className="admin-upload-field"><div className="upload-field-label"><span>Video result</span><small>Optional · upload up to 3 MB or use a hosted URL</small></div>{selectedVideo ? <div className="video-upload-preview"><video src={selectedVideo} controls muted playsInline /><div><strong>{videoName || videoUrl}</strong><span>{video ? 'Local video ready to attach' : 'Hosted video URL ready'}</span></div><button type="button" className="remove-upload" onClick={removeVideo}><X size={14} /></button></div> : <label className={`image-upload video-upload ${videoError ? 'image-upload-error' : ''}`} htmlFor={videoInputId}><Clapperboard size={20} /><span><strong>Upload a video</strong><small>MP4, WebM, MOV, or OGG · 3 MB max</small></span><input id={videoInputId} type="file" accept="video/mp4,video/webm,video/quicktime,video/ogg" onChange={handleVideo} /></label>}{!selectedVideo && <div className="video-url-row"><span>or paste video URL</span><input type="url" value={videoUrl} onChange={event => { setVideoUrl(event.target.value); setVideo(''); setVideoName(''); setVideoError(''); }} placeholder="https://cdn.example.com/video.mp4" /></div>}{videoError && <div className="upload-error-text">{videoError}</div>}</div><div className="form-grid"><label>Category<select value={category} onChange={event => setCategory(event.target.value)}>{categories.filter(item => item.name !== 'All').map(item => <option key={item.name}>{item.name}</option>)}</select></label><label>Model<select value={model} onChange={event => setModel(event.target.value)}>{modelOptions.map(option => <option key={option}>{option}</option>)}</select></label></div>{error && <div className="form-error">{error}</div>}<div className="admin-modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button className="button-primary" disabled={saving || Boolean(imageError) || Boolean(videoError)}>{saving ? 'Creating...' : 'Create prompt'} <ArrowUpRight size={15} /></button></div></form></div></div>;
}


createRoot(document.getElementById('root')).render(<App />);
