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

app.get("/api/download", async (req: Request, res: Response, next: NextFunction) => {
  let cleanupFn: (() => Promise<void>) | null = null;
  try {
    const url = String(req.query.url ?? "");
    const mode = String(req.query.mode ?? "auto") as Mode;
    if (!url) throw new InputError("Missing url.");
    if (!["auto", "audio", "mute"].includes(mode)) throw new InputError("Invalid mode.");

    const dl: DownloadRequest = { url, mode };
    const quality = Number(req.query.quality);
    if (Number.isFinite(quality) && quality > 0) dl.quality = quality;
    const audioFormat = String(req.query.audioFormat ?? "");
    if (audioFormat === "mp3" || audioFormat === "m4a" || audioFormat === "opus") {
      dl.audioFormat = audioFormat;
    }

    const { filePath, fileName, cleanup } = await prepareDownload(dl);
    cleanupFn = cleanup;

    const size = statSync(filePath).size;
    res.setHeader("Content-Length", size);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", contentDisposition(fileName));

    const stream = createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) res.status(500);
      res.end();
    });
    const done = () => {
      cleanupFn?.().catch(() => {});
      cleanupFn = null;
    };
    res.on("close", done);
    stream.on("end", done);
    stream.pipe(res);
  } catch (err) {
    await cleanupFn?.().catch(() => {});
    next(err);
  }
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
