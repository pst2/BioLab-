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

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Dna, Globe, Loader2, MapPin } from "lucide-react";
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
 * Must look like a real RefSeq or INSDC accession (e.g. NC_000005.10, NM_007294, CM000667.2).
 * A plain numeric gene ID (e.g. "672") is NOT a valid FASTA accession for IGV.
 * The underscore or dot requirement filters out bare numbers and symbol-only strings.
 */
const VALID_ACCESSION_RE = /^[A-Za-z]{1,6}[_\.][A-Za-z0-9_.]+$/;

// ── Types ─────────────────────────────────────────────────────────────────────

type BrowserStatus = "idle" | "loading" | "ready" | "error";

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

// ── Sub-components ────────────────────────────────────────────────────────────

function BrowserSkeleton() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400 dark:text-slate-500">
      <Loader2 className="h-7 w-7 animate-spin text-cyan-500" />
      <p className="text-sm font-medium">{t("browser.loading")}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {t("browser.loadingSub")}
      </p>
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
          {t("browser.tryAgain")}
        </button>
      </div>
    </div>
  );
}

async function loadIgvCreateBrowser(): Promise<(container: HTMLElement, options: any) => Promise<any>> {
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

// ── Main Component ────────────────────────────────────────────────────────────

export function GenomeBrowser({ gene }: GenomeBrowserProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<BrowserStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [retryKey, setRetryKey] = useState(0);

  // Resolve accession: prefer genomic_accession (NC_/NW_/NZ_ etc.), then
  // fall back to symbol or gene_id ONLY if they look like real accessions
  // (contain '_' or '.' e.g. NM_007294, NM_007294.3, CM000667.2).
  // Plain numeric gene IDs ("672") and short gene symbols ("BRCA1") are NOT
  // valid FASTA accessions for IGV and will cause a fetch error.
  const looksLikeAccession = (value?: string | number) =>
    Boolean(value && /[_.]/.test(String(value)));

  const accession =
    gene.genomic_accession ||
    (looksLikeAccession(gene.symbol) ? gene.symbol : undefined) ||
    (looksLikeAccession(gene.gene_id) ? String(gene.gene_id) : undefined);

  const start = gene.start ?? 1;
  const end = gene.end ?? (gene.sequence_length ? gene.sequence_length : 50_000);
  const chromosome = gene.chromosome || "1";

  // Guard: require a valid accession string
  const isSupported = Boolean(accession && VALID_ACCESSION_RE.test(accession));

  useEffect(() => {
    if (!isSupported) return;
    if (!containerRef.current) return;

    const container = containerRef.current;
    let browser: { removeAllTracks(): void; dispose?(): void } | null = null;
    let cancelled = false;

    setStatus("loading");
    setErrorMsg("");

    (async () => {
      try {
        const createBrowserFn = await loadIgvCreateBrowser();

        if (cancelled) return;

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

        browser = await createBrowserFn(container, {
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

        if (!cancelled) setStatus("ready");
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

  return (
    <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
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
          <BrowserSkeleton />
        </div>
      )}

      {/* IGV.js mounts here — container needs light background and explicit min-height */}
      <div
        ref={containerRef}
        id="igv-browser-container"
        className="mt-4 rounded-lg bg-white text-slate-900 p-2 border border-slate-200 dark:border-slate-700 shadow-inner overflow-hidden"
        style={{ minHeight: "480px", display: status === "ready" ? "block" : "none" }}
      />
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
