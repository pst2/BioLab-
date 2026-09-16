"use client";

/**
 * GenomeBrowser — IGV.js integration for the Gene Detail Visualization tab.
 *
 * Rendering strategy:
 *  - IGV.js manipulates the DOM directly, so it cannot be rendered on the
 *    server.  We use a plain dynamic import() inside useEffect rather than
 *    next/dynamic (which would try to SSR the wrapper component).
 *  - The browser is destroyed on unmount via browser.dispose() / innerHTML=""
 *    to prevent memory leaks.
 *
 * Guard conditions (renders a friendly placeholder when unmet):
 *  - gene.genomic_accession must match ^(NC_|NW_|NZ_)
 *  - gene.start and gene.end must be defined
 *
 * FASTA URL format (proxied through Next.js → FastAPI):
 *  /api/v1/sequence/igv/fasta?accession={genomic_accession}&start={start-PADDING}&end={end+PADDING}
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  AlertCircle,
  Box,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Dna,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { GeneDetail } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

// ── Constants ─────────────────────────────────────────────────────────────────

/** bp padding added on each side of the gene locus passed to IGV. */
const LOCUS_PADDING = 5_000;

/** Maximum initial chunk requested for IGV FASTA reference to ensure instant loading. */
const MAX_INITIAL_CHUNK = 100_000;

/** Common genome assembly versions for display */
const ASSEMBLY_LABELS: Record<string, string> = {
  "GRCh38": "GRCh38 / hg38",
  "GRCh37": "GRCh37 / hg19",
  "GRCm39": "GRCm39 / mm39",
  "GRCm38": "GRCm38 / mm10",
};

/**
 * Regex for valid IGV FASTA reference accessions.
 * Must look like a real RefSeq or INSDC accession (e.g. NC_000005.10, NM_007294, MK570060.1, CM000667.2).
 * A plain numeric gene ID (e.g. "672") is NOT a valid FASTA accession for IGV.
 */
const VALID_ACCESSION_RE = /^(?=.*[A-Za-z])[A-Za-z0-9_.-]{3,40}$/;

