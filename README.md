# SyncBeat

Real-time synchronized music listening, with two portals sharing one sync engine.

- **Teams** — group listening rooms with an upvote/downvote queue, a DJ role, mood & language tags, and a shareable session recap.
- **Duo** — private two-person rooms with floating heart reactions, an "Our Songs" memory timeline, a love-notes board, scheduled surprise messages, and a shared countdown.

Everyone in a room hears the same moment at the same time: the server is the single source of truth for playback state, and each client corrects local drift beyond 300 ms.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Realtime | Supabase Realtime (Broadcast + Presence + Postgres Changes) |
| Persistence | Supabase Postgres (rooms, tracks, messages, memories, notes, scheduled messages, countdowns) |
| Server authority | Postgres `SECURITY DEFINER` RPCs (the equivalent of Express route handlers + Socket.io event handlers) |
| Media | HTML5 `<audio>` for direct file URLs · YouTube IFrame Player API for YouTube IDs |

> The original spec called for Node + Express + Socket.io + MongoDB. This build delivers the identical user-facing behavior (server-authoritative sync, live broadcast chat, presence, vote re-sorting) using Supabase Realtime + Postgres RPCs, which is the supported real-time backend in this environment. The data model and event flow map 1:1 onto the spec.

---

## Run locally

```bash
npm install
npm run dev
```

The dev server starts automatically in this environment — do not run `npm run dev` yourself if the harness already started it.

### Production build

```bash
npm run build      # type-checks + bundles to dist/
npm run preview    # serves the built bundle
```

### Docker

A minimal Dockerfile is included for containerized deploys:

```bash
docker build -t syncbeat .
docker run -p 4173:4173 syncbeat
```

The container serves the static build on port 4173.

---

## Environment variables

All Supabase variables are pre-populated. Do **not** set them manually.

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (used by the frontend) |

No other env vars are required. YouTube playback uses the public IFrame API (no key needed).

---

## How to add tracks

Playlist starts **empty** — no songs are bundled or scraped. Users add their own:

1. In a room, open the **Add a track** panel (Teams: the "Add track" tab; Duo: the "Add Track" tab).
2. Paste one of:
   - A **YouTube URL** — e.g. `https://www.youtube.com/watch?v=XXXXXXXXXXX` or `https://youtu.be/XXXXXXXXXXX`
   - A **bare YouTube video ID** — e.g. `dQw4w9WgXcQ`
   - A **direct audio file URL** — e.g. `https://example.com/song.mp3` (must be publicly fetchable and CORS-enabled for the browser to play it)
3. Optionally add a title, mood tags (Teams only), and language tags.
4. Click **Add to queue**.

In Teams rooms, members upvote/downvote queued tracks; the queue re-sorts live by net votes. In Duo rooms, tracks play in the order added.

---

## Core sync mechanic

- The `rooms` table is the single source of truth: `is_playing`, `position_ms`, and `updated_at`.
- Every play/pause/seek/track-change calls the `trigger_sync` RPC, which updates the room row with a server timestamp.
- The row change is broadcast to all connected clients via Supabase Realtime Postgres Changes.
- Each client computes the current server position as `position_ms + (now - updated_at)` while playing, and if its local player drifts more than **300 ms** from that value it seeks to correct. This keeps all listeners on the same moment regardless of individual network latency.

---

## Portal features

### Teams (group listening)
- **Upvote / downvote queue** — members vote on pending tracks; queue re-sorts live by net votes.
- **DJ role** — the room host can promote/demote a DJ who gets priority to skip or play/reorder tracks; a DJ badge appears next to their name.
- **Mood & language tags** — tracks can be tagged (Party, Chill, Telugu, Hindi, English, …) and the queue is filterable by tag.
- **Session recap** — a one-click summary card (tracks played, top voted track, most active chatter, total messages/votes) downloadable as an SVG image or shareable as a link.

### Duo (two-person room)
- **Hard-capped at 2** — shows a pulsing "waiting for your partner" state until the second person connects.
- **Floating heart reactions** — real-time emoji that float up the screen, separate from text chat.
- **Our Songs** — either partner tags a played track with a private note and a date, building a shared musical timeline visible only inside that room.
- **Love-notes board** — a persistent private space where either partner leaves short messages for the other to find next time.
- **Scheduled surprise** — queue a message or track to reveal at a future date/time (e.g. an anniversary); delivered automatically when that time arrives.
- **Countdown** — a shared live countdown to a chosen date.

### Shared by both
- **6-character room code** — create or join via code; shareable join link.
- **Live chat** — real-time messages, timestamps, sender name, auto-scroll, typing indicator, emoji reactions.
- **Online presence** — connected members list with join/leave system messages.
- **Both audio URLs and YouTube IDs** as track sources.

---

## Data privacy

Duo room data (notes, memories, scheduled messages, countdowns) is scoped strictly to that room's two participants. Row-Level Security is enabled on every table with **no policies granted to anon/authenticated**, so direct table access from the frontend is fully blocked. All reads and writes go through `SECURITY DEFINER` RPCs that verify the 6-character room code before acting — no cross-room or public visibility is possible without a room's code.

---

## Accessibility

- Visible focus states on all interactive elements.
- `prefers-reduced-motion` respected — animations and transitions collapse to near-instant.
- Sufficient color contrast on text across both portal themes.
- Mobile-responsive layouts from 320 px up to desktop.

---

## Project structure

```
src/
  lib/            supabase client, types, api wrapper, utils, youtube loader
  hooks/          useSyncEngine (realtime + presence + drift), useRoomPage
  components/
    Landing.tsx        portal selection + create/join
    TeamsRoom.tsx      Teams room + shared Panel/Header/Loading/Error shells
    DuoRoom.tsx        Duo room
    Player.tsx         HTML5 audio + YouTube IFrame, drift correction
    Queue.tsx          upvote/downvote, live re-sort, DJ controls, filters
    Chat.tsx           messages, typing, emoji reactions
    Members.tsx        presence list, host/DJ badges
    AddTrack.tsx       URL/ID input + tag selection
    SessionRecap.tsx   Teams session summary card
    FloatingHearts.tsx Duo real-time heart reactions
    CountdownPanel.tsx Duo countdown
    DuoFeatures.tsx    Our Songs, Love Notes, Scheduled Surprises
supabase/
  functions/      (none deployed — all server logic is in Postgres RPCs)
```
