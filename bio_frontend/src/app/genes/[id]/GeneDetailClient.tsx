"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Copy,
  Database,
  Dna,
  Download,
  ExternalLink,
  FileText,
  Fingerprint,
  Globe,
  Info,
  Loader2,
  Microscope,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { api, GeneDetail, GeneProteinInfo, GeneTranscript, ApiError } from "@/lib/api";
import { LanguageToggle, ThemeToggle, useLanguage } from "@/lib/i18n";
import { useToast } from "@/lib/Toast";
import { GenomeBrowser } from "./GenomeBrowser";

const GENE_CACHE_PREFIX = "biolab:gene:";

type CountMap = Record<string, number>;
type DetailTab = "overview" | "sequence" | "visualization" | "metadata";

function normalizeGene(id: string, gene: Partial<GeneDetail>): GeneDetail {
  const geneId = String(gene.gene_id ?? gene.external_id ?? gene.id ?? id);
  const visualization = gene.visualization || {};
  const location = visualization.location || {};
  const composition = visualization.sequence_composition || {};
  return {
    ...gene,
    gene_id: geneId,
    symbol: gene.symbol || gene.name || `Gene ${geneId}`,
    name: gene.name,
    description: gene.description || gene.summary || "No description available.",
    organism: gene.organism || "Unknown",
    summary: gene.summary || gene.description || "No summary available.",
    chromosome: gene.chromosome || location.chromosome || "Unknown",
    start: gene.start ?? location.start,
    end: gene.end ?? location.end,
    strand: gene.strand ?? location.strand,
    assembly: gene.assembly || location.assembly,
    // genomic_accession may live at top-level (freshly fetched) or inside
    // visualization.location (older records enriched by build_gene_visualization)
    genomic_accession:
      gene.genomic_accession ||
      (location as Record<string, unknown>).genomic_accession as string | undefined,
    aliases: Array.isArray(gene.aliases) ? gene.aliases : [],
    sequence: gene.sequence,
    sequence_type: gene.sequence_type,
    sequence_length: gene.sequence_length ?? composition.sequence_length,
    fasta: gene.fasta,
    base_counts: gene.base_counts || composition.base_counts,
    gc_content: gene.gc_content ?? composition.gc_content,
    at_content: gene.at_content ?? composition.at_content,
    transcripts: gene.transcripts || visualization.transcripts || [],
    protein: gene.protein || visualization.protein || null,
    visualization,
    ncbi_url: gene.ncbi_url || (String(gene.source).toLowerCase() === "ncbi" ? `https://www.ncbi.nlm.nih.gov/gene/${geneId}` : undefined),
    source_url: gene.source_url,
    provider_url: gene.provider_url,
    source: gene.source,
    last_synced_at: gene.last_synced_at,
    raw: gene.raw,
  };
}

function readCachedGene(id: string): GeneDetail | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = window.sessionStorage.getItem(`${GENE_CACHE_PREFIX}${id}`);
    if (!cached) return null;
    return normalizeGene(id, JSON.parse(cached) as Partial<GeneDetail>);
  } catch {
    return null;
  }
}

function writeCachedGene(id: string, gene: GeneDetail) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${GENE_CACHE_PREFIX}${id}`, JSON.stringify(gene));
  } catch {}
}

function sourceLabel(source: string | undefined, database: string | undefined, t: (key: string) => string) {
  const value = String(source || database || "unknown").toLowerCase();
  if (value === "ncbi") return t("detail.ncbiGeneId");
  if (value === "ensembl") return t("detail.ensemblGeneId");
  if (value === "uniprot" || database === "uniprotkb") return t("detail.uniprotAccession");
  if (value === "bvbrc") return t("detail.bvbrcFeatureId");
  if (value === "local_db") return t("detail.localGeneId");
  return t("detail.sourceId");
}

function sourceButton(gene: GeneDetail, geneId: string) {
  const source = String(gene.source || gene.database || "").toLowerCase();
  if (source === "ensembl") return { provider: "Ensembl", href: gene.source_url || gene.provider_url || `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${geneId}` };
  if (source === "uniprot" || gene.database === "uniprotkb") return { provider: "UniProt", href: gene.source_url || gene.provider_url || `https://www.uniprot.org/uniprotkb/${geneId}/entry` };
  if (source === "bvbrc") return { provider: "BV-BRC", href: gene.source_url || gene.provider_url || "https://www.bv-brc.org/" };
  return { provider: "NCBI", href: gene.ncbi_url || gene.source_url || `https://www.ncbi.nlm.nih.gov/gene/${geneId}` };
}

function formatNumber(value?: number | string | null, fallback = "Unknown") {
  if (value === null || value === undefined || value === "") return fallback;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toLocaleString() : String(value);
}

function percent(value?: number | null, fallback = "N/A") {
  if (value === undefined || value === null || Number.isNaN(value)) return fallback;
  return `${Number(value).toFixed(1)}%`;
}

function hasSequenceStats(gene: GeneDetail): boolean {
  const counts = gene.base_counts || gene.visualization?.sequence_composition?.base_counts;
  const hasCounts = counts && Object.values(counts).some((v) => Number(v) > 0);
  const hasGcAt = Boolean(gene.gc_content || gene.at_content);
  return Boolean(hasCounts || hasGcAt);
}

function truncateSequence(sequence?: string, max = 7000, truncatedLabel?: string) {
  if (!sequence) return "";
  const message = truncatedLabel || `... truncated in UI (${sequence.length.toLocaleString()} characters total)`;
  return sequence.length > max ? `${sequence.slice(0, max)}\n${message}` : sequence;
}

function copyToClipboard(value?: string) {
  if (!value || typeof navigator === "undefined") return;
  navigator.clipboard?.writeText(value).catch(() => undefined);
}

