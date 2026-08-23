# Genvexa Gallery Studio

A full-stack, visually faithful implementation of a modern AI prompt gallery branded as Genvexa. It uses public prompt copy and gallery images from the referenced source pages, with an original React interface and a small Express API.

## Run it

```bash
npm install
npm run dev
```

Open the live preview or visit `http://localhost:4173`.

## Admin portal

- URL: `/admin`
- Admin access is controlled by the Supabase `profiles.role = 'admin'` field
- No admin credentials are hardcoded in the repository

The admin portal includes overview metrics, moderation, prompt search/filtering, feature/approve/delete actions, user status controls, activity logs, direct prompt creation, optional cover-image upload capped at 2 MB, and video upload or hosted-video URL support.

## Included functionality

- Curated gallery with model, category, search, sort, and responsive layouts
- Dedicated Videos category with original Seedance clips, inline playback, poster thumbnails, full video prompts, and copy-to-clipboard
- Faymas import: 1,161 prompts with 1,461 optimized local result images, searchable and paginated in the gallery
- MeiGen catalog import: 1,446 curated image prompts plus available video prompt records, with source media URLs preserved for playback and display
- Prompt detail modal with source link, copy-to-clipboard, likes, favorites, and related prompts
- History and Favorites views stored per browser account
- Community publish flow with pending-review moderation status
- Secure email sign-in, registration, cookie sessions, and admin access state
- JSON-backed persistence in `data/prompts.json`, `data/users.json`, and `data/activities.json`
- API routes for prompts, likes, copies, favorites, auth, users, moderation, media, and stats

## Supabase setup

1. Add the values in `.env.example` to local/Vercel environment variables.
2. Run `supabase/schema.sql` once in the Supabase SQL Editor.
3. Create the first account through `/signup`, then promote that profile to `admin` from a trusted SQL session.
4. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; it must never use the `VITE_` prefix or appear in browser code.

The app uses Supabase Auth with secure bearer-token verification on the server and a protected `profiles` directory for admin user management. The browser-safe anon configuration is bundled as a fallback; the server still refuses protected operations until the server-only Supabase secret and schema are configured.

## Production wiring

All media is delivered through the controlled media proxy and persisted in managed storage when configured. Connect a hosted database and object storage before deploying publicly.
