# 🎵 SyncBeat

**Real-time synchronized music listening for groups and couples.** Everyone in a room hears the exact same moment of a song — playback stays locked in sync across every listener, with live chat, voting, reactions, and admin-controlled playback on top.

[![Docker](https://img.shields.io/badge/Container-Docker-2496ED?logo=docker&logoColor=white)](Dockerfile)
[![Deploy Targets](https://img.shields.io/badge/Deploy-Vercel%20%7C%20Azure%20%7C%20GitHub%20Pages-black)](#deployment-options)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.app.json)

**Live demo:** _add your deployed URL here_

---

## What it does

Two portals, one shared real-time engine:

- **Teams** — open group listening rooms with an upvote/downvote queue that re-sorts live, a DJ role for trusted members, mood/language tags on tracks, and a session recap.
- **Duo** — private two-person rooms with floating heart reactions, a shared "Our Songs" memory timeline with private notes and dates, a love-notes board, scheduled surprise messages that unlock at a future date, and a live countdown.

Shared across both: server-authoritative playback sync with drift correction, admin-controlled playback (transferable to any member), live chat with presence and typing indicators, and a shared song catalog that grows every time someone adds a track.

---

## Architecture

```
┌──────────────────────────┐        ┌───────────────────────────────────┐
│   React + Vite SPA       │◄──────►│   Supabase                        │
│   - Hash-based routing    │        │   - Postgres (rooms, tracks,      │
│   - Realtime sync hooks   │        │     messages, memories, notes)    │
│   - Player (audio + YT)   │        │   - Row-Level Security             │
└──────────────────────────┘        │   - SECURITY DEFINER RPCs          │
                                      │     (server-side write logic)      │
                                      │   - Realtime (Broadcast +          │
                                      │     Postgres Changes)              │
                                      └───────────────────────────────────┘
```

---

## Architecture decisions

### Why Supabase instead of a custom Node/Express backend

The initial design called for a Node.js + Express + Socket.io server backed by MongoDB. I deliberately moved to Supabase (managed Postgres + Realtime) instead, for one reason: **it let me spend engineering time on the actual hard problems** — the sync protocol, the security model, and room-capacity logic — instead of re-implementing infrastructure that already exists as a solid managed service. Every piece of application logic still had to be designed and written by me; it's implemented as Postgres `SECURITY DEFINER` functions and Row-Level Security policies rather than Express route handlers. Same responsibilities, different runtime.

### The trade-off I hit, and how I resolved it

Supabase Realtime's "push changes live to clients" feature evaluates Row-Level Security to decide what a client is allowed to see — which meant the initial design (RLS locked down with zero read policies, write access fully gated by room code) silently broke live updates: writes succeeded, but nothing pushed live to other clients, only appearing on manual refresh. I resolved this two ways:

1. Added scoped `SELECT` policies so Realtime's live-push mechanism actually functions
2. Layered a **Broadcast-based fallback** on top — every write directly notifies connected room members over a dedicated channel, independent of Postgres's replication pipeline — so sync doesn't silently degrade if the underlying push mechanism has issues

This is documented in-line in the relevant migration files, including the read/write trade-off it introduces (see **Known trade-offs** below).

### Why playback sync needed more than "send a play event"

Broadcasting "play" isn't enough — browsers silently block programmatic audio playback that isn't triggered by a direct user gesture, so a listener's tab could receive the sync signal and still never actually start playing, with no visible error. The player detects this (a play call that doesn't result in an actually-playing state within ~800ms) and surfaces a one-tap "unlock playback" prompt, which satisfies the browser's gesture requirement and locks the tab into sync from that point on.

---

## Containerization

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=your_supabase_url \
  --build-arg VITE_SUPABASE_ANON_KEY=your_anon_key \
  -t syncbeat .

docker run -d -p 80:4173 syncbeat
```

---

## Deployment options

| Path | Setup | Notes |
|---|---|---|
| **Vercel** | Import repo, add env vars, deploy | Fastest path to a live URL; automatic PR preview deployments |
| **Azure Static Web Apps** | Create resource in Azure Portal, connect this repo | Free managed HTTPS, custom domain support |
| **GitHub Pages** | Enable Pages in repo settings, build with `base: '/syncbeat/'` | Zero-cost; app uses hash-based routing, so no server rewrite rules are needed |
| **Docker on a VM** | Build the image, `docker run` on any Linux host | Full control over the runtime environment |

---

## Getting started locally

```bash
npm install
```

Create `.env`:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

```bash
npm run dev       # http://localhost:5173
npm run build     # production build
npm run typecheck # strict TypeScript check
```

Run every file in `supabase/migrations/` in order via the Supabase SQL Editor before first use — each migration documents what it changes and why at the top of the file.

---

## Known trade-offs

Documented honestly rather than hidden:

- **Read access is broader than "code-only."** RLS is enabled on every table, but `SELECT` is granted to `anon`/`authenticated` broadly — required for Supabase Realtime's live-push to function. All **writes** remain fully gated by the room's 6-character code via `SECURITY DEFINER` RPCs. Practical effect: someone with the public anon key could query these tables directly, bypassing the "need the code" model, for reads only.
- **No real user authentication.** "Who is admin/DJ" is enforced client-side and by room-code possession, not a login system — trust is scoped to whoever has the code, consistent throughout the app.
- **Supabase free-tier projects pause after inactivity.** Expect to manually un-pause after long idle periods if hosted on the free tier.

---

## Project structure

```
src/
  lib/              supabase client, types, api wrapper, utils
  hooks/            useSyncEngine — realtime, presence, drift correction
  components/       room UIs, player, chat, queue, admin controls, duo features
supabase/
  migrations/        every schema change, self-documenting, in order
Dockerfile           multi-stage container build
```

---

## Roadmap

- [ ] GitHub Actions / Azure DevOps CI pipelines
- [ ] Kubernetes manifests for AKS deployment
- [ ] Custom domain + HTTPS