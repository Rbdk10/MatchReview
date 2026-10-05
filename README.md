# MatchReview

Opponent tracker for coaches. Log match results, capture what each opponent did well and where they struggled, and have the scouting notes ready before the next match. Tennis only for now; the schema is set up to add more sports later.

Built with Vite + React + TypeScript + Tailwind v4, backed by Supabase (auth, Postgres, row level security). Desktop layout with a sidebar, mobile layout with a bottom tab bar.

## Run locally

```bash
npm install
cp .env.example .env   # fill in the Supabase URL and anon key
npm run dev
```

The app runs at http://localhost:5173.

## Deploy

Live at https://matchreview.netlify.app (Netlify site `matchreview` on the rbdk10 team, account reubendeklerk071@gmail.com). Deploy a new build with:

```bash
npm run build && netlify deploy --prod --dir=dist
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are also set as Netlify env vars so Git-based builds work too. Note: `~/.zshenv` exports a `NETLIFY_AUTH_TOKEN` for a different account; unset it in the shell before running netlify commands, or remove that line.

## Supabase

- Project: **MatchReview** (ref `tatoitdmbmungmtatbyz`, West EU / Ireland)
- Dashboard: https://supabase.com/dashboard/project/tatoitdmbmungmtatbyz
- Schema lives in `supabase/migrations/`. Apply changes with `supabase db push`.
- Auth config lives in `supabase/config.toml`. Email sign-up is disabled; Google OAuth is the only way in, and first sign-in lands straight in onboarding. Push with `supabase config push`.

### Google sign-in

The Google provider is enabled in `supabase/config.toml` and reads its credentials from `.env.supabase`:

```
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
```

Create an OAuth client in Google Cloud Console (Web application) with the authorized redirect URI
`https://tatoitdmbmungmtatbyz.supabase.co/auth/v1/callback`, paste the client ID and secret into `.env.supabase`, then run:

```bash
set -a && source .env.supabase && set +a && supabase config push
```

The auth sheet's "Continue with Google" button calls `signInWithOAuth` with the PKCE flow and returns to the app root.

### Tables

| Table | Purpose |
| --- | --- |
| `profiles` | One row per coach, created by a trigger on sign-up. Holds name, team name, sport and onboarding flag. |
| `players` | The coach's own team. A row can be claimed by a player account (`user_id`). |
| `player_invites` | One pending invite token per unclaimed player row. |
| `opponents` | Registered opponents with optional school. Unique per coach by name. |
| `results` | A match: format (singles/doubles), one or two opponents, one or two of your players, date, per-set scores (JSON), win/loss, and notes. Doubles results appear under both opponents. |

Every table has RLS so a coach only ever sees their own rows.

## Logo

Temporary logo generated with Higgsfield (GPT Image). Assets live in `public/`: `logo.png` (transparent, 512px), `logo-192.png`, `favicon.png`, `apple-touch-icon.png`. Swap these files to rebrand; all logo spots reference `/logo.png`.

## Team tab

**Team tab**: the navigation has a tab named after your team (for example "MSU"), opening `/team`. It shows the overall record, the roster with each player's win/loss record, schools faced, and recent matches. Players see the roster but only their own record and matches.

## Roles

- **Coach**: owns the team, players, opponents and every result. Signs up normally and goes through the setup slideshow.
- **Player**: joins through a one-time invite link the coach creates from a player row on **Profile**. Opening `/join/<token>` and signing in with Google claims that existing row (`players.user_id`), sets the account's role to `player`, and skips coach setup.

What a player can do, enforced by row level security in `supabase/migrations/20261005000000_roles_invites.sql`:

| Area | Player access |
| --- | --- |
| Results | Add and read only matches they played in (as player 1 or doubles partner). No edits, no other players' results or notes. |
| Opponents | Read the team's opponents and add new ones. |
| Team | Read teammate names (for picking a doubles partner). Cannot add, rename or remove players. |
| Invites | None. Tokens live in `player_invites`, visible to the coach only. |

A coach can **Unlink** a joined account (the row and its results stay, and the spot can be invited again) or regenerate an invite link. Claiming, unlinking and invite previews go through the `claim_invite`, `unlink_player` and `invite_preview` database functions.

## App flow

1. **Sign in with Google** on the auth sheet. Google is the only sign-in method; email/password sign-up is disabled in Supabase.
2. First sign-in opens a four-step **setup slideshow**: your name, team name, sport (tennis), players. Everything can be edited later on **Profile**, which also removes players behind a confirm modal.
3. **Add result** supports singles and doubles. Doubles takes two opponents and two of your players and defaults to a single set. It is reachable from the sidebar, the hero card and per-player chips on Home, the mobile header and floating button, the Opponents page, each player row on Profile, and the `n` keyboard shortcut.
4. **Opponents** lists every registered opponent; expanding one shows aggregated "does well" / "struggles with" notes and the match history.
