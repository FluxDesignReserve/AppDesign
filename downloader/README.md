# yoink — a cobalt.tools-style downloader

Paste a **YouTube** or **Instagram** link and save the video, a muted video, or just
the audio. Clean single-screen UI inspired by [cobalt.tools](https://cobalt.tools),
powered by [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) on the backend.

- **Frontend** — React + Vite + TypeScript. A paste-a-link bar, `auto / audio / mute`
  modes, quality and audio-format pickers, a preview card, light/dark/auto theme.
- **Backend** — Express + TypeScript. Wraps `yt-dlp` (which does the actual extraction),
  restricts requests to YouTube/Instagram hosts, packages the file, and streams it to
  the browser as a download.

## ⚠️ Legal / usage note

This tool is intended for downloading content **you own, created, or are licensed to
download** (e.g. your own uploads, Creative-Commons material, or content whose owner
permits it). Downloading copyrighted videos can violate YouTube's and Instagram's Terms
of Service and local law. You are responsible for how you use it.

## Prerequisites

You need two external tools on your machine (they are **not** bundled):

| Tool | Purpose | Install |
|---|---|---|
| **yt-dlp** | extracts media from YouTube/Instagram | `brew install yt-dlp` · `pipx install yt-dlp` · [docs](https://github.com/yt-dlp/yt-dlp#installation) |
| **ffmpeg** | merges video+audio, converts audio | `brew install ffmpeg` · `apt install ffmpeg` · [ffmpeg.org](https://ffmpeg.org/download.html) |

Also **Node.js 18+**. The app checks for `yt-dlp`/`ffmpeg` on startup and shows a banner
in the UI if either is missing.

## Run it

```bash
cd downloader
npm install          # installs both workspaces (server + web)
npm run dev          # server on :8787, web on :5174 (open this one)
```

Open **http://localhost:5174**. The Vite dev server proxies `/api/*` to the backend.

### Production build

```bash
npm run build        # builds the web app, then compiles the server
npm start            # serves API + built frontend on http://localhost:8787
```

When built, the server also serves the static frontend, so a single origin runs the
whole app.

## Configuration (env vars)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | backend port |
| `YTDLP_PATH` | `yt-dlp` | path to the yt-dlp binary |
| `FFMPEG_PATH` | `ffmpeg` | path to the ffmpeg binary |
| `API_ORIGIN` | `http://localhost:8787` | backend origin the Vite dev proxy targets |

## How it works

1. `POST /api/info` runs `yt-dlp -J <url>` and returns curated metadata (title,
   thumbnail, duration, available heights) for the preview card.
2. `GET /api/download?url=&mode=&quality=&audioFormat=` runs `yt-dlp` into a temp
   directory with the right format selector, then streams the resulting file back with a
   proper `Content-Disposition`, and cleans up.

Only `youtube.com`, `youtu.be`, `music.youtube.com`, and `instagram.com` hosts are
accepted — the server is not a general-purpose fetch proxy. Commands are spawned with
argv arrays (never a shell), so URLs can't inject arguments.

## Project layout

```
downloader/
├── server/            Express + yt-dlp wrapper
│   └── src/
│       ├── index.ts   HTTP endpoints
│       └── ytdlp.ts   yt-dlp integration, URL validation, tool checks
└── web/               React + Vite frontend
    └── src/
        ├── App.tsx    the whole single-screen UI
        ├── api.ts     typed API client
        └── styles.css design system (cobalt-style, theme-aware)
```
