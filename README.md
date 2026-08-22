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
- Demo email: `admin@genvexa.test`
- Demo password: `admin123`

The admin portal includes overview metrics, moderation, prompt search/filtering, feature/approve/delete actions, user status controls, activity logs, and direct prompt creation.

## Included functionality

- Curated gallery with model, category, search, sort, and responsive layouts
- Dedicated Videos category with original Seedance clips, inline playback, poster thumbnails, full video prompts, and copy-to-clipboard
- Prompt detail modal with source link, copy-to-clipboard, likes, favorites, and related prompts
- History and Favorites views stored per browser account
- Community publish flow with pending-review moderation status
- Demo generation flow with model and aspect-ratio controls
- Email sign-in demo and admin access state
- JSON-backed persistence in `data/prompts.json`, `data/users.json`, and `data/activities.json`
- API routes for prompts, likes, copies, favorites, generations, auth, users, moderation, and stats

## Production wiring

`POST /api/generations` is the integration point for a real provider such as OpenAI Images, Replicate, or another image/video backend. The included no-key demo returns a local preview so the complete user flow works immediately. Add real authentication, object storage, payment/credit verification, and provider secrets before deploying publicly.
