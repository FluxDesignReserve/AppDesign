import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const YTDLP = process.env.YTDLP_PATH || "yt-dlp";
export const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

/** Hosts the downloader is allowed to touch. Keeps this from becoming an open SSRF proxy. */
const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "instagram.com",
  "www.instagram.com",
]);

export type Source = "youtube" | "instagram";
export type Mode = "auto" | "audio" | "mute";

export interface MediaInfo {
  source: Source;
  id: string;
  title: string;
  uploader: string | null;
  thumbnail: string | null;
  durationSeconds: number | null;
  /** Available video heights, descending, e.g. [1080, 720, 480]. */
  heights: number[];
  hasAudio: boolean;
}

export interface DownloadRequest {
  url: string;
  mode: Mode;
  /** Max video height, e.g. 1080. Ignored for audio-only. */
  quality?: number;
  /** Audio container for audio-only downloads. */
  audioFormat?: "mp3" | "m4a" | "opus";
}

export interface ToolStatus {
  ytdlp: { available: boolean; version: string | null };
  ffmpeg: { available: boolean };
}

/** Reports whether the external binaries are installed and usable. */
export function checkTools(): ToolStatus {
  let ytVersion: string | null = null;
  let ytOk = false;
  try {
    const r = spawnSync(YTDLP, ["--version"], { encoding: "utf8", timeout: 10_000 });
    if (r.status === 0) {
      ytOk = true;
      ytVersion = (r.stdout || "").trim() || null;
    }
  } catch {
    ytOk = false;
  }

  let ffOk = false;
  try {
    const r = spawnSync(FFMPEG, ["-version"], { encoding: "utf8", timeout: 10_000 });
    ffOk = r.status === 0;
  } catch {
    ffOk = false;
  }

  return { ytdlp: { available: ytOk, version: ytVersion }, ffmpeg: { available: ffOk } };
}

export class InputError extends Error {}

/** Validates the URL and returns which supported service it belongs to. */
export function classifyUrl(raw: string): Source {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new InputError("That doesn't look like a valid link.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new InputError("Only http and https links are supported.");
  }
  const host = u.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    throw new InputError("Only YouTube and Instagram links are supported right now.");
  }
  if (host.includes("instagram")) return "instagram";
  return "youtube";
}

interface RawFormat {
  vcodec?: string;
  acodec?: string;
  height?: number | null;
}

interface RawInfo {
  id?: string;
  title?: string;
  uploader?: string;
  channel?: string;
  thumbnail?: string;
  duration?: number;
  formats?: RawFormat[];
  extractor_key?: string;
}

/** Runs `yt-dlp -J` and returns curated metadata for the UI. */
export async function getInfo(url: string): Promise<MediaInfo> {
  const source = classifyUrl(url);
  const args = ["-J", "--no-playlist", "--no-warnings", "--no-progress", url];
  const { code, stdout, stderr } = await run(YTDLP, args, 60_000);

  if (code !== 0) {
    throw new InputError(friendlyError(stderr) || "Couldn't read that link.");
  }

  let raw: RawInfo;
  try {
    raw = JSON.parse(stdout) as RawInfo;
  } catch {
    throw new InputError("Couldn't parse the media information.");
  }

  const heights = new Set<number>();
  let hasAudio = false;
  for (const f of raw.formats ?? []) {
    if (f.height && f.vcodec && f.vcodec !== "none") heights.add(f.height);
    if (f.acodec && f.acodec !== "none") hasAudio = true;
  }

  return {
    source,
    id: raw.id ?? "",
    title: raw.title?.trim() || "Untitled",
    uploader: raw.uploader || raw.channel || null,
    thumbnail: raw.thumbnail || null,
    durationSeconds: typeof raw.duration === "number" ? Math.round(raw.duration) : null,
    heights: [...heights].sort((a, b) => b - a),
    hasAudio,
  };
}

export interface PreparedDownload {
  filePath: string;
  fileName: string;
  cleanup: () => Promise<void>;
}

/**
 * Downloads the requested media into a temporary directory and returns the
 * resulting file. Callers must invoke cleanup() once the file is served.
 */
export async function prepareDownload(req: DownloadRequest): Promise<PreparedDownload> {
  classifyUrl(req.url); // validate host before spawning anything

  const dir = await mkdtemp(path.join(tmpdir(), "dl-"));
  const outTemplate = path.join(dir, "%(title).150B [%(id)s].%(ext)s");

  const args = [
    "--no-playlist",
    "--no-warnings",
    "--no-progress",
    "--restrict-filenames",
    "--no-part",
    "-o",
    outTemplate,
  ];

  if (req.mode === "audio") {
    const fmt = req.audioFormat ?? "mp3";
    args.push("-x", "--audio-format", fmt, "--audio-quality", "0");
  } else {
    const cap = req.quality && req.quality > 0 ? `[height<=${req.quality}]` : "";
    if (req.mode === "mute") {
      args.push("-f", `bv*${cap}/b${cap}`, "--merge-output-format", "mp4");
    } else {
      // auto: best video + best audio, merged.
      args.push("-f", `bv*${cap}+ba/b${cap}/b`, "--merge-output-format", "mp4");
    }
  }

  args.push(req.url);

  const { code, stderr } = await run(YTDLP, args, 30 * 60_000);
  const cleanup = () => rm(dir, { recursive: true, force: true });

  if (code !== 0) {
    await cleanup();
    throw new InputError(friendlyError(stderr) || "The download failed.");
  }

  const files = (await readdir(dir)).filter((f) => !f.endsWith(".part") && !f.endsWith(".ytdl"));
  if (files.length === 0) {
    await cleanup();
    throw new InputError("yt-dlp produced no output file.");
  }

  const fileName = files[0];
  return { filePath: path.join(dir, fileName), fileName, cleanup };
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Spawns a process (argv-only, never a shell) and collects its output. */
function run(cmd: string, args: string[], timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new InputError("The operation timed out."));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new InputError(`\`${cmd}\` is not installed or not on PATH.`));
      } else {
        reject(err);
      }
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

/** Turns noisy yt-dlp stderr into a short, user-facing line. */
function friendlyError(stderr: string): string | null {
  const line = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.toUpperCase().startsWith("ERROR"))
    .pop();
  if (!line) return null;
  let msg = line.replace(/^ERROR:\s*/i, "");
  if (/login required|rate-limit|not available|private|only available to/i.test(msg)) {
    return "This content is private, age-restricted, or requires login.";
  }
  if (/unable to download|unsupported url|no video/i.test(msg)) {
    return "Couldn't find a downloadable video at that link.";
  }
  // Trim overly long messages.
  if (msg.length > 200) msg = msg.slice(0, 197) + "...";
  return msg;
}
