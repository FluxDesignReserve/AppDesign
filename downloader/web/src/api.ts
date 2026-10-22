export type Source = "youtube" | "instagram" | "twitter";
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

export type JobStatus = "downloading" | "processing" | "ready" | "error";

export interface JobSnapshot {
  id: string;
  status: JobStatus;
  phase: string;
  percent: number | null;
  downloaded: number | null;
  total: number | null;
  error: string | null;
  fileName: string | null;
}

export async function startJob(params: DownloadParams): Promise<JobSnapshot> {
  const res = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) await readError(res);
  return (await res.json()) as JobSnapshot;
}

export async function pollJob(id: string): Promise<JobSnapshot> {
  const res = await fetch(`/api/jobs/${id}`);
  if (!res.ok) await readError(res);
  return (await res.json()) as JobSnapshot;
}

export function jobFileUrl(id: string): string {
  return `/api/jobs/${id}/file`;
}

export function cancelJob(id: string): void {
  void fetch(`/api/jobs/${id}`, { method: "DELETE" }).catch(() => {});
}
