<div align="center">

# 🎵 SyncBeat

### Listen together, in perfect sync.

Real-time synchronized music rooms — pick a vibe, share a 6-character code, and hear the same moment, together.

[![Live Site](https://img.shields.io/badge/Live-syncbeatas.dev-3ddc97?style=for-the-badge)](https://syncbeatas.dev)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Realtime%20%2B%20Postgres-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=flat-square&logo=docker&logoColor=white)
![Azure](https://img.shields.io/badge/Azure-Web%20App%20%2B%20ACR-0078D4?style=flat-square&logo=microsoftazure&logoColor=white)
![Azure DevOps](https://img.shields.io/badge/Azure%20DevOps-CI%2FCD-0078D7?style=flat-square&logo=azuredevops&logoColor=white)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [🚀 Deployment & CI/CD (Azure)](#-deployment--cicd-azure) ⭐
- [🗄️ Backend & Database (Supabase)](#️-backend--database-supabase)
- [🌍 Custom Domain & DNS](#-custom-domain--dns)
- [Core Sync Mechanic](#-core-sync-mechanic)
- [Run Locally](#-run-locally)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)
- [Data Privacy & Security](#-data-privacy--security)
- [Accessibility](#-accessibility)

---

## 🌐 Overview

**SyncBeat** is a real-time synchronized listening platform with two portals sharing one sync engine:

| Portal | Description |
|---|---|
| 👥 **Teams** | Group listening rooms — upvote/downvote queue, DJ role, mood & language tags, live chat, and a shareable session recap. |
| ❤️ **Duo** | Private two-person rooms — floating heart reactions, an "Our Songs" memory timeline, a love-notes board, scheduled surprise reveals, and a shared countdown. |

Every listener hears the **same moment at the same time**: the backend is the single source of truth for playback state, and each client silently corrects local drift beyond 300 ms.

---

## ✨ Features

### 👥 Teams (group listening)
- Upvote / downvote queue that re-sorts live by net votes
- DJ role — host can promote/demote a DJ with priority controls
- Mood & language tags with live filtering
- One-click, downloadable **session recap** card

### ❤️ Duo (two-person room)
- Hard-capped at 2 people, with a "waiting for your partner" state
- Floating heart reactions, separate from text chat
- **Our Songs** — a private, tagged musical timeline for the pair
- Love-notes board + scheduled surprise messages
- Shared live countdown to a chosen date

### 🤝 Shared by both
- 6-character room code — create or join instantly
- Real-time chat with presence, typing indicators, and emoji reactions
- YouTube IDs **and** direct audio URLs supported as track sources

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Realtime | Supabase Realtime (Broadcast + Presence + Postgres Changes) |
| Persistence | Supabase Postgres (rooms, tracks, messages, memories, notes, countdowns) |
| Server authority | Postgres `SECURITY DEFINER` RPCs — the equivalent of Express + Socket.io handlers |
| Media playback | HTML5 `<audio>` for direct files · YouTube IFrame Player API for YouTube IDs |
| Containerization | Multi-stage `Dockerfile` (Node build → static `serve` runtime) |
| Cloud & CI/CD | **Azure DevOps · Azure Container Registry · Azure Web App for Containers** |
| Domain & DNS | Custom domain on **name.com** (`syncbeatas.dev`) |

---

## 🚀 Deployment & CI/CD (Azure)

> This is the part I'm proudest of — a full, real, working DevOps pipeline, not just `git push` to a host. Here's exactly how SyncBeat goes from a commit to a live, containerized production app.

### 🏗️ Production Architecture

```
┌──────────────┐      mirror       ┌───────────────────┐
│    GitHub    │ ────────────────► │   Azure Repos      │
│  (source of  │                   │  (Azure DevOps)    │
│   truth)     │                   └─────────┬──────────┘
└──────────────┘                             │  triggers on push to main
                                              ▼
                                  ┌─────────────────────────┐
                                  │      Azure Pipelines      │
                                  │  1. npm ci                │
                                  │  2. tsc typecheck + lint  │
                                  │  3. docker build           │
                                  │  4. docker push  ───────┐ │
                                  └─────────────────────────┘ │
                                                               ▼
                                                 ┌───────────────────────┐
                                                 │  Azure Container      │
                                                 │  Registry (ACR)       │
                                                 │  syncbeat:latest      │
                                                 └───────────┬───────────┘
                                                              │ CD — pull & restart
                                                              ▼
                                                 ┌───────────────────────┐
                                                 │  Azure Web App         │
                                                 │  (Web App for          │
                                                 │   Containers, Linux)   │
                                                 └───────────┬───────────┘
                                                              │
                                    ┌─────────────────────────┼─────────────────────────┐
                                    ▼                                                   ▼
                       Custom domain: syncbeatas.dev                     Supabase (ap-southeast-1)
                       DNS via name.com → CNAME to                       Postgres + Realtime
                       *.azurewebsites.net
```

### ⚙️ How the pipeline works

| Stage | What happens |
|---|---|
| **1. Source control** | The GitHub repo is mirrored into an **Azure Repos** project (`SyncBeat`) so the entire history lives natively inside Azure DevOps. |
| **2. Build (CI)** | An **Azure Pipeline** triggers on every push to `main`: installs dependencies, type-checks, lints, then builds the multi-stage `Dockerfile`. |
| **3. Package** | The resulting image is tagged and **pushed to Azure Container Registry (ACR)** — a private, versioned registry for every build. |
| **4. Release (CD)** | The pipeline's release stage points the **Azure Web App (Web App for Containers)** at the new ACR image tag; the App Service pulls it and restarts with zero manual steps. |
| **5. DNS & TLS** | The custom domain **`syncbeatas.dev`** (registered on name.com) is pointed at the Web App via DNS records, so the pipeline output is served on a real domain rather than the default `azurewebsites.net`. |
| **6. Data layer** | Supabase (Postgres + Realtime), hosted in `ap-southeast-1`, stays fully decoupled from the app tier — the Web App only ever talks to it over HTTPS with the anon key, never anything privileged. |

### ☁️ Why Web App + ACR

Azure App Service (**Web App for Containers**) was chosen as the primary target because it gives a fully managed, auto-scaling runtime for a single containerized frontend with **no cluster to operate** — the fastest path from "green pipeline" to "live URL" for a project this size, while still being a real, production-grade deployment (not a static-hosting shortcut).

### 🧭 Other deployment paths this project also supports

The same Docker image is portable, so the identical build can be redeployed onto any of these — kept here as documented alternatives / roadmap rather than what's currently live:

| Target | Status | Notes |
|---|---|---|
| **Azure Web App + ACR** | ✅ **Live (production)** | Current deployment — see above. |
| **Azure VM** | 🗺️ Planned | Provision a VM, install Docker, `docker run` the ACR image directly, front with Nginx for TLS. Useful if fine-grained OS-level control is ever needed. |
| **Azure Kubernetes Service (AKS)** | 🗺️ Planned | Push the same image to ACR, deploy via a `Deployment` + `Service` manifest, scale with an HPA. The natural next step if SyncBeat needs multi-region or high-availability scaling. |
| **Azure Functions** | 🗺️ Considered | Not a fit for the frontend itself, but a candidate for moving specific server-side jobs (e.g. scheduled "surprise reveal" delivery) to serverless in the future. |

### 📦 Build & push manually (what the pipeline automates)

```bash
# Build the image
docker build -t syncbeat \
  --build-arg VITE_SUPABASE_URL=your_supabase_url \
  --build-arg VITE_SUPABASE_ANON_KEY=your_anon_key .

# Tag for Azure Container Registry
docker tag syncbeat <your-acr-name>.azurecr.io/syncbeat:latest

# Push to ACR
az acr login --name <your-acr-name>
docker push <your-acr-name>.azurecr.io/syncbeat:latest

# Point the Web App at the new image (or let the pipeline's release stage do it)
az webapp config container set \
  --name <your-webapp-name> \
  --resource-group <your-resource-group> \
  --docker-custom-image-name <your-acr-name>.azurecr.io/syncbeat:latest
```

---

## 🗄️ Backend & Database (Supabase)

SyncBeat's entire backend is **Supabase** — there is no separate Node/Express server. Supabase provides the Postgres database, realtime transport, and the server-authoritative logic layer, all fully decoupled from the frontend and the Azure app tier.

### Project details

| Setting | Value |
|---|---|
| Region | Southeast Asia (Singapore) — `ap-southeast-1` |
| Compute | Nano tier |
| Status | Healthy |
| Connections | Realtime + direct Postgres, up to 60 concurrent |

### What lives in Supabase

| Piece | Role |
|---|---|
| **Postgres** | Source of truth for rooms, tracks, chat messages, votes, Duo memories/notes/countdowns, and accounts. |
| **Realtime** | Broadcast, Presence, and Postgres Changes — pushes every room mutation to connected clients instantly, replacing a Socket.io layer. |
| **`SECURITY DEFINER` RPCs** | All writes go through Postgres functions instead of raw table access — the equivalent of Express route handlers, but running inside the database itself. |
| **Row-Level Security (RLS)** | Enabled on every table with no policies granted to `anon`/`authenticated` — the frontend can never read or write a table directly; every operation is mediated by an RPC that validates the room code first. |

### Migrations

The schema is fully version-controlled as sequential SQL migrations under `supabase/migrations/`, tracking the project's evolution from the initial schema to accounts:

```
20260715044141_syncbeat_schema.sql            → core tables (rooms, tracks, messages, votes…)
20260715044200_syncbeat_grants.sql            → RPC execute grants
20260715044907_syncbeat_resolve_room.sql      → room-code resolution RPC
20260715054500_syncbeat_fix_realtime.sql      → realtime publication fixes
20260715060000_syncbeat_rls_read_policies.sql → read-path RLS policies
20260715070000_syncbeat_transfer_host.sql     → host transfer RPC
20260715080000_syncbeat_song_catalog.sql      → shared song catalog
20260718060000_syncbeat_accounts.sql          → user accounts
```

### How the frontend talks to Supabase

```ts
// src/lib/supabase.ts
const supabase = createClient(url, anonKey, {
  realtime: { params: { eventsPerSecond: 20 } },
});
```

The client only ever holds the **anon key** — never a service-role key — so even if it were extracted from the bundle, it has no privileged access; every meaningful action still has to pass through an RPC's own validation.

---

## 🌍 Custom Domain & DNS

SyncBeat runs on its own domain rather than a default Azure/Vercel-style subdomain.

| Setting | Value |
|---|---|
| Domain | **`syncbeatas.dev`** |
| Registrar | name.com |
| Privacy | Whois privacy **ON** |
| Transfer lock | **Enabled** |
| DNS management | Manual A/CNAME records via name.com's DNS panel |

### How it's wired up

1. The domain is registered and managed on **name.com**, with Whois privacy and transfer lock both enabled for security.
2. Inside name.com's **Manage DNS** panel, a record is added pointing `syncbeatas.dev` at the Azure Web App (A record to the App Service's IP, or a CNAME to its `*.azurewebsites.net` hostname, with the root mapped via name.com's ALIAS/URL-forwarding support).
3. DNS changes are given up to 48 hours to propagate before being considered final.
4. Once propagated, the Azure Web App's **custom domain binding** is configured to accept traffic for `syncbeatas.dev`, so the CI/CD pipeline's deployments are immediately live on the real domain — no manual re-pointing needed after every release.

---

## 🔄 Core Sync Mechanic

- The `rooms` table is the single source of truth: `is_playing`, `position_ms`, `updated_at`.
- Every play/pause/seek/track-change calls the `trigger_sync` RPC, stamping a server timestamp.
- The change is broadcast to all connected clients via Supabase Realtime Postgres Changes.
- Each client computes expected position as `position_ms + (now - updated_at)` and self-corrects if it drifts more than **300 ms** — keeping every listener on the same beat regardless of network latency.

---

## 💻 Run Locally

```bash
npm install
npm run dev
```

```bash
# Production build
npm run build      # type-checks + bundles to dist/
npm run preview    # serves the built bundle locally

# Docker (same image used in production)
docker build -t syncbeat .
docker run -p 4173:4173 syncbeat
```

---

## 🔐 Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (frontend-safe, RLS-protected) |

No other secrets are required — YouTube playback uses the public IFrame API.

---

## 📁 Project Structure

```
src/
  lib/            supabase client, types, api wrapper, utils, youtube loader
  hooks/          useSyncEngine (realtime + presence + drift), useRoomPage
  components/
    Landing.tsx        portal selection + create/join
    TeamsRoom.tsx       Teams room
    DuoRoom.tsx         Duo room
    Player.tsx          HTML5 audio + YouTube IFrame, drift correction
    Queue.tsx           upvote/downvote, live re-sort, DJ controls
    Chat.tsx            messages, typing, emoji reactions
    Members.tsx         presence list, host/DJ badges
    AddTrack.tsx        URL/ID input + tag selection
    SessionRecap.tsx    Teams session summary card
    FloatingHearts.tsx  Duo real-time heart reactions
    CountdownPanel.tsx  Duo countdown
    DuoFeatures.tsx     Our Songs, Love Notes, Scheduled Surprises
supabase/
  migrations/     schema, RLS policies, grants, RPCs (server-authoritative logic)
Dockerfile        multi-stage build → static production image
```

---

## 🔒 Data Privacy & Security

Duo room data (notes, memories, scheduled messages, countdowns) is scoped strictly to that room's two participants. **Row-Level Security is enabled on every table with no direct policies granted to anon/authenticated** — all reads and writes go through `SECURITY DEFINER` RPCs that verify the 6-character room code before acting. No cross-room or public visibility is possible without a room's code.

---

## ♿ Accessibility

- Visible focus states on all interactive elements
- `prefers-reduced-motion` respected
- Sufficient color contrast across both portal themes
- Mobile-responsive from 320px up to desktop

---

<div align="center">

**Built and deployed end-to-end — from React components and a Supabase backend to a live Azure production pipeline on a custom domain.**

</div>
