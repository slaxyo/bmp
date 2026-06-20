# BMP Portal

Property-management portal with three roles — **Tenant**, **Owner**, and **PM Admin** —
built with React 19 + Vite + Tailwind v4 + Supabase.

## Setup

```bash
cd portal
npm install
cp .env.example .env   # fill in your Supabase values
npm run dev
```

Required env (`portal/.env`):

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_FUNCTIONS_URL` | *(optional)* Edge Functions base URL — enables email notifications |

Run the SQL in `supabase/migrations/002_portal_extensions.sql` in the Supabase SQL editor
(idempotent / safe to re-run). It creates the `profiles`, `documents`, `activity_log`,
`notifications`, and `branding` tables, RLS policies, and storage buckets.

**Demo mode:** toggle it in Admin → Settings → Account to run the whole app on bundled mock
data with no Supabase round-trips — useful for demos and screenshots.

## Custom branding

Each property manager white-labels all three portals from **Admin → Settings → Branding**:
company name, tagline, logo upload, and accent color. Branding is stored per-PM in the
`branding` table and applied app-wide at runtime by `src/context/BrandingContext.tsx`, which
overrides Tailwind's blue palette CSS variables — so the accent recolors every existing
`*-blue-*` class without touching markup. The brand is public-readable so it also renders on
the logged-out login screen.

## In-app notifications

A notification center lives in every portal header (`src/components/NotificationBell.tsx`,
backed by `src/hooks/useNotifications.ts` with Supabase Realtime). Notifications are written by
`notifyUser()` in `src/lib/notify.ts` on key events: a tenant submits a maintenance request or
message (→ PM), the PM changes a ticket status, logs a payment, sends a message or an
announcement (→ tenant).

### Enabling email notifications

Email is **off by default**. To turn it on:

1. Create a [Resend](https://resend.com) account and an API key.
2. Configure secrets and deploy the function (from the repo root):
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxx
   supabase secrets set EMAIL_FROM="Your Co <noreply@yourdomain.com>"
   supabase functions deploy send-notification
   ```
3. Set `VITE_FUNCTIONS_URL=https://<project-ref>.functions.supabase.co` in `portal/.env` and
   rebuild.

`notifyUser()` then also calls `supabase/functions/send-notification`, which resolves the
recipient's email and honours their per-type email preferences (Admin → Settings →
Notifications) server-side. Without the key/URL it silently no-ops, so the in-app center keeps
working regardless.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
