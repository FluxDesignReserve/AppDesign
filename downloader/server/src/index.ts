import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkTools,
  getInfo,
  InputError,
  prepareDownload,
  type DownloadRequest,
  type Mode,
} from "./ytdlp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
const app = express();

app.use(cors());
app.use(express.json({ limit: "16kb" }));

/* ---------------- download jobs ---------------- */

type JobStatus = "downloading" | "processing" | "ready" | "error";

interface Job {
  id: string;
  status: JobStatus;
  phase: string;
  percent: number | null; // 0..100 while downloading, null when indeterminate
  downloaded: number | null;
  total: number | null;
  error: string | null;
  filePath: string | null;
  fileName: string | null;
  cleanup: (() => Promise<void>) | null;
  createdAt: number;
}

const jobs = new Map<string, Job>();
const MAX_JOBS = 40;
const JOB_TTL_MS = 15 * 60_000;

function snapshot(job: Job) {
  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    percent: job.percent,
    downloaded: job.downloaded,
    total: job.total,
    error: job.error,
    fileName: job.fileName,
  };
}

async function destroyJob(job: Job) {
  await job.cleanup?.().catch(() => {});
  jobs.delete(job.id);
}

// Sweep expired / stale jobs.
setInterval(() => {
  const now = Date.now();
  for (const job of jobs.values()) {
    if (now - job.createdAt > JOB_TTL_MS) void destroyJob(job);
  }
}, 60_000).unref();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, tools: checkTools() });
});

app.post("/api/info", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const url = String(req.body?.url ?? "");
    if (!url) throw new InputError("Paste a link first.");
    const info = await getInfo(url);
    res.json(info);
  } catch (err) {
    next(err);
  }
});

// Start a download job; returns an id the client polls for progress.
app.post("/api/jobs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (jobs.size >= MAX_JOBS) {
      throw new InputError("The server is busy. Try again in a moment.");
    }
    const url = String(req.body?.url ?? "");
    const mode = String(req.body?.mode ?? "auto") as Mode;
    if (!url) throw new InputError("Missing url.");
    if (!["auto", "audio", "mute"].includes(mode)) throw new InputError("Invalid mode.");

    const dl: DownloadRequest = { url, mode };
    const quality = Number(req.body?.quality);
    if (Number.isFinite(quality) && quality > 0) dl.quality = quality;
    const audioFormat = String(req.body?.audioFormat ?? "");
    if (audioFormat === "mp3" || audioFormat === "m4a" || audioFormat === "opus") {
      dl.audioFormat = audioFormat;
    }

    const job: Job = {
      id: randomUUID(),
      status: "downloading",
      phase: "starting",
      percent: null,
      downloaded: null,
      total: null,
      error: null,
      filePath: null,
      fileName: null,
      cleanup: null,
      createdAt: Date.now(),
    };
    jobs.set(job.id, job);

    // Run in the background; the client polls /api/jobs/:id.
    void prepareDownload(dl, (ev) => {
      if (ev.kind === "progress") {
        job.downloaded = ev.downloaded;
        job.total = ev.total;
        job.percent =
          ev.downloaded !== null && ev.total ? Math.min(100, (ev.downloaded / ev.total) * 100) : null;
      } else {
        job.phase = ev.phase;
        job.status = ev.phase === "downloading" ? "downloading" : "processing";
        if (job.status === "processing") job.percent = null;
      }
    })
      .then(({ filePath, fileName, cleanup }) => {
        job.filePath = filePath;
        job.fileName = fileName;
        job.cleanup = cleanup;
        job.status = "ready";
        job.phase = "ready";
        job.percent = 100;
      })
      .catch((err: unknown) => {
        job.status = "error";
        job.error = err instanceof Error ? err.message : "The download failed.";
      });

    res.status(202).json(snapshot(job));
  } catch (err) {
    next(err);
  }
});

// Poll job progress.
app.get("/api/jobs/:id", (req: Request, res: Response) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found or expired." });
    return;
  }
  res.json(snapshot(job));
});

// Fetch the finished file, then dispose of the job.
app.get("/api/jobs/:id/file", (req: Request, res: Response, next: NextFunction) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found or expired." });
    return;
  }
  if (job.status !== "ready" || !job.filePath || !job.fileName) {
    res.status(409).json({ error: "The file is not ready yet." });
    return;
  }
  try {
    const size = statSync(job.filePath).size;
    res.setHeader("Content-Length", size);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", contentDisposition(job.fileName));

    const stream = createReadStream(job.filePath);
    stream.on("error", () => {
      if (!res.headersSent) res.status(500);
      res.end();
    });
    let disposed = false;
    const done = () => {
      if (disposed) return;
      disposed = true;
      void destroyJob(job);
    };
    res.on("close", done);
    stream.on("end", done);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

// Cancel / discard a job.
app.delete("/api/jobs/:id", async (req: Request, res: Response) => {
  const job = jobs.get(req.params.id);
  if (job) await destroyJob(job);
  res.json({ ok: true });
});

// Serve the built frontend in production, if it has been built.
const webDist = path.resolve(__dirname, "../../web/dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(webDist, "index.html"));
  });
}

// Central error handler → JSON.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof InputError ? 400 : 500;
  const message = err instanceof Error ? err.message : "Something went wrong.";
  if (status === 500) console.error(err);
  if (res.headersSent) return;
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  const tools = checkTools();
  console.log(`\n  downloader server → http://localhost:${PORT}`);
  console.log(`  yt-dlp: ${tools.ytdlp.available ? tools.ytdlp.version : "NOT FOUND"}`);
  console.log(`  ffmpeg: ${tools.ffmpeg.available ? "ok" : "NOT FOUND"}\n`);
});

/** Builds an RFC 5987-safe Content-Disposition header for arbitrary filenames. */
function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(name);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
