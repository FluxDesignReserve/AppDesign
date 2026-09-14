export type Source = "youtube" | "instagram";
export type Mode = "auto" | "audio" | "mute";
export type AudioFormat = "mp3" | "m4a" | "opus";

export interface MediaInfo {
  source: Source;
  id: string;
  title: string;
  uploader: string | null;
  thumbnail: string | null;
  durationSeconds: number | null;
  heights: number[];
  hasAudio: boolean;
}

export interface ToolStatus {
  ytdlp: { available: boolean; version: string | null };
  ffmpeg: { available: boolean };
}

export class ApiError extends Error {}

async function readError(res: Response): Promise<never> {
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) message = body.error;
  } catch {
    /* ignore */
  }
  throw new ApiError(message);
}

export async function fetchHealth(): Promise<ToolStatus> {
  const res = await fetch("/api/health");
  if (!res.ok) await readError(res);
  const body = (await res.json()) as { tools: ToolStatus };
  return body.tools;
}

export async function fetchInfo(url: string): Promise<MediaInfo> {
  const res = await fetch("/api/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) await readError(res);
  return (await res.json()) as MediaInfo;
}

export interface DownloadParams {
  url: string;
  mode: Mode;
  quality?: number;
  audioFormat?: AudioFormat;
}

export function downloadUrl(params: DownloadParams): string {
  const q = new URLSearchParams({ url: params.url, mode: params.mode });
  if (params.quality) q.set("quality", String(params.quality));
  if (params.audioFormat) q.set("audioFormat", params.audioFormat);
  return `/api/download?${q.toString()}`;
}
