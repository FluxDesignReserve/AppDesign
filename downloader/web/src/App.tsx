import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  cancelJob,
  fetchHealth,
  fetchInfo,
  jobFileUrl,
  pollJob,
  startJob,
  type AudioFormat,
  type JobSnapshot,
  type MediaInfo,
  type Mode,
  type ToolStatus,
} from "./api";

type Theme = "auto" | "dark" | "light";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "auto", label: "auto", hint: "video + audio" },
  { id: "audio", label: "audio", hint: "audio only" },
  { id: "mute", label: "mute", hint: "video, no sound" },
];

const AUDIO_FORMATS: AudioFormat[] = ["mp3", "m4a", "opus"];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatBytes(bytes: number | null): string | null {
  if (bytes === null) return null;
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function App() {
  const [theme, setTheme] = useState<Theme>(() => load<Theme>("dl.theme", "auto"));
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>(() => load<Mode>("dl.mode", "auto"));
  const [quality, setQuality] = useState<number | null>(() => load<number | null>("dl.quality", null));
  const [audioFormat, setAudioFormat] = useState<AudioFormat>(() =>
    load<AudioFormat>("dl.audioFormat", "mp3"),
  );

  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolStatus | null>(null);
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => stopPolling, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    save("dl.theme", theme);
  }, [theme]);
  useEffect(() => save("dl.mode", mode), [mode]);
  useEffect(() => save("dl.quality", quality), [quality]);
  useEffect(() => save("dl.audioFormat", audioFormat), [audioFormat]);

  useEffect(() => {
    fetchHealth().then(setTools).catch(() => setTools(null));
    inputRef.current?.focus();
  }, []);

  const toolsReady = tools?.ytdlp.available ?? true;

  const qualityOptions = useMemo(() => info?.heights ?? [], [info]);
  const effectiveQuality = useMemo(() => {
    if (qualityOptions.length === 0) return quality;
    if (quality && qualityOptions.includes(quality)) return quality;
    return qualityOptions[0];
  }, [quality, qualityOptions]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    stopPolling();
    setJob(null);
    try {
      const result = await fetchInfo(trimmed);
      setInfo(result);
      if (!quality && result.heights.length) setQuality(result.heights[0]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        inputRef.current?.focus();
      }
    } catch {
      inputRef.current?.focus();
    }
  }

  function saveFile(id: string) {
    const a = document.createElement("a");
    a.href = jobFileUrl(id);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleDownload() {
    if (!info || job) return;
    setError(null);
    try {
      const started = await startJob({
        url: url.trim(),
        mode,
        quality: mode === "audio" ? undefined : effectiveQuality ?? undefined,
        audioFormat: mode === "audio" ? audioFormat : undefined,
      });
      setJob(started);
      pollRef.current = window.setInterval(async () => {
        try {
          const s = await pollJob(started.id);
          setJob(s);
          if (s.status === "ready") {
            stopPolling();
            saveFile(s.id);
            window.setTimeout(() => setJob(null), 1600);
          } else if (s.status === "error") {
            stopPolling();
            setError(s.error ?? "The download failed.");
            setJob(null);
          }
        } catch (err) {
          stopPolling();
          setError(err instanceof ApiError ? err.message : "Lost contact with the server.");
          setJob(null);
        }
      }, 600);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the download.");
    }
  }

  function handleCancel() {
    if (job) cancelJob(job.id);
    stopPolling();
    setJob(null);
  }

  const cycleTheme = () =>
    setTheme((t) => (t === "auto" ? "dark" : t === "dark" ? "light" : "auto"));

  return (
    <div className="page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="yoink home">
          <LogoIcon />
          <span>yoink</span>
        </a>
        <button className="icon-btn" onClick={cycleTheme} title={`theme: ${theme}`}>
          <ThemeIcon theme={theme} />
        </button>
      </header>

      <main className="stage">
        <div className="hero">
          <h1 className="headline">save what you want to keep</h1>
          <p className="subhead">
            paste a YouTube, Instagram or Twitter/X link — get the video or just the audio. no
            ads, no sign-in, nothing tracked.
          </p>

          {!toolsReady && tools && (
            <div className="banner" role="alert">
              <strong>Backend not ready.</strong> <code>yt-dlp</code> was not found. Install it (and{" "}
              <code>ffmpeg</code>) on the server — see the README — then reload.
            </div>
          )}

          <form className={`bar ${url.trim() ? "filled" : ""}`} onSubmit={handleSubmit}>
            <span className="bar-icon" aria-hidden>
              <LinkIcon />
            </span>
            <input
              ref={inputRef}
              className="bar-input"
              type="url"
              inputMode="url"
              placeholder="paste a YouTube, Instagram or Twitter link"
              value={url}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setUrl(e.target.value)}
            />
            {url.trim() ? (
              <button className="bar-btn go" type="submit" disabled={loading} title="fetch">
                {loading ? <Spinner /> : <ArrowIcon />}
              </button>
            ) : (
              <button className="bar-btn paste" type="button" onClick={handlePaste} title="paste">
                <ClipboardIcon />
                <span>paste</span>
              </button>
            )}
          </form>

          <div className="modes" role="tablist" aria-label="download mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="tab"
                aria-selected={mode === m.id}
                className={`mode ${mode === m.id ? "active" : ""}`}
                onClick={() => setMode(m.id)}
              >
                <span className="mode-label">{m.label}</span>
                <span className="mode-hint">{m.hint}</span>
              </button>
            ))}
          </div>

          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          {info && (
            <section className="result">
              <div className="result-media">
                {info.thumbnail ? (
                  <img className="thumb" src={info.thumbnail} alt="" loading="lazy" />
                ) : (
                  <div className="thumb thumb-empty" aria-hidden />
                )}
                <div className="result-meta">
                  <span className={`badge badge-${info.source}`}>{info.source}</span>
                  <h2 className="result-title" title={info.title}>
                    {info.title}
                  </h2>
                  <p className="result-sub">
                    {info.uploader ?? "unknown"}
                    {formatDuration(info.durationSeconds)
                      ? ` · ${formatDuration(info.durationSeconds)}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="options">
                {mode === "audio" ? (
                  <div className="opt-group">
                    <span className="opt-label">format</span>
                    <div className="segmented">
                      {AUDIO_FORMATS.map((f) => (
                        <button
                          key={f}
                          className={audioFormat === f ? "seg active" : "seg"}
                          onClick={() => setAudioFormat(f)}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : qualityOptions.length > 0 ? (
                  <div className="opt-group">
                    <span className="opt-label">quality</span>
                    <div className="segmented scroll">
                      {qualityOptions.map((h) => (
                        <button
                          key={h}
                          className={effectiveQuality === h ? "seg active" : "seg"}
                          onClick={() => setQuality(h)}
                        >
                          {h}p
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span className="opt-label muted">best available quality</span>
                )}

                {!job && (
                  <button className="download-btn" onClick={handleDownload} disabled={!toolsReady}>
                    <DownloadIcon />
                    download{" "}
                    {mode === "audio" ? audioFormat : effectiveQuality ? `${effectiveQuality}p` : ""}
                  </button>
                )}
              </div>

              {job && (
                <div className="progress" role="status" aria-live="polite">
                  <div className={`bar-track ${job.percent === null ? "indeterminate" : ""}`}>
                    <div
                      className={`bar-fill ${job.status === "ready" ? "ready" : ""}`}
                      style={job.percent !== null ? { width: `${job.percent}%` } : undefined}
                    />
                  </div>
                  <div className="progress-row">
                    <span className="progress-label">
                      {job.status === "ready"
                        ? "saved ✓"
                        : job.status === "downloading"
                          ? `downloading${job.percent !== null ? ` ${Math.round(job.percent)}%` : "…"}`
                          : `${job.phase}…`}
                    </span>
                    <span className="progress-bytes">
                      {job.status === "downloading" && job.total
                        ? `${formatBytes(job.downloaded)} / ${formatBytes(job.total)}`
                        : ""}
                    </span>
                    {job.status !== "ready" && (
                      <button className="cancel-btn" onClick={handleCancel}>
                        cancel
                      </button>
                    )}
                  </div>
                </div>
              )}

              <p className="result-note">
                the server fetches and packages the file, then your browser saves it — large videos
                may take a moment.
              </p>
            </section>
          )}
        </div>
      </main>

      <footer className="footer">
        <span>
          for content you own or are licensed to download. respect each platform's terms and
          creators' rights.
        </span>
        <span className="footer-tools">
          {tools?.ytdlp.available ? `yt-dlp ${tools.ytdlp.version}` : "yt-dlp offline"}
        </span>
      </footer>
    </div>
  );
}

/* ---------- icons (inline, no dependencies) ---------- */

function LogoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="6" fill="currentColor" opacity="0.16" />
      <path d="M12 6v8m0 0l-3.2-3.2M12 14l3.2-3.2M7 17.5h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 15l6-6M10.5 6.5l1-1a4 4 0 015.7 5.7l-1 1M13.5 17.5l-1 1a4 4 0 01-5.7-5.7l1-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h13m0 0l-5.5-5.5M18 12l-5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="8" y="4" width="8" height="4" rx="1.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 6H6.5A1.5 1.5 0 005 7.5v11A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0017.5 6H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "light") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (theme === "dark") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 4a8 8 0 000 16z" fill="currentColor" />
    </svg>
  );
}

function Spinner() {
  return <span className="spinner" aria-label="loading" />;
}
