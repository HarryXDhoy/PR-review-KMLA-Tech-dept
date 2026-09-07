# Frame

An independent, Instagram-inspired educational photo-sharing MVP built with React 19, Vite 8, and Supabase (Auth, Postgres, Storage). Not affiliated with Instagram or Meta; not a production-ready social network.

## Local setup

Use Node.js 22.12+ (or a newer supported release) and npm.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Without valid Supabase configuration, Frame runs a browser-local demo. For connected accounts:

1. Create a **fresh, dedicated Supabase project**. In its SQL Editor, execute the complete `supabase/migrations/202609070001_initial.sql` **before anyone signs up**. The migration creates six tables, RLS policies, an account-profile trigger, and the `post-images` bucket. It deliberately fails on existing tables/bucket; it is not an upgrade or rerunnable reset script. The app does not apply it automatically.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Legacy projects may instead use `VITE_SUPABASE_ANON_KEY` with the publishable variable empty. Use only a **public publishable/anon key**, never a service-role key, secret key, or database password. All `VITE_*` values are exposed to browsers. Keep `.env.local` out of version control.
3. In Supabase Authentication → URL Configuration, set the Site URL and allow the development origin shown by Vite (normally `http://localhost:5173`) as a Redirect URL. Restart Vite after changing environment variables. Sign up with a new Frame account; confirm email if enabled, then sign in. Do not reuse an Instagram password.

## Vercel

Import this repository using the active **`feature/react-init` branch**, not an uninitialized/default branch. Select Vite, build command `npm run build`, output directory `dist`; routing/security headers are in `vercel.json`. Set the same public Supabase environment variables for the intended Production/Preview environments, then deploy. If this feature branch should serve production, set it as Vercel's Production Branch.

Set Supabase's Site URL to the deployed production origin and add the exact production and intended preview origins to its Redirect URLs. Signup confirmation redirects to the app's current origin. Redeploy after environment changes; Vite embeds configuration at build time. Do not use broad redirect wildcards for untrusted deployments.

## Features and actual limits

- Photo creation/deletion, likes, comments, saves, follows, profile editing, search, and feed/profile/explore views. Saves are account-private; profiles, posts, comments, likes, and follows are public in the connected backend.
- Connected feed fetches only the **50 latest posts** and **30 latest comments per post**, displayed oldest-first within that comment window. Like counts aggregate all visible likes.
- At most **100 profiles** (username order) and **1,000 latest following relationships** are loaded. Search, Following, Saved, profile grids/counts, activity counts, and shared-post lookup use loaded data, not the full database. Older saved/shared posts may be absent. No pagination or realtime updates; reload to see other users' changes.
- Uploads: JPEG, PNG, WebP, GIF only, larger than zero and at most **5 MiB**. Caption 2,200 characters, location 100, comment 1,000, name 80, bio 150. Usernames use 3–40 lowercase letters, numbers, or underscores; UUID-generated usernames are reserved for their account.
- Creator circles are shortcuts, not expiring stories. No DMs, reels/video, realtime notifications, reporting, blocking, moderation, private accounts, or account deletion.

## Demo, privacy, and cleanup

Signed-out users start in the demo. Demo posts (including uploaded image data), profile edits, likes, saves, comments, and follows persist under localStorage key `frame-demo-v1`, not Supabase. Anyone using that browser profile can see them; clearing site data resets them. Storage limits can prevent persistence, and custom demo links do not share data across browsers. Sample photos load from Unsplash, which receives those image requests.

**Storage is public:** anyone with a photo URL can fetch it, including signed-out users. Do not upload sensitive images. Database RLS does not make public bucket images private. Failed post creation attempts image cleanup; post deletion removes the database row before attempting owned-image cleanup. Storage cleanup can fail or skip an unrecognized/external URL, leaving orphaned files requiring administrator removal. Database cascades/manual row or account deletion do not automatically clean Storage, and deletion cannot retract cached/downloaded copies. Add moderation, abuse controls, retention, and reliable cleanup before any public production use.

## Checks

```sh
node --test tests/app.test.js
npm run lint
npm run build
npm run preview
```

The Node tests cover demo integrity/local-storage fallback, selected API input validation before client access, and **static** SQL checks (transaction boundaries, six tables, RLS declarations, literals, reserved usernames, and storage constraints). They run without Supabase credentials and do **not** execute SQL or verify live authentication, database authorization/RLS, storage, or browser workflows. Test those separately on the fresh project, including two-account ownership isolation, email confirmation, uploads, and deletion/cleanup failures.
