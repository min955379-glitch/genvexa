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
- Admin username: `usertestpro`
- Admin password: `pass123pro`

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

## Production wiring

All media is delivered through the controlled media proxy and persisted in managed storage when configured. Add a real database and object storage before deploying publicly.