function countWidth(counts: CountMap | undefined, base: string) {
  const total = Object.values(counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (!total) return 0;
  return Math.max(3, (Number(counts?.[base] || 0) / total) * 100);
}

function basePercent(counts: CountMap | undefined, base: string) {
  const total = Object.values(counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (!total) return "0.0%";
  return `${((Number(counts?.[base] || 0) / total) * 100).toFixed(1)}%`;
}

function sequenceLength(gene: GeneDetail) {
  return Number(gene.sequence_length || gene.sequence?.length || gene.protein?.length || 0);
}

function geneRangeLength(gene: GeneDetail) {
  const start = Number(gene.start || 0);
  const end = Number(gene.end || 0);
  if (!start || !end || end < start) return sequenceLength(gene);
  return end - start + 1;
}

type DetailRecordKind = "gene" | "nucleotide" | "protein";

function cleanSequence(value?: string) {
  if (!value) return "";
  return value
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(">"))
    .join("")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

function getRecordKind(gene: GeneDetail): DetailRecordKind {
  const dataType = String(gene.data_type || gene.sequence_type || "").toLowerCase();
  const source = String(gene.source || gene.database || "").toLowerCase();
  if (dataType.includes("protein") || source.includes("uniprot")) return "protein";
  if (dataType.includes("nucleotide") || dataType.includes("dna") || dataType.includes("rna")) return "nucleotide";
  const sequence = cleanSequence(gene.sequence || gene.fasta);
  if (sequence && /^[ACGTUN]+$/.test(sequence)) return "nucleotide";
  if (gene.protein?.sequence || gene.protein?.fasta || gene.protein?.uniprot_id) return "protein";
  return "gene";
}

function getPrimarySequence(gene: GeneDetail, kind: DetailRecordKind) {
  if (kind === "protein") return cleanSequence(gene.protein?.sequence || gene.protein?.fasta || gene.sequence || gene.fasta);
  return cleanSequence(gene.sequence || gene.fasta);
}

function countLetters(sequence: string) {
  return sequence.split("").reduce<CountMap>((counts, char) => {
    counts[char] = Number(counts[char] || 0) + 1;
    return counts;
  }, {});
}

const AMINO_ACIDS = [
  ["A", "Alanine"],
  ["R", "Arginine"],
  ["N", "Asparagine"],
  ["D", "Aspartic acid"],
  ["C", "Cysteine"],
  ["Q", "Glutamine"],
  ["E", "Glutamic acid"],
  ["G", "Glycine"],
  ["H", "Histidine"],
  ["I", "Isoleucine"],
  ["L", "Leucine"],
  ["K", "Lysine"],
  ["M", "Methionine"],
  ["F", "Phenylalanine"],
  ["P", "Proline"],
  ["S", "Serine"],
  ["T", "Threonine"],
  ["W", "Tryptophan"],
  ["Y", "Tyrosine"],
  ["V", "Valine"],
] as const;

const AMINO_ACID_WEIGHTS: Record<string, number> = {
  A: 89.09, R: 174.2, N: 132.12, D: 133.1, C: 121.16, Q: 146.15, E: 147.13, G: 75.07, H: 155.16, I: 131.17,
  L: 131.17, K: 146.19, M: 149.21, F: 165.19, P: 115.13, S: 105.09, T: 119.12, W: 204.23, Y: 181.19, V: 117.15,
};

function estimateMolecularWeight(sequence: string) {
  if (!sequence) return 0;
  const total = sequence.split("").reduce((sum, aa) => sum + Number(AMINO_ACID_WEIGHTS[aa] || 0), 0);
  const waterLoss = Math.max(sequence.length - 1, 0) * 18.015;
  return Math.max(total - waterLoss, 0) / 1000;
}

function reverseComplement(sequence: string) {
  const map: Record<string, string> = { A: "T", T: "A", U: "A", G: "C", C: "G", N: "N" };
  return sequence.split("").reverse().map((base) => map[base] || "N").join("");
}

function toRnaTranscript(sequence: string) {
  return sequence.replace(/T/g, "U");
}

export default function GeneDetailClient({ id }: { id: string }) {
  const [gene, setGene] = useState<GeneDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingBrowserCache, setUsingBrowserCache] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [wrapSequence, setWrapSequence] = useState(false);
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();
  const toast = useToast();

  const geneId = useMemo(() => String(gene?.gene_id ?? gene?.external_id ?? gene?.id ?? id), [gene, id]);
  const external = gene ? sourceButton(gene, geneId) : null;
  const recordKind = useMemo<DetailRecordKind>(() => (gene ? getRecordKind(gene) : "gene"), [gene]);

  const fetchGeneDetail = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const cached = readCachedGene(id);
    if (cached) {
      setGene(cached);
      setUsingBrowserCache(true);
    }
    try {
      const response = await api.geneDetail(id, { signal });
      const freshGene = normalizeGene(id, response.data || {});
      setGene(freshGene);
      setUsingBrowserCache(Boolean(response.meta?.cached));
      writeCachedGene(id, freshGene);
    } catch (event) {
      if (event instanceof DOMException && event.name === "AbortError") return;
      const message = event instanceof Error ? event.message : t("detail.loadFailed");
      setError(cached ? `${message} ${t("detail.showingCache")}` : message);
      if (!cached) {
        setGene(null);
        setUsingBrowserCache(false);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    const controller = new AbortController();
    fetchGeneDetail(controller.signal);
    return () => controller.abort();
  }, [fetchGeneDetail]);

  function handleCopy(value?: string, label = t("toast.copied")) {
    copyToClipboard(value);
    setCopied(true);
    toast.success(label);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased transition-colors duration-200 dna-pattern">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 px-4 py-4 backdrop-blur-md md:px-8" style={{ boxShadow: "0 1px 0 rgba(148,163,184,0.15)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700">
              <ArrowLeft className="h-4 w-4" /> {t("detail.back")}
            </Link>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500 sm:block">
              <span>{t("detail.breadcrumbSearch")}</span>
              <span className="text-slate-300 dark:text-slate-600">›</span>
              <span className="text-slate-900 dark:text-slate-100">{t("detail.breadcrumbDetail")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageToggle compact />
            <button onClick={() => fetchGeneDetail()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-cyan-500" /> : <RefreshCw className="h-4 w-4 text-cyan-500" />}
              {t("detail.refresh")}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {error && <Notice title={t("detail.providerWarning")} message={error} onRetry={() => fetchGeneDetail()} loading={loading} />}

        {loading && !gene && (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-10 text-center shadow-sm">
            <Dna className="h-12 w-12 animate-spin text-cyan-500" />
            <h2 className="mt-4 text-xl font-black text-slate-950 dark:text-slate-100">{t("detail.loadingTitle")}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("detail.loadingDesc")}</p>
          </div>
        )}

        {!loading && !gene && !error && <EmptyState />}

        {gene && (
          <div className="space-y-8 animate-fadeIn stagger-children">
            <GeneHero gene={gene} geneId={geneId} external={external} loading={loading} usingBrowserCache={usingBrowserCache} />

            <div className="tab-nav">
              {([
                ["overview", t("detail.overview")],
                ["sequence", t("detail.sequence")],
                ["visualization", t("detail.visualization")],
                ["metadata", t("detail.metadata")],
              ] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="tab-nav-item"
                  data-active={activeTab === tab}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              recordKind === "protein" ? (
                <ProteinDetailOverview gene={gene} external={external} />
              ) : (
                <NucleotideDetailOverview gene={gene} external={external} wrapSequence={wrapSequence} setWrapSequence={setWrapSequence} copied={copied} onCopy={handleCopy} />
              )
            )}

            {activeTab === "sequence" && (
              recordKind === "protein" ? (
                <div className="grid gap-6">
                  <SequencePanel gene={gene} kind={recordKind} wrapSequence={wrapSequence} setWrapSequence={setWrapSequence} copied={copied} onCopy={handleCopy} />
                  <ProteinSection protein={gene.protein || undefined} gene={gene} />
                </div>
              ) : (
                <div className="grid gap-6">
                  <SequencePanel gene={gene} kind={recordKind} wrapSequence={wrapSequence} setWrapSequence={setWrapSequence} copied={copied} onCopy={handleCopy} />
                  <NucleotideDerivedPanel gene={gene} />
                  <TranscriptSection transcripts={gene.transcripts || []} />
                </div>
              )
            )}

            {activeTab === "visualization" && (() => {
              const hasProteinData = Boolean(gene.protein?.sequence || gene.protein?.fasta || gene.protein?.uniprot_id || (cleanSequence(gene.sequence || gene.fasta) && !/^[ACGTUN]+$/.test(cleanSequence(gene.sequence || gene.fasta))));
              const hasNucleotideData = Boolean(cleanSequence(gene.sequence || gene.fasta) && /^[ACGTUN]+$/.test(cleanSequence(gene.sequence || gene.fasta))) || Boolean(gene.gc_content || gene.at_content || (gene.base_counts && Object.keys(gene.base_counts).length > 0));

              return (
                <div className="grid grid-cols-12 gap-6">
                  {/* Nucleotide Visualizations */}
                  {(recordKind !== "protein" || hasNucleotideData) && (
                    <>
                      <div className="col-span-12 lg:col-span-4"><GcDonut gene={gene} /></div>
                      <div className="col-span-12 lg:col-span-8"><CompositionPanel gene={gene} /></div>
                      <div className="col-span-12"><NucleotideDerivedPanel gene={gene} /></div>
                    </>
                  )}

                  {/* Protein Visualizations */}
                  {(recordKind === "protein" || recordKind === "gene" || hasProteinData) && (
                    <>
                      <div className="col-span-12 lg:col-span-8"><AminoAcidCompositionPanel gene={gene} /></div>
                      <div className="col-span-12 lg:col-span-4"><ProteinMetricsStack gene={gene} /></div>
                      <div className="col-span-12"><ProteinSection protein={gene.protein || undefined} gene={gene} /></div>
                    </>
                  )}

                  <div className="col-span-12"><LocationCard gene={gene} /></div>
                  <div className="col-span-12"><GenomeBrowser gene={gene} /></div>
                </div>
              );
            })()}

            {activeTab === "metadata" && (
              <div className="grid gap-6 lg:grid-cols-2">
                <GeneSummaryCard gene={gene} geneId={geneId} />
                <AliasSection aliases={gene.aliases || []} />
                <ClinicalAndReferences gene={gene} external={external} />
                <LocationCard gene={gene} />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function GeneHero({ gene, geneId, external, loading, usingBrowserCache }: { gene: GeneDetail; geneId: string; external: { provider: string; href: string } | null; loading: boolean; usingBrowserCache: boolean }) {
  const { t } = useLanguage();
  const seqLen = Number(gene.sequence_length || gene.sequence?.length || gene.protein?.length || 0);
  const gcVal = Number(gene.gc_content || 0);

  return (
    <section
      className="overflow-hidden rounded-xl animate-fadeIn"
      style={{ background: "linear-gradient(135deg, #020617 0%, #071827 60%, #0c2340 100%)" }}
    >
      <div className="flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between md:p-8">
        {/* Left: name + description */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {usingBrowserCache
              ? <span className="tag-base tag-cached">{t("detail.cached")}</span>
              : <span className="tag-base tag-verified">✓ {t("detail.verified")}</span>}
            {loading && <span className="tag-base" style={{ background: "rgba(255,255,255,0.08)", color: "#94a3b8" }}>{t("detail.refreshing")}</span>}
            <span className="tag-base" style={{ background: "rgba(34,211,238,0.08)", color: "#67e8f9", border: "1px solid rgba(34,211,238,0.15)" }}>
              {gene.source || gene.database || "BioLab AI"}
            </span>
          </div>

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
            {gene.symbol || gene.name || `Gene ${geneId}`}
          </h1>
          {gene.name && gene.symbol && gene.name !== gene.symbol && (
            <p className="mt-1 text-sm italic text-slate-400">{gene.name}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400"><Fingerprint className="h-3 w-3" />{geneId}</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400"><Microscope className="h-3 w-3" />{gene.organism || t("common.unknown")}</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400"><Database className="h-3 w-3" />{gene.source || gene.database || t("common.unknown")}</span>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
            {gene.description || gene.summary || t("detail.descriptionUnavailable")}
          </p>

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyToClipboard(JSON.stringify(gene, null, 2))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/8 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/14 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" /> {t("detail.export")}
            </button>
            {external?.href && (
              <a
                href={external.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                {t("detail.viewOn").replace("{provider}", external.provider)}<ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Right: Gene overview panel — no glassmorphism */}
        <div className="shrink-0 rounded-lg p-5 md:w-56" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="mb-3.5 text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">{t("detail.geneOverview")}</p>
          <div className="space-y-3">
            <OverviewRow label="Organism" value={gene.organism || "—"} icon={Globe} />
            {seqLen > 0 && <OverviewRow label="Length" value={`${seqLen.toLocaleString()} ${gene.data_type?.includes("protein") ? "aa" : "bp"}`} icon={FileText} />}
            {gcVal > 0 && <OverviewRow label="GC Content" value={`${gcVal.toFixed(1)}%`} icon={BarChart3} />}
            <OverviewRow label="Provider" value={gene.source || gene.database || "Unknown"} icon={Database} />
            <OverviewRow label="Confidence" value={usingBrowserCache ? "Cached" : "High"} icon={ShieldCheck} highlight={!usingBrowserCache} />
          </div>
        </div>
      </div>
    </section>
  );
}

function OverviewRow({ label, value, icon: Icon, highlight }: { label: string; value: string; icon: LucideIcon; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3 w-3 text-slate-600 dark:text-slate-400" />
        <span className="text-[10px] font-medium uppercase tracking-[0.07em] text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <span className={`text-xs truncate ${highlight ? "font-medium text-emerald-500 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>{value}</span>
    </div>
  );
}

function MetricCard({ title, value, suffix, icon: Icon, sub }: { title: string; value: string; suffix?: string; icon: LucideIcon; sub?: string }) {
  return (
    <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
        <Icon className="h-4 w-4 text-slate-300 dark:text-slate-600" />
      </div>
      <div className="text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
        {value}{suffix && <span className="ml-1.5 text-sm font-normal text-slate-400 dark:text-slate-500">{suffix}</span>}
      </div>
      {sub && <p className="mt-2.5 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />{sub}</p>}
    </section>
  );
}

function NucleotideDetailOverview({ gene, external, wrapSequence, setWrapSequence, copied, onCopy }: { gene: GeneDetail; external: { provider: string; href: string } | null; wrapSequence: boolean; setWrapSequence: (value: boolean) => void; copied: boolean; onCopy: (value?: string) => void }) {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 grid gap-6 lg:col-span-4">
        <MetricCard title={t("detail.sequenceLength")} value={formatNumber(sequenceLength(gene) || geneRangeLength(gene))} suffix="bp" icon={FileText} sub={t("detail.highConfidence")} />
        <GcDonut gene={gene} />
      </div>
      <div className="col-span-12 lg:col-span-8">
        <CompositionPanel gene={gene} />
      </div>
      <div className="col-span-12">
        <NucleotideDerivedPanel gene={gene} />
      </div>
      <div className="col-span-12">
        <SequencePanel gene={gene} kind="nucleotide" wrapSequence={wrapSequence} setWrapSequence={setWrapSequence} copied={copied} onCopy={onCopy} />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <TranscriptSection transcripts={gene.transcripts || []} />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <ClinicalAndReferences gene={gene} external={external} />
      </div>
    </div>
  );
}

function ProteinDetailOverview({ gene, external }: { gene: GeneDetail; external: { provider: string; href: string } | null }) {
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-4">
        <ProteinMetricsStack gene={gene} />
      </div>
      <div className="col-span-12 lg:col-span-8">
        <AminoAcidCompositionPanel gene={gene} />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <FunctionalDomains protein={gene.protein || undefined} transcripts={[]} />
      </div>
      <div className="col-span-12 lg:col-span-6">
        <UniProtAnnotationPanel gene={gene} external={external} />
      </div>
      <div className="col-span-12">
        <ProteinSection protein={gene.protein || undefined} gene={gene} />
      </div>
    </div>
  );
}

function ProteinMetricsStack({ gene }: { gene: GeneDetail }) {
  const { t } = useLanguage();
  const sequence = getPrimarySequence(gene, "protein");
  const proteinLength = Number(gene.protein?.length || sequence.length || gene.sequence_length || 0);
  const molecularWeight = estimateMolecularWeight(sequence);
  return (
    <div className="grid gap-6">
      <MetricCard title={t("detail.proteinLength")} value={formatNumber(proteinLength)} suffix="aa" icon={FileText} sub={gene.protein?.uniprot_id ? `${t("detail.uniprotAccession")}: ${gene.protein.uniprot_id}` : t("detail.highConfidence")} />
      <MetricCard title={t("detail.molecularWeight")} value={molecularWeight ? molecularWeight.toFixed(1) : t("common.unknown")} suffix={molecularWeight ? "kDa" : undefined} icon={Microscope} sub={t("detail.estimatedFromSequence")} />
      <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{t("detail.proteinInformation")}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{gene.protein?.name || gene.name || t("detail.proteinNameUnavailable")}</p>
      </section>
    </div>
  );
}

function getAminoAcidProperty(code: string) {
  const c = code.toUpperCase();
  if (c === "K" || c === "R" || c === "H") {
    return {
      label: "Basic",
      tagClass: "bg-emerald-50 text-emerald-700 ring-emerald-200/50",
      gradient: "linear-gradient(90deg, #34d399 0%, #059669 100%)"
    };
  }
  if (c === "D" || c === "E") {
    return {
      label: "Acidic",
      tagClass: "bg-rose-50 text-rose-700 ring-rose-200/50",
      gradient: "linear-gradient(90deg, #f43f5e 0%, #be123c 100%)"
    };
  }
  if (c === "S" || c === "T" || c === "C" || c === "Y" || c === "N" || c === "Q") {
    return {
      label: "Polar",
      tagClass: "bg-indigo-50 text-indigo-700 ring-indigo-200/50",
      gradient: "linear-gradient(90deg, #6366f1 0%, #4338ca 100%)"
    };
  }
  return {
    label: "Hydrophobic",
    tagClass: "bg-slate-100 text-slate-700 ring-slate-200/50",
    gradient: "linear-gradient(90deg, #06b6d4 0%, #0891b2 100%)"
  };
}

function AminoAcidCompositionPanel({ gene }: { gene: GeneDetail }) {
  const { t } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const sequence = getPrimarySequence(gene, "protein");
  const counts = countLetters(sequence);
  const total = sequence.length;

  const allAminoAcids = useMemo(() => {
    return AMINO_ACIDS
      .map(([code, name]) => ({
        code,
        name,
        count: Number(counts[code] || 0),
        percent: total ? (Number(counts[code] || 0) / total) * 100 : 0,
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [counts, total]);

  const displayed = showAll ? allAminoAcids : allAminoAcids.slice(0, 10);

  // Group by property for distribution donut
  const distribution = useMemo(() => {
    const groups: Record<string, { label: string; count: number; color: string; hoverColor: string }> = {
      Basic: { label: t("detail.aaPropertyBasic"), count: 0, color: "#10b981", hoverColor: "#34d399" },
      Acidic: { label: t("detail.aaPropertyAcidic"), count: 0, color: "#f43f5e", hoverColor: "#fb7185" },
      Polar: { label: t("detail.aaPropertyPolar"), count: 0, color: "#6366f1", hoverColor: "#818cf8" },
      Hydrophobic: { label: t("detail.aaPropertyHydrophobic"), count: 0, color: "#06b6d4", hoverColor: "#22d3ee" },
    };
    allAminoAcids.forEach((aa) => {
      const prop = getAminoAcidProperty(aa.code);
      if (groups[prop.label]) {
        groups[prop.label].count += aa.count;
      }
    });
    return Object.values(groups).map((g) => ({
      ...g,
      percent: total ? (g.count / total) * 100 : 0,
    }));
  }, [allAminoAcids, total, t]);

  // Calculate SVG arc strokes for Donut
  const donutArcs = useMemo(() => {
    let accumulated = 0;
    const circumference = 2 * Math.PI * 38; // r=38 -> ~238.76
    return distribution.map((item) => {
      const strokeDasharray = `${(item.percent / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((accumulated / 100) * circumference);
      accumulated += item.percent;
      return { ...item, strokeDasharray, strokeDashoffset };
    });
  }, [distribution]);

  return (
    <section className="h-full rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("detail.aminoAcidComposition")}</h3>
          {total > 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {t("detail.aaDistribution")}
            </p>
          )}
        </div>
        <BarChart3 className="h-4 w-4 text-cyan-500" />
      </div>

      {allAminoAcids.length ? (
        <div className="space-y-6">
          {/* Donut Distribution Overview */}
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/40 p-4 sm:flex-row sm:justify-around">
            <div className="relative flex items-center justify-center">
              <svg className="h-28 w-28 -rotate-90 transform" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" stroke="currentColor" strokeWidth="12" fill="none" className="text-slate-200 dark:text-slate-700" />
                {donutArcs.map((arc, i) => (
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r="38"
                    stroke={arc.color}
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={arc.strokeDasharray}
                    strokeDashoffset={arc.strokeDashoffset}
                    className="aa-donut-segment"
                  >
                    <title>{`${arc.label}: ${arc.count} aa (${arc.percent.toFixed(1)}%)`}</title>
                  </circle>
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{formatNumber(total)}</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400">Residues</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {distribution.map((group) => (
                <div key={group.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                  <span className="font-medium text-slate-600 dark:text-slate-400">{group.label}:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{group.percent.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bar Rows */}
          <div className="space-y-3">
            {displayed.map((item, idx) => {
              const prop = getAminoAcidProperty(item.code);
              return (
                <div key={item.code} className="bar-row group relative flex flex-col gap-1.5 rounded-lg p-1.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                      <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">({item.code})</span>
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ring-1 ${prop.tagClass}`}>
                        {prop.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{item.percent.toFixed(1)}%</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">/ {formatNumber(item.count)} aa</span>
                    </div>
                  </div>

                  <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(3, item.percent)}%`,
                        background: prop.gradient,
                        animation: "fillBar 600ms cubic-bezier(0.16,1,0.3,1) both",
                        animationDelay: `${idx * 30}ms`,
                        ["--bar-width" as any]: `${Math.max(3, item.percent)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {allAminoAcids.length > 10 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
            >
              {showAll ? t("toast.showLess") : `${t("toast.showAll")} (${allAminoAcids.length - 10} more)`}
            </button>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-6 text-sm font-semibold text-slate-500 dark:text-slate-400">{t("detail.noAminoAcidComposition")}</p>
      )}

      <div className="mt-6 grid gap-4 border-t border-slate-100 dark:border-slate-800 pt-5 sm:grid-cols-3">
        <MiniStat label={t("detail.proteinLength")} value={total ? `${formatNumber(total)} aa` : t("common.unknown")} />
        <MiniStat label={t("detail.molecularWeight")} value={total ? `${estimateMolecularWeight(sequence).toFixed(1)} kDa` : t("common.unknown")} />
        <MiniStat label={t("detail.uniqueAminoAcids")} value={formatNumber(Object.keys(counts).length)} />
      </div>
    </section>
  );
}

function NucleotideDerivedPanel({ gene }: { gene: GeneDetail }) {
  const { t } = useLanguage();
  const sequence = getPrimarySequence(gene, "nucleotide");
  const reverse = sequence ? reverseComplement(sequence) : "";
  const rna = sequence ? toRnaTranscript(sequence) : "";
  return (
    <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("detail.nucleotideOutputs")}</h3>
        <Dna className="h-4 w-4 text-slate-300 dark:text-slate-600" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DerivedSequenceBox title={t("detail.reverseComplement")} value={reverse} empty={t("detail.noNucleotideSequence")} />
        <DerivedSequenceBox title={t("detail.rnaTranscript")} value={rna} empty={t("detail.noNucleotideSequence")} />
      </div>
    </section>
  );
}

function DerivedSequenceBox({ title, value, empty }: { title: string; value: string; empty: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  function copyValue() {
    copyToClipboard(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-xs font-medium text-slate-600 dark:text-slate-400">{title}</h4>
        <button type="button" onClick={copyValue} disabled={!value} className="inline-flex items-center gap-1 rounded bg-white dark:bg-slate-700 px-2 py-1 text-[10px] font-medium text-slate-500 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600 hover:text-slate-800 dark:hover:text-slate-100 disabled:opacity-50 transition">
          {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? t("detail.copied") : t("detail.copy")}
        </button>
      </div>
      {value ? <pre className="custom-scrollbar max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-5 text-slate-600 dark:text-slate-300">{truncateSequence(value, 1800)}</pre> : <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{empty}</p>}
    </div>
  );
}

function UniProtAnnotationPanel({ gene, external }: { gene: GeneDetail; external: { provider: string; href: string } | null }) {
  const { t } = useLanguage();
  const annotation = gene.protein?.function || gene.summary || gene.description || t("detail.providerAnnotationFallback");
  return (
    <section className="h-full rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 ring-1 ring-slate-100 dark:ring-slate-700"><Info className="h-4 w-4" /></div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("detail.uniprotAnnotation")}</h3>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.07em] text-slate-400 dark:text-slate-500">{gene.protein?.uniprot_id || gene.gene_id || "UniProt"}</p>
        </div>
      </div>
      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{annotation}</p>
      {external?.href && <a href={external.href} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">{t("detail.viewOn").replace("{provider}", external.provider)}<ExternalLink className="h-3.5 w-3.5" /></a>}
    </section>
  );
}

function GcDonut({ gene }: { gene: GeneDetail }) {
  const { t } = useLanguage();
  const hasStats = hasSequenceStats(gene);
  const gc = hasStats ? Number(gene.gc_content || 0) : 0;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(gc, 0), 100) / 100) * circumference;
  const totalLength = sequenceLength(gene) || geneRangeLength(gene);

  return (
    <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{t("detail.gcContent")}</h3>
      {!hasStats && totalLength > 50_000 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <svg className="h-20 w-20 text-slate-200 dark:text-slate-700" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="38" stroke="currentColor" strokeWidth="12" fill="none" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">N/A</p>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 max-w-[160px]">
              Quá lớn để tính GC content tự động ({formatNumber(totalLength)} bp)
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="relative flex items-center justify-center py-4">
            <svg className="h-44 w-44 -rotate-90" role="img" aria-label={`GC content: ${gc.toFixed(1)}%`}>
              <defs>
                <linearGradient id="gcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#0891b2" />
                </linearGradient>
              </defs>
              <circle cx="88" cy="88" r={radius} fill="transparent" stroke="currentColor" strokeWidth="12" className="text-slate-200 dark:text-slate-700" />
              <circle
                cx="88" cy="88" r={radius}
                fill="transparent"
                stroke={hasStats ? "url(#gcGrad)" : "currentColor"}
                strokeDasharray={circumference}
                strokeDashoffset={hasStats ? offset : circumference}
                strokeLinecap="round"
                strokeWidth="12"
                className={hasStats ? "gc-donut-circle" : "text-slate-300 dark:text-slate-600"}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-slate-950 dark:text-slate-100">
                {hasStats ? `${gc.toFixed(1)}%` : "—"}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.07em] text-slate-400 dark:text-slate-500">{t("detail.gcRatio")}</span>
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "linear-gradient(90deg,#22d3ee,#0891b2)" }} />G+C
            </span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-slate-700" />A+T</span>
          </div>
        </>
      )}
    </section>
  );
}

const NUCLEOTIDE_GRADIENTS: Record<string, string> = {
  A: "linear-gradient(90deg, #60a5fa 0%, #2563eb 100%)",
  T: "linear-gradient(90deg, #4ade80 0%, #16a34a 100%)",
  G: "linear-gradient(90deg, #fbbf24 0%, #d97706 100%)",
  C: "linear-gradient(90deg, #f87171 0%, #dc2626 100%)",
};

function CompositionPanel({ gene }: { gene: GeneDetail }) {
  const { t } = useLanguage();
  const counts = gene.base_counts || gene.visualization?.sequence_composition?.base_counts || {};
  const totalCounts = Object.values(counts).reduce((sum, v) => sum + Number(v || 0), 0);
  const totalLength = sequenceLength(gene) || geneRangeLength(gene);
  const isLargeRecord = totalLength > 50_000 && totalCounts === 0;

  return (
    <section className="h-full rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("detail.nucleotideComposition")}</h3>
          <BarChart3 className="h-4 w-4 text-cyan-500" />
        </div>
        {isLargeRecord ? (
          <div className="my-4 rounded-lg border border-cyan-100 dark:border-cyan-900/40 bg-cyan-50/50 dark:bg-cyan-950/20 p-4 text-xs leading-5 text-cyan-800 dark:text-cyan-300">
            <p className="font-semibold">Trình tự quy mô lớn ({formatNumber(totalLength)} bp)</p>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              Đếm bazơ chi tiết được bỏ qua cho các bản ghi nhiễm sắc thể/scaffold lớn. Bạn có thể duyệt và xem trực quan toàn bộ trình tự trong <strong>Genome Browser</strong> bên dưới.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(["A", "T", "G", "C"] as const).map((base) => {
              const w = countWidth(counts, base);
              return (
                <div key={base} className="bar-row">
                  <div className="mb-1.5 flex justify-between gap-3">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{baseName(base)} <span className="font-mono text-slate-400 dark:text-slate-500">({base})</span></span>
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{basePercent(counts, base)} / {formatNumber(counts[base], "0")} bp</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${w}%`,
                        background: NUCLEOTIDE_GRADIENTS[base],
                        animation: "fillBar 700ms cubic-bezier(0.16,1,0.3,1) both",
                        animationDelay: base === "A" ? "0ms" : base === "T" ? "80ms" : base === "G" ? "160ms" : "240ms",
                        ["--bar-width" as any]: `${w}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="mt-6 grid gap-4 border-t border-slate-100 dark:border-slate-800 pt-5 sm:grid-cols-3">
        <MiniStat label={t("detail.length")} value={formatNumber(totalLength)} />
        <MiniStat label={t("detail.gcContent")} value={isLargeRecord ? "N/A" : percent(gene.gc_content ?? null)} />
        <MiniStat label={t("detail.atContent")} value={isLargeRecord ? "N/A" : percent(gene.at_content ?? null)} />
      </div>
    </section>
  );
}

function baseName(base: "A" | "T" | "G" | "C") {
  return { A: "Adenine", T: "Thymine", G: "Guanine", C: "Cytosine" }[base];
}

/** Split a raw FASTA string into lines of `chunkSize` characters, skipping header lines */
function chunkSequenceLines(raw: string, chunkSize = 60): Array<{ pos: number; seq: string }> {
  const clean = raw
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(">"))
    .join("")
    .replace(/\s/g, "")
    .toUpperCase();
  if (!clean) return [];
  const chunks: Array<{ pos: number; seq: string }> = [];
  for (let i = 0; i < clean.length; i += chunkSize) {
    chunks.push({ pos: i + 1, seq: clean.slice(i, i + chunkSize) });
  }
  return chunks;
}

/** Colour-code a sequence string by base type */
function colorizeSequence(seq: string, kind: "nucleotide" | "protein" | "gene"): React.ReactNode {
  if (kind === "nucleotide") {
    return seq.split("").map((ch, i) => {
      const cls =
        ch === "A" ? "base-A" :
        ch === "T" ? "base-T" :
        ch === "G" ? "base-G" :
        ch === "C" ? "base-C" :
        ch === "U" ? "base-U" : "base-N";
      return <span key={i} className={cls}>{ch}</span>;
    });
  }
  if (kind === "protein") {
    // Group amino acids by chemical property
    const nonpolar = new Set(["G","A","V","L","I","P","F","M","W"]);
    const polar    = new Set(["S","T","C","Y","N","Q"]);
    const positive = new Set(["K","R","H"]);
    const negative = new Set(["D","E"]);
    const special  = new Set(["*","-"]);
    return seq.split("").map((ch, i) => {
      const cls =
        positive.has(ch) ? "base-positive" :
        negative.has(ch) ? "base-negative" :
        polar.has(ch)    ? "base-polar" :
        special.has(ch)  ? "base-special" :
        nonpolar.has(ch) ? "base-nonpolar" : "";
      return cls ? <span key={i} className={cls}>{ch}</span> : <span key={i}>{ch}</span>;
    });
  }
  return seq;
}

import React from "react";

function SequencePanel({ gene, kind, wrapSequence, setWrapSequence, copied, onCopy }: { gene: GeneDetail; kind?: DetailRecordKind; wrapSequence: boolean; setWrapSequence: (value: boolean) => void; copied: boolean; onCopy: (value?: string) => void }) {
  const { t } = useLanguage();
  const resolvedKind = kind || getRecordKind(gene);
  const rawFasta = resolvedKind === "protein" ? gene.protein?.fasta || gene.fasta || "" : gene.fasta || "";
  const rawSequence = resolvedKind === "protein" ? gene.protein?.sequence || gene.sequence || "" : gene.sequence || "";
  const locationLabel = resolvedKind === "protein"
    ? `${gene.source || gene.database || "BioLab AI"}${gene.protein?.uniprot_id ? ` | ${gene.protein.uniprot_id}` : ""}`
    : gene.chromosome ? `Chr ${gene.chromosome}: ${formatNumber(gene.start)}-${formatNumber(gene.end)}` : gene.source || "BioLab AI";
  const fastaHeader = `>${gene.symbol || gene.gene_id || "GENE"} | ${gene.organism || t("detail.unknownOrganism")} | ${locationLabel}`;
  const rawDisplay = rawFasta || (rawSequence ? `${fastaHeader}\n${rawSequence}` : "");
  const chunks = chunkSequenceLines(rawDisplay, 60).slice(0, 200); // cap at 12,000 chars
  const totalShown = chunks.reduce((s, c) => s + c.seq.length, 0);
  const totalLen = sequenceLength(gene);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {resolvedKind === "protein" ? t("detail.proteinFasta") : t("detail.nucleotideFasta")}
          </h3>
          <span className="tag-base tag-verified">Benchling viewer</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWrapSequence(!wrapSequence)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${wrapSequence ? "border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
          >
            {t("detail.wrapText")}
          </button>
          <button
            type="button"
            onClick={() => onCopy(rawDisplay)}
            disabled={!rawDisplay}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 dark:bg-cyan-500 px-3 py-1.5 text-xs font-medium text-white dark:text-slate-950 hover:bg-slate-700 dark:hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 transition"
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t("detail.copied") : t("detail.copy")}
          </button>
        </div>
      </div>

      {/* Viewer body */}
      {rawDisplay ? (
        <div className={`fasta-viewer ${wrapSequence ? "whitespace-pre-wrap" : ""}`}>
          {/* FASTA header line */}
          {rawDisplay.startsWith(">") && (
            <div className="fasta-header-line">{rawDisplay.split("\n")[0]}</div>
          )}
          {/* Sequence rows */}
          {chunks.map(({ pos, seq }) => (
            <div key={pos} className="fasta-row">
              <span className="fasta-lineno">{pos}</span>
              <span className="fasta-sequence">
                {colorizeSequence(seq, resolvedKind)}
              </span>
            </div>
          ))}
          {totalLen > totalShown && (
            <div className="fasta-row">
              <span className="fasta-lineno">…</span>
              <span className="fasta-sequence" style={{ color: "#6e7681", fontStyle: "italic" }}>
                {(totalLen - totalShown).toLocaleString()} more characters (copy to get full sequence)
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center">
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-8 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t("detail.fastaUnavailable")}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-5 py-2.5 text-xs text-slate-400 dark:text-slate-500">
        <div className="flex items-center gap-4">
          {chunks.length > 0 && totalLen > 0 && (
            <span className="tabular-nums">Showing 1–{totalShown.toLocaleString()} of <span className="font-mono text-slate-600 dark:text-slate-300">{totalLen.toLocaleString()}</span> {resolvedKind === "protein" ? "aa" : "bp"}</span>
          )}
          {chunks.length > 0 && (
            <span className="flex items-center gap-1.5">
              {(["A","T","G","C"] as const).map((b) => (
                <span key={b} className="inline-flex items-center gap-0.5">
                  <span className={`h-1.5 w-1.5 rounded-full`} style={{ background: b==="A"?"#60a5fa":b==="T"?"#4ade80":b==="G"?"#fbbf24":"#f87171" }} />
                  <span>{b}</span>
                </span>
              ))}
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> {rawDisplay ? t("detail.sequenceAvailable") : t("detail.noSequence")}
        </span>
      </div>
    </section>
  );
}

function FunctionalDomains({ protein, transcripts }: { protein?: GeneProteinInfo; transcripts: GeneTranscript[] }) {
  const { t } = useLanguage();
  const features = protein?.features || [];
  const fallback = transcripts.slice(0, 3).map((transcript, index) => ({ name: transcript.id || `${t("detail.transcript")} ${index + 1}`, type: transcript.biotype || "transcript", start: transcript.start, end: transcript.end }));
  const items = features.length ? features.slice(0, 5) : fallback;
  return (
    <section className="h-full rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{t("detail.functionalDomains")}</h3>
      {items.length ? <div className="space-y-3">{items.map((item, index) => <div key={`${item.name || item.type}-${index}`} className="rounded-lg border-l-2 border-cyan-400 bg-slate-50 dark:bg-slate-800/60 px-4 py-3"><div className="mb-0.5 flex justify-between gap-3"><span className="text-xs font-medium text-slate-800 dark:text-slate-200">{item.name || item.type || t("detail.feature")}</span><span className="font-mono text-xs text-slate-400 dark:text-slate-500">{formatNumber(item.start)}..{formatNumber(item.end)}</span></div><p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{item.type || t("detail.providerFeatureAnnotation")}</p></div>)}</div> : <p className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5 text-sm text-slate-400 dark:text-slate-500">{t("detail.noDomains")}</p>}
    </section>
  );
}

function ClinicalAndReferences({ gene, external }: { gene: GeneDetail; external: { provider: string; href: string } | null }) {
  const { t } = useLanguage();
  const refs = [
    { label: sourceLabel(gene.source, gene.database, t), value: String(gene.gene_id || gene.external_id || gene.id || t("common.unknown")), href: external?.href },
    { label: t("detail.database"), value: gene.database || gene.source || t("common.unknown"), href: gene.source_url || gene.provider_url },
    { label: t("detail.organism"), value: gene.organism || t("common.unknown") },
    { label: t("detail.assembly"), value: gene.assembly || t("common.unknown") },
  ];
  return (
    <section className="h-full rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{t("detail.metadataSourceContext")}</h3>
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 ring-1 ring-slate-100 dark:ring-slate-700"><Info className="h-3.5 w-3.5" /></div>
        <div>
          <h4 className="text-[10px] font-medium uppercase tracking-[0.07em] text-slate-400 dark:text-slate-500">{t("detail.providerAnnotation")}</h4>
          <p className="mt-0.5 text-sm leading-5 text-slate-500 dark:text-slate-400">{gene.summary || gene.description || t("detail.providerAnnotationFallback")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {refs.map((ref) => {
          const content = <><span className="text-[10px] font-medium uppercase tracking-[0.07em] text-slate-400 dark:text-slate-500">{ref.label}</span><span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{ref.value}</span></>;
          return ref.href ? <a key={ref.label} href={ref.href} target="_blank" rel="noreferrer" className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 transition hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600">{content}</a> : <div key={ref.label} className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">{content}</div>;
        })}
      </div>
    </section>
  );
}

function GeneSummaryCard({ gene, geneId }: { gene: GeneDetail; geneId: string }) {
  const { t } = useLanguage();
  return (
    <section className="relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="absolute left-0 top-0 h-full w-1 bg-slate-900 dark:bg-cyan-500" />
      <h3 className="border-b border-slate-100 dark:border-slate-800 pb-3 text-[10px] font-medium uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">{t("detail.geneSummary")}</h3>
      <div className="mt-4 space-y-3">
        <Field label={t("detail.symbol")} value={gene.symbol} strong />
        <Field label={t("detail.name")} value={gene.name || t("common.unknown")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("detail.accession")} value={geneId} mono />
          <Field label={t("detail.database")} value={gene.database || gene.source || t("common.unknown")} />
        </div>
        <Field label={t("detail.lastSynced")} value={gene.last_synced_at || t("common.unknown")} />
      </div>
    </section>
  );
}

function LocationCard({ gene }: { gene: GeneDetail }) {
  const { t } = useLanguage();
  return (
    <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("detail.chromosomeLocation")}</h3>
      <p className="mt-3 font-mono text-sm text-slate-600 dark:text-slate-300">chr{gene.chromosome || "?"}: {formatNumber(gene.start, t("common.unknown"))} — {formatNumber(gene.end, t("common.unknown"))} · strand {gene.strand ?? t("common.unknown")}</p>
      <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="mx-auto h-4 w-1/3 rounded-full bg-slate-900 dark:bg-cyan-500" title={gene.symbol} />
      </div>
      <p className="mt-2.5 text-[10px] font-medium uppercase tracking-[0.07em] text-slate-400 dark:text-slate-500">{t("detail.assembly")}: {gene.assembly || t("common.unknown")}</p>
    </section>
  );
}

function TranscriptSection({ transcripts }: { transcripts: GeneTranscript[] }) {
  const { t } = useLanguage();
  return (
    <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("detail.transcriptExonStructure")}</h2>
      {transcripts.length ? <div className="mt-4 space-y-3">{transcripts.slice(0, 5).map((transcript, index) => <div key={transcript.id || index} className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">{transcript.id || t("detail.transcript")}</h3><span className="text-xs text-slate-400 dark:text-slate-500">{transcript.biotype || t("detail.unknownBiotype")}</span></div><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatNumber(transcript.start, t("common.unknown"))} – {formatNumber(transcript.end, t("common.unknown"))} · {transcript.exons?.length || 0} {t("detail.exons")}</p><div className="mt-3 flex items-center gap-0.5 overflow-hidden rounded-full bg-white dark:bg-slate-800 p-1.5 ring-1 ring-slate-100 dark:ring-slate-700">{(transcript.exons || []).slice(0, 24).map((exon, exonIndex) => <div key={exon.id || exonIndex} className="h-4 min-w-4 flex-1 rounded-full bg-slate-800 dark:bg-cyan-500" title={`${exon.id || "exon"}: ${exon.start}-${exon.end}`} />)}</div></div>)}</div> : <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">{t("detail.noTranscript")}</p>}
    </section>
  );
}

function ProteinSection({ protein, gene }: { protein?: GeneProteinInfo; gene?: GeneDetail }) {
  const { t } = useLanguage();
  if (!protein && !gene) return <section className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-400 dark:text-slate-500">{t("detail.noProtein")}</section>;
  const sequence = gene ? getPrimarySequence(gene, "protein") : cleanSequence(protein?.sequence || protein?.fasta);
  const features = protein?.features || [];
  const length = Number(protein?.length || sequence.length || 0);
  return (
    <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("detail.proteinInformation")}</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{protein?.name || gene?.name || t("detail.proteinNameUnavailable")}</p>
      {(protein?.function || gene?.summary || gene?.description) && <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{protein?.function || gene?.summary || gene?.description}</p>}
      <div className="mt-4 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4">
        <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"><span className="font-mono">{protein?.uniprot_id || gene?.gene_id || "UniProt"}</span><span>{formatNumber(length)} aa</span></div>
        <div className="relative mt-4 h-8 rounded-full bg-white dark:bg-slate-800 ring-1 ring-slate-100 dark:ring-slate-700">{features.slice(0, 16).map((feature, index) => { const start = Number(feature.start || 1); const end = Number(feature.end || start); const left = length ? Math.max(0, ((start - 1) / length) * 100) : index * 6; const width = length ? Math.max(3, ((end - start + 1) / length) * 100) : 8; return <div key={`${feature.name}-${index}`} className="absolute top-1.5 h-5 rounded-full bg-slate-900 dark:bg-cyan-500" style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} title={`${feature.name || feature.type}: ${feature.start}-${feature.end}`} />; })}</div>
        {features.length ? <div className="mt-3 flex flex-wrap gap-1.5">{features.slice(0, 12).map((feature, index) => <span key={`${feature.name}-${index}`} className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300">{feature.name || feature.type || t("detail.feature")} {feature.start ? `(${feature.start}-${feature.end})` : ""}</span>)}</div> : <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">{t("detail.noProteinFeatures")}</p>}
      </div>
    </section>
  );
}

function AliasSection({ aliases }: { aliases: string[] }) {
  const { t } = useLanguage();
  return <section className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 shadow-sm"><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("detail.aliases")}</h2>{aliases.length ? <div className="mt-3 flex flex-wrap gap-1.5">{aliases.map((alias) => <span key={alias} className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300">{alias}</span>)}</div> : <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">{t("detail.noAliases")}</p>}</section>;
}

function Field({ label, value, mono, strong }: { label: string; value?: string; mono?: boolean; strong?: boolean }) {
  return <div><span className="block text-[10px] font-medium uppercase tracking-[0.07em] text-slate-400 dark:text-slate-500">{label}</span><span className={`${mono ? "font-mono" : ""} ${strong ? "text-lg font-semibold" : "text-sm"} text-slate-800 dark:text-slate-200`}>{value || "—"}</span></div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 ring-1 ring-slate-100 dark:ring-slate-800"><p className="text-[10px] font-medium uppercase tracking-[0.07em] text-slate-400 dark:text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p></div>;
}

function Notice({ title, message, onRetry, loading }: { title: string; message: string; onRetry: () => void; loading: boolean }) {
  const { t } = useLanguage();
  return <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 p-4 text-amber-900 dark:text-amber-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><div className="flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-400">{message}</p><button onClick={onRetry} disabled={loading} className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 disabled:opacity-50 transition hover:bg-amber-50 dark:hover:bg-slate-700">{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{t("detail.retry")}</button></div></div>;
}

function EmptyState() {
  const { t } = useLanguage();
  return <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center"><Info className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" /><h2 className="mt-4 text-base font-semibold text-slate-700 dark:text-slate-300">{t("detail.notFoundTitle")}</h2><p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{t("detail.notFoundMessage")}</p></div>;
}