/** Loading stage definitions for progress display */
const LOADING_STAGES = [
  { key: "stageLoadingIgv" as const, progress: 20 },
  { key: "stageFetchingSeq" as const, progress: 60 },
  { key: "stageRendering" as const, progress: 90 },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type BrowserStatus = "idle" | "loading" | "ready" | "error";
type LoadingStage = 0 | 1 | 2 | 3;

interface GenomeBrowserProps {
  gene: GeneDetail;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computePaddedRange(start: number, end: number, sequenceLength?: number) {
  // Clamp start/end to valid range
  const safeStart = Math.max(1, start);
  const safeEnd = Math.max(safeStart, end);
  const maxBoundary = sequenceLength && sequenceLength > 0 ? sequenceLength : safeEnd;
  const paddedStart = Math.max(1, safeStart > LOCUS_PADDING ? safeStart - LOCUS_PADDING : 1);
  let paddedEnd = Math.min(safeEnd + LOCUS_PADDING, maxBoundary);
  if (paddedEnd - paddedStart > MAX_INITIAL_CHUNK) {
    paddedEnd = paddedStart + MAX_INITIAL_CHUNK;
  }
  if (paddedEnd <= paddedStart) paddedEnd = paddedStart + 1;
  return { paddedStart, paddedEnd };
}

function buildFastaUrl(accession: string, start: number, end: number, sequenceLength?: number): string {
  const { paddedStart, paddedEnd } = computePaddedRange(start, end, sequenceLength);
  const params = new URLSearchParams({
    accession,
    start: String(paddedStart),
    end: String(paddedEnd),
  });
  return `/api/v1/sequence/igv/fasta?${params.toString()}`;
}

/**
 * Build locus for IGV.js with indexed:false.
 * Because the FASTA is fetched as a fixed window (paddedStart..paddedEnd),
 * IGV treats it as starting at position 1.  The gene region within that
 * window is therefore offset-1 = (geneStart - paddedStart + 1).
 */
function buildRelativeLocus(
  accession: string,
  start: number,
  end: number,
  sequenceLength?: number
): string {
  const { paddedStart, paddedEnd } = computePaddedRange(start, end, sequenceLength);
  // Relative coordinates inside the fetched window
  const relStart = Math.max(1, start - paddedStart + 1);
  const relEnd = Math.min(end - paddedStart + 1, paddedEnd - paddedStart + 1);
  return `${accession}:${relStart}-${Math.max(relStart + 1, relEnd)}`;
}

function formatBp(bp: number): string {
  if (bp >= 1_000_000) return `${(bp / 1_000_000).toFixed(2)} Mb`;
  if (bp >= 1_000) return `${(bp / 1_000).toFixed(1)} kb`;
  return `${bp} bp`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BrowserSkeleton({ stage }: { stage: LoadingStage }) {
  const { t } = useLanguage();
  const stageInfo = stage < 3 ? LOADING_STAGES[stage as 0 | 1 | 2] : undefined;
  const stageLabel = stageInfo
    ? t(`browser.${stageInfo.key}`)
    : t("browser.stageRendering");
  const progress = stageInfo ? stageInfo.progress : 100;

  return (
    <div className="flex flex-col gap-4 py-6 px-4 animate-fadeIn">
      {/* Progress bar */}
      <div className="relative">
        <div className="h-1 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className="igv-progress-bar"
            style={{ "--igv-progress": `${progress}%` } as React.CSSProperties}
          />
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {stageLabel}
          </span>
        </div>
      </div>

      {/* Skeleton tracks mimicking IGV layout */}
      <div className="rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-800/50 overflow-hidden">
        {/* Fake navbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
          <div className="h-6 w-16 rounded-md bg-slate-200/80 dark:bg-slate-700/80" style={{ animation: "igvSkeletonPulse 1.5s ease infinite" }} />
          <div className="h-6 w-32 rounded-md bg-slate-200/80 dark:bg-slate-700/80" style={{ animation: "igvSkeletonPulse 1.5s ease infinite 150ms" }} />
          <div className="flex-1" />
          <div className="h-6 w-8 rounded-md bg-slate-200/80 dark:bg-slate-700/80" style={{ animation: "igvSkeletonPulse 1.5s ease infinite 300ms" }} />
          <div className="h-6 w-8 rounded-md bg-slate-200/80 dark:bg-slate-700/80" style={{ animation: "igvSkeletonPulse 1.5s ease infinite 400ms" }} />
        </div>
        {/* Fake ruler */}
        <div className="px-3 py-2">
          <div className="igv-skeleton-ruler w-full" />
        </div>
        {/* Fake sequence track */}
        <div className="px-3 py-1">
          <div className="igv-skeleton-track w-full" />
        </div>
        {/* Fake annotation track */}
        <div className="px-3 py-2 space-y-1.5">
          <div className="igv-skeleton-track w-3/4" style={{ animationDelay: "200ms" }} />
          <div className="igv-skeleton-track w-5/6" style={{ animationDelay: "350ms", height: "32px" }} />
          <div className="igv-skeleton-track w-2/3" style={{ animationDelay: "500ms" }} />
        </div>
      </div>
    </div>
  );
}

function UnsupportedPlaceholder({ gene }: { gene: GeneDetail }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 py-10 px-6 text-center">
      <Globe className="h-8 w-8 text-slate-300 dark:text-slate-600" />
      <div>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {t("browser.unavailable")}
        </p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400 dark:text-slate-500">
          {t("browser.unavailableSub")}
        </p>
        {gene.ncbi_url && (
          <a
            href={gene.ncbi_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            {t("browser.viewOnNcbi")}
            <Globe className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function BrowserError({ message, onRetry, gene }: { message: string; onRetry: () => void; gene?: GeneDetail }) {
  const { t } = useLanguage();
  const isRateLimit = /rate.?limit|429|abuse|misuse|temporarily blocking/i.test(message);
  const ncbiUrl = gene?.ncbi_url || (gene?.gene_id ? `https://www.ncbi.nlm.nih.gov/gene/${gene.gene_id}` : undefined);

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-5 py-4 ${
      isRateLimit
        ? "border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300"
        : "border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300"
    }`}>
      <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${isRateLimit ? "text-amber-500" : "text-red-500"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">
          {isRateLimit ? t("browser.rateLimit") : t("browser.error")}
        </p>
        {isRateLimit ? (
          <>
            <p className="mt-1 text-xs leading-5">
              {t("browser.rateLimitSub")}
            </p>
            {ncbiUrl && (
              <a
                href={ncbiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                <Globe className="h-3 w-3" />
                {t("browser.viewOnNcbi")}
              </a>
            )}
          </>
        ) : (
          <p className="mt-1 text-xs leading-5 break-words">{message}</p>
        )}
        <button
          onClick={onRetry}
          className={`mt-3 inline-flex items-center gap-1.5 rounded-md border bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium transition ${
            isRateLimit
              ? "border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-slate-700"
              : "border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-slate-700"
          }`}
        >
          <RotateCcw className="h-3 w-3" />
          {t("browser.tryAgain")}
        </button>
      </div>
    </div>
  );
}

function installIgvNetworkInterceptors() {
  if (typeof window === "undefined" || (window as any).__igv_interceptor_installed) return;
  (window as any).__igv_interceptor_installed = true;

  // 1. Intercept window.fetch for igv.org endpoints
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (urlStr.includes("igv.org/data/url_mappings.tsv")) {
      return new Response("# empty url mappings\n", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    if (urlStr.includes("igv.org/genomes/")) {
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };

  // 2. Intercept XMLHttpRequest for igv.org endpoints (used by IGV's internal igvxhr)
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (this: any, method: string, url: string | URL, ...rest: any[]) {
    this.__targetUrl = String(url);
    return originalOpen.apply(this, [method, url, ...rest] as any);
  };

  XMLHttpRequest.prototype.send = function (this: any, body?: Document | XMLHttpRequestBodyInit | null) {
    const url = this.__targetUrl || "";
    if (url.includes("igv.org/data/url_mappings.tsv") || url.includes("igv.org/genomes/")) {
      const isJson = url.includes("genomes");
      const fakeData = isJson ? "[]" : "# empty url mappings\n";

      Object.defineProperty(this, "status", { value: 200, configurable: true, writable: true });
      Object.defineProperty(this, "statusText", { value: "OK", configurable: true, writable: true });
      Object.defineProperty(this, "readyState", { value: 4, configurable: true, writable: true });
      Object.defineProperty(this, "responseText", { value: fakeData, configurable: true, writable: true });
      Object.defineProperty(this, "response", { value: fakeData, configurable: true, writable: true });

      setTimeout(() => {
        if (typeof this.onreadystatechange === "function") {
          this.onreadystatechange(new Event("readystatechange"));
        }
        if (typeof this.onload === "function") {
          this.onload(new ProgressEvent("load"));
        }
        this.dispatchEvent(new Event("readystatechange"));
        this.dispatchEvent(new ProgressEvent("load"));
      }, 0);
      return;
    }
    return originalSend.apply(this, [body]);
  };
}

async function loadIgvCreateBrowser(): Promise<(container: HTMLElement, options: any) => Promise<any>> {
  installIgvNetworkInterceptors();
  if (typeof window !== "undefined" && (window as any).igv?.createBrowser) {
    return (window as any).igv.createBrowser;
  }

  try {
    const mod = await import("igv");
    const fn =
      (mod as any)?.createBrowser ||
      (mod as any)?.default?.createBrowser ||
      (mod as any)?.default?.default?.createBrowser ||
      (typeof (mod as any)?.default === "function" ? (mod as any).default : null);
    if (typeof fn === "function") return fn;
  } catch (e) {
    console.warn("NPM module import of 'igv' failed, falling back to CDN script:", e);
  }

  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Browser window is unavailable"));
    if ((window as any).igv?.createBrowser) return resolve((window as any).igv.createBrowser);

    const existingScript = document.getElementById("igv-cdn-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if ((window as any).igv?.createBrowser) resolve((window as any).igv.createBrowser);
        else reject(new Error("IGV script loaded but createBrowser is missing"));
      });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load IGV CDN script")));
      return;
    }

    const script = document.createElement("script");
    script.id = "igv-cdn-script";
    script.src = "https://cdn.jsdelivr.net/npm/igv@3.8.5/dist/igv.min.js";
    script.async = true;
    script.onload = () => {
      if ((window as any).igv?.createBrowser) {
        resolve((window as any).igv.createBrowser);
      } else {
        reject(new Error("IGV script loaded from CDN but createBrowser was not found"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load IGV.js from CDN script. Please check network connection."));
    document.head.appendChild(script);
  });
}

// ── Toolbar Component ─────────────────────────────────────────────────────────

function BrowserToolbar({
  browserRef,
  isFullscreen,
  onToggleFullscreen,
  tracksVisible,
  onToggleTracks,
  accession,
  start,
  end,
  chromosome,
}: {
  browserRef: React.RefObject<any>;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  tracksVisible: boolean;
  onToggleTracks: () => void;
  accession: string;
  start: number;
  end: number;
  chromosome: string;
}) {
  const { t } = useLanguage();
  const [locusInput, setLocusInput] = useState("");
  const [showLocusInput, setShowLocusInput] = useState(false);

  const handleZoomIn = useCallback(() => {
    browserRef.current?.zoomIn?.();
  }, [browserRef]);

  const handleZoomOut = useCallback(() => {
    browserRef.current?.zoomOut?.();
  }, [browserRef]);

  const handleJumpToLocus = useCallback(() => {
    if (!locusInput.trim() || !browserRef.current) return;
    const locus = locusInput.includes(":") ? locusInput : `${accession}:${locusInput}`;
    browserRef.current.search?.(locus)?.catch?.(() => {});
    setShowLocusInput(false);
    setLocusInput("");
  }, [locusInput, browserRef, accession]);

  // Build NCBI Sequence Viewer URL
  const ncbiUrl = `https://www.ncbi.nlm.nih.gov/nuccore/${accession}?report=graph&from=${start}&to=${end}`;
  // Build UCSC Genome Browser URL
  const chrLabel = chromosome?.startsWith("chr") ? chromosome : `chr${chromosome || "1"}`;
  const ucscUrl = `https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=${chrLabel}:${start}-${end}`;

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-2">
      {/* Zoom controls */}
      <div className="flex items-center rounded-lg border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
        <button
          onClick={handleZoomIn}
          className="igv-toolbar-btn rounded-none border-0"
          title={t("browser.zoomIn")}
        >
          <Plus />
        </button>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
        <button
          onClick={handleZoomOut}
          className="igv-toolbar-btn rounded-none border-0"
          title={t("browser.zoomOut")}
        >
          <Minus />
        </button>
      </div>

      {/* Jump to locus */}
      {showLocusInput ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={locusInput}
            onChange={(e) => setLocusInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJumpToLocus()}
            placeholder={t("browser.jumpPlaceholder")}
            className="h-7 w-40 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition"
            autoFocus
          />
          <button onClick={handleJumpToLocus} className="igv-toolbar-btn">
            <MapPin />
          </button>
          <button onClick={() => { setShowLocusInput(false); setLocusInput(""); }} className="igv-toolbar-btn">
            ✕
          </button>
        </div>
      ) : (
        <button onClick={() => setShowLocusInput(true)} className="igv-toolbar-btn">
          <MapPin />
          <span className="hidden sm:inline">{t("browser.jumpToLocus")}</span>
        </button>
      )}

      {/* Toggle tracks */}
      <button onClick={onToggleTracks} className={`igv-toolbar-btn ${!tracksVisible ? "active" : ""}`}>
        {tracksVisible ? <Eye /> : <EyeOff />}
        <span className="hidden sm:inline">{t("browser.toggleTracks")}</span>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* External links */}
      <a href={ncbiUrl} target="_blank" rel="noopener noreferrer" className="igv-toolbar-btn">
        <Globe />
        <span className="hidden sm:inline">{t("browser.openInNcbi")}</span>
      </a>
      <a href={ucscUrl} target="_blank" rel="noopener noreferrer" className="igv-toolbar-btn">
        <ExternalLink />
        <span className="hidden sm:inline">{t("browser.openInUcsc")}</span>
      </a>

      {/* Fullscreen */}
      <button onClick={onToggleFullscreen} className="igv-toolbar-btn">
        {isFullscreen ? <Minimize2 /> : <Maximize2 />}
        <span className="hidden sm:inline">{isFullscreen ? t("browser.exitFullscreen") : t("browser.fullscreen")}</span>
      </button>
    </div>
  );
}

// ── Status Bar Component ──────────────────────────────────────────────────────

function BrowserStatusBar({
  accession,
  chromosome,
  start,
  end,
  gene,
}: {
  accession: string;
  chromosome: string;
  start: number;
  end: number;
  gene: GeneDetail;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const chrLabel = chromosome?.startsWith("chr") ? chromosome : `chr${chromosome || "?"}`;
  const locusStr = `${chrLabel}:${start.toLocaleString()}–${end.toLocaleString()}`;
  const length = end - start + 1;
  const strand = gene.strand === "-" || gene.strand === -1 ? "−" : "+";

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${accession} ${chrLabel}:${start}-${end}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, [accession, chrLabel, start, end]);

  return (
    <div className="igv-status-bar">
      {/* Accession */}
      <span className="igv-status-item" title={t("browser.accession")}>
        <Dna className="h-3 w-3 text-cyan-500" />
        {accession}
      </span>

      <span className="igv-status-divider" />

      {/* Coordinates */}
      <span className="igv-status-item" title={t("browser.coordinates")}>
        <MapPin className="h-3 w-3 text-indigo-500" />
        {locusStr}
      </span>

      <span className="igv-status-divider" />

      {/* Length */}
      <span className="igv-status-item" title={t("browser.sequenceLength")}>
        {formatBp(length)}
      </span>

      {/* Strand */}
      <span className="igv-status-item" title={t("browser.strand")}>
        {strand} {t("browser.strand").toLowerCase()}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Copy coordinates */}
      <button
        onClick={handleCopy}
        className="igv-toolbar-btn text-[10px] py-0.5 px-1.5"
        title={t("browser.copyLocus")}
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400">{t("browser.copiedLocus")}</span>
          </>
        ) : (
          <>
            <Clipboard className="h-3 w-3" />
            <span className="hidden sm:inline">{t("browser.copyLocus")}</span>
          </>
        )}
      </button>
    </div>
  );
}

// ── Protein Structure Card ────────────────────────────────────────────────────

function ProteinStructureCard({ gene }: { gene: GeneDetail }) {
  const { t } = useLanguage();
  const uniprotId =
    gene.protein?.uniprot_id ||
    (gene.source === "uniprot" ? String(gene.gene_id) : undefined) ||
    (/^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$/i.test(String(gene.gene_id)) ? String(gene.gene_id) : undefined) ||
    (/^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$/i.test(String(gene.symbol)) ? String(gene.symbol) : undefined);

  const seq = (gene.protein?.sequence || gene.sequence || "").replace(/[^A-Za-z]/g, "").toUpperCase();
  const length = gene.sequence_length || gene.protein?.length || seq.length;

  return (
    <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
            <Box className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("detail.proteinStructure")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("detail.proteinStructureDesc")}
            </p>
          </div>
        </div>
        {uniprotId && (
          <span className="rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-300">
            UniProt: {uniprotId}
          </span>
        )}
      </div>

      {/* Action cards to AlphaFold, UniProtKB, PDB */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <a
          href={uniprotId ? `https://alphafold.ebi.ac.uk/entry/${uniprotId}` : `https://alphafold.ebi.ac.uk/search/text/${encodeURIComponent(gene.symbol || gene.name || "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-cyan-500/5 via-slate-50 dark:via-slate-800/40 to-transparent p-4 transition hover:-translate-y-0.5 hover:border-cyan-500 hover:shadow-md"
        >
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-cyan-600 dark:text-cyan-400">
              <span>AlphaFold DB</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 transition" />
            </div>
            <h4 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("detail.alphaFoldViewer")}
            </h4>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              DeepMind AI 3D coordinates with atomic pLDDT confidence scores.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
            Open 3D Viewer →
          </span>
        </a>

        <a
          href={uniprotId ? `https://www.uniprot.org/uniprotkb/${uniprotId}/entry` : `https://www.uniprot.org/uniprotkb?query=${encodeURIComponent(gene.symbol || gene.name || "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-indigo-500/5 via-slate-50 dark:via-slate-800/40 to-transparent p-4 transition hover:-translate-y-0.5 hover:border-indigo-500 hover:shadow-md"
        >
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
              <span>UniProtKB</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 transition" />
            </div>
            <h4 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("detail.uniProtEntry")}
            </h4>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Curated functional domains, catalytic sites, isoforms & variants.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
            Inspect Entry →
          </span>
        </a>

        <a
          href={`https://www.rcsb.org/search?request=%7B%22query%22%3A%7B%22type%22%3A%22terminal%22%2C%22service%22%3A%22text%22%2C%22parameters%22%3A%7B%22value%22%3A%22${encodeURIComponent(uniprotId || gene.symbol || "")}%22%7D%7D%7D`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-emerald-500/5 via-slate-50 dark:via-slate-800/40 to-transparent p-4 transition hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md"
        >
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>RCSB PDB</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 transition" />
            </div>
            <h4 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("detail.pdbSearch")}
            </h4>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Experimentally resolved X-ray, NMR and Cryo-EM crystal structures.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            Explore PDB →
          </span>
        </a>
      </div>

      {/* Sequence architecture track */}
      {length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Sequence Architecture Track</span>
            <span className="font-mono">1 – {length.toLocaleString()} aa</span>
          </div>
          <div className="relative h-6 w-full rounded-md bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
            <div className="h-full bg-cyan-500/80 hover:bg-cyan-400 transition" style={{ width: "100%" }} title={`${length} residues`} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>N-terminus</span>
            <span>C-terminus</span>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function GenomeBrowser({ gene }: GenomeBrowserProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const browserInstanceRef = useRef<any>(null);
  const [status, setStatus] = useState<BrowserStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [retryKey, setRetryKey] = useState(0);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tracksVisible, setTracksVisible] = useState(true);

  const dataType = String(gene.data_type || gene.sequence_type || "").toLowerCase();
  const source = String(gene.source || gene.database || "").toLowerCase();
  const rawSeq = (gene.sequence || gene.protein?.sequence || "").replace(/[^A-Za-z]/g, "").toUpperCase();
  const isProtein =
    dataType.includes("protein") ||
    source.includes("uniprot") ||
    Boolean(gene.protein?.uniprot_id) ||
    Boolean(rawSeq && !/^[ACGTUN]+$/.test(rawSeq));

  // Resolve accession: prefer genomic_accession (NC_/NW_/NZ_ etc.), then
  // fall back to gene_id or symbol if they look like real sequence accessions.
  const looksLikeAccession = (value?: string | number) =>
    Boolean(value && VALID_ACCESSION_RE.test(String(value)));

  const accession =
    gene.genomic_accession ||
    (looksLikeAccession(gene.gene_id) ? String(gene.gene_id) : undefined) ||
    (looksLikeAccession(gene.symbol) ? gene.symbol : undefined);

  const start = gene.start ?? 1;
  const end = gene.end ?? (gene.sequence_length ? gene.sequence_length : 50_000);
  const chromosome = gene.chromosome || "1";

  // Guard: require a valid accession string
  const isSupported = Boolean(accession && VALID_ACCESSION_RE.test(accession));

  // Toggle tracks visibility
  const handleToggleTracks = useCallback(() => {
    const browser = browserInstanceRef.current;
    if (!browser) return;
    const container = containerRef.current;
    if (!container) return;

    // Toggle track containers visibility
    const trackDivs = container.querySelectorAll(".igv-track-container");
    trackDivs.forEach((el: Element) => {
      (el as HTMLElement).style.display = tracksVisible ? "none" : "";
    });
    setTracksVisible(!tracksVisible);
  }, [tracksVisible]);

  // Fullscreen toggle
  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Escape key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  useEffect(() => {
    if (isProtein || !isSupported) return;
    if (!containerRef.current) return;

    const container = containerRef.current;
    let browser: { removeAllTracks(): void; dispose?(): void; zoomIn?(): void; zoomOut?(): void; search?(locus: string): Promise<void> } | null = null;
    let cancelled = false;

    setStatus("loading");
    setErrorMsg("");
    setLoadingStage(0);

    (async () => {
      try {
        setLoadingStage(0); // Loading IGV.js
        const createBrowserFn = await loadIgvCreateBrowser();

        if (cancelled) return;
        setLoadingStage(1); // Fetching sequence

        const seqLen = gene.sequence_length || gene.sequence?.length;
        const { paddedStart, paddedEnd } = computePaddedRange(start, end, seqLen);
        const fastaURL = buildFastaUrl(accession!, start, end, seqLen);
        const locusStr = buildRelativeLocus(accession!, start, end, seqLen);

        // Build a gene annotation track to highlight the gene region
        const geneRelStart = Math.max(1, start - paddedStart + 1);
        const geneRelEnd = Math.min(end - paddedStart + 1, paddedEnd - paddedStart + 1);
        const annotationTrack = {
          name: `${gene.symbol || 'Gene'} Region`,
          type: 'annotation',
          format: 'bed',
          features: [{
            chr: accession!,
            start: geneRelStart,
            end: Math.max(geneRelStart + 1, geneRelEnd),
            name: gene.symbol || accession!,
            score: 0,
            strand: gene.strand === '-' || gene.strand === -1 ? '-' : '+',
          }],
          displayMode: 'EXPANDED',
          color: '#06b6d4',
          height: 40,
        };

        setLoadingStage(2); // Rendering

        browser = await createBrowserFn(container, {
          loadDefaultGenomes: false,
          genomeList: [],
          reference: {
            id: accession!,
            name: `${accession} (${gene.symbol || "Sequence"})`,
            fastaURL,
            indexed: false,
          },
          locus: locusStr,
          showIdeogram: false,
          showNavigation: true,
          showRuler: true,
          showCenterGuide: true,
          showCursorTrackingGuide: true,
          tracks: [annotationTrack],
        });

        if (!cancelled) {
          browserInstanceRef.current = browser;
          setLoadingStage(3);
          setStatus("ready");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            err instanceof Error
              ? err.message
              : "Unknown error initialising IGV browser.";
          setStatus("error");
          setErrorMsg(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
      browserInstanceRef.current = null;
      try {
        if (browser?.dispose) {
          browser.dispose();
        } else {
          // Fallback: clear the container manually to free IGV event listeners
          container.innerHTML = "";
        }
      } catch {
        // Silently ignore teardown errors
      }
    };
  }, [isSupported, accession, start, end, chromosome, retryKey]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isProtein) {
    return <ProteinStructureCard gene={gene} />;
  }

  if (!isSupported) {
    return (
      <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <SectionHeader />
        <div className="mt-4">
          <UnsupportedPlaceholder gene={gene} />
        </div>
      </section>
    );
  }

  const browserContent = (
    <>
      <SectionHeader>
        {status === "ready" && (
          <div className="flex items-center gap-2">
            {gene.genome_assembly && (
              <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                {ASSEMBLY_LABELS[gene.genome_assembly] || gene.genome_assembly}
              </span>
            )}
            <LocusBadge chromosome={chromosome} start={start} end={end} accession={accession!} />
          </div>
        )}
      </SectionHeader>

      {status === "error" && (
        <div className="mt-4">
          <BrowserError
            message={errorMsg}
            gene={gene}
            onRetry={() => {
              setStatus("idle");
              setRetryKey((k) => k + 1);
            }}
          />
        </div>
      )}

      {(status === "loading" || status === "idle") && (
        <div className="mt-4">
          <BrowserSkeleton stage={loadingStage} />
        </div>
      )}

      {/* Toolbar — only visible when IGV is ready */}
      {status === "ready" && (
        <BrowserToolbar
          browserRef={browserInstanceRef}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          tracksVisible={tracksVisible}
          onToggleTracks={handleToggleTracks}
          accession={accession!}
          start={start}
          end={end}
          chromosome={chromosome}
        />
      )}

      {/* IGV.js mounts here — container needs light background */}
      <div className={`igv-browser-wrapper ${status === "ready" ? "igv-glow" : ""}`}>
        <div
          ref={containerRef}
          id="igv-browser-container"
          className="rounded-lg bg-white text-slate-900 border border-slate-200 dark:border-slate-700 shadow-inner overflow-hidden"
          style={{ minHeight: "480px", display: status === "ready" ? "block" : "none" }}
        />
      </div>

      {/* Status bar — visible when ready */}
      {status === "ready" && (
        <BrowserStatusBar
          accession={accession!}
          chromosome={chromosome}
          start={start}
          end={end}
          gene={gene}
        />
      )}
    </>
  );

  // Fullscreen overlay
  if (isFullscreen) {
    return (
      <>
        {/* Placeholder to maintain layout */}
        <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <SectionHeader />
          <div className="flex items-center justify-center py-12 text-sm text-slate-400 dark:text-slate-500">
            <Maximize2 className="h-4 w-4 mr-2" />
            Genome Browser is in fullscreen mode
          </div>
        </section>
        {/* Fullscreen overlay */}
        <div className="igv-fullscreen-overlay">
          <div className="max-w-[1600px] w-full mx-auto flex-1 flex flex-col">
            {browserContent}
          </div>
        </div>
      </>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
      {browserContent}
    </section>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children?: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <Dna className="h-4 w-4 text-cyan-500" />
        {t("browser.title")}
      </h3>
      {children}
    </div>
  );
}

function LocusBadge({
  chromosome,
  start,
  end,
  accession,
}: {
  chromosome?: string;
  start: number;
  end: number;
  accession: string;
}) {
  const chr = chromosome
    ? chromosome.startsWith("chr")
      ? chromosome
      : `chr${chromosome}`
    : "chr?";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 px-3 py-1 text-[11px] font-mono text-cyan-700 dark:text-cyan-300">
      <MapPin className="h-3 w-3" />
      {chr}:{start.toLocaleString()}–{end.toLocaleString()} · {accession}
    </span>
  );
}
