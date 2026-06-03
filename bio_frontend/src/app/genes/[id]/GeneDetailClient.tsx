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
import { api, GeneDetail, GeneProteinInfo, GeneTranscript } from "@/lib/api";
import { LanguageToggle, useLanguage } from "@/lib/i18n";

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

function percent(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return "0%";
  return `${Number(value).toFixed(1)}%`;
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

  function handleCopy(value?: string) {
    copyToClipboard(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="min-h-screen bg-[#f7f9fb] text-[#191c1e] antialiased dna-pattern">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-[#f7f9fb]/90 px-4 py-4 backdrop-blur-md md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 shadow-sm hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" /> {t("detail.back")}
            </Link>
            <div className="hidden text-xs font-black uppercase tracking-[0.22em] text-slate-400 sm:block">
              {t("detail.breadcrumbSearch")} <span className="mx-2 text-slate-300">/</span> <span className="text-slate-900">{t("detail.breadcrumbDetail")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle compact />
            <button onClick={() => fetchGeneDetail()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600 shadow-sm hover:bg-slate-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-cyan-500" /> : <RefreshCw className="h-4 w-4 text-cyan-500" />}
              {t("detail.refresh")}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {error && <Notice title={t("detail.providerWarning")} message={error} onRetry={() => fetchGeneDetail()} loading={loading} />}

        {loading && !gene && (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white/90 p-10 text-center shadow-sm">
            <Dna className="h-12 w-12 animate-spin text-cyan-500" />
            <h2 className="mt-4 text-xl font-black text-slate-950">{t("detail.loadingTitle")}</h2>
            <p className="mt-2 text-sm text-slate-500">{t("detail.loadingDesc")}</p>
          </div>
        )}

        {!loading && !gene && !error && <EmptyState />}

        {gene && (
          <div className="space-y-8 animate-fadeIn">
            <GeneHero gene={gene} geneId={geneId} external={external} loading={loading} usingBrowserCache={usingBrowserCache} />

            <div className="flex gap-7 overflow-x-auto border-b border-slate-200">
              {([
                ["overview", t("detail.overview")],
                ["sequence", t("detail.sequence")],
                ["visualization", t("detail.visualization")],
                ["metadata", t("detail.metadata")],
              ] as const).map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap border-b-2 pb-4 text-base font-black transition ${activeTab === tab ? "border-cyan-500 text-cyan-700" : "border-transparent text-slate-500 hover:text-slate-950"}`}>
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

            {activeTab === "visualization" && (
              recordKind === "protein" ? (
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 lg:col-span-8"><AminoAcidCompositionPanel gene={gene} /></div>
                  <div className="col-span-12 lg:col-span-4"><ProteinMetricsStack gene={gene} /></div>
                  <div className="col-span-12"><ProteinSection protein={gene.protein || undefined} gene={gene} /></div>
                </div>
              ) : (
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 lg:col-span-4"><GcDonut gene={gene} /></div>
                  <div className="col-span-12 lg:col-span-8"><CompositionPanel gene={gene} /></div>
                  <div className="col-span-12"><NucleotideDerivedPanel gene={gene} /></div>
                  <div className="col-span-12"><LocationCard gene={gene} /></div>
                </div>
              )
            )}

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
  return (
    <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h1 className="text-5xl font-black leading-none tracking-tight text-slate-950 md:text-6xl">{gene.symbol || gene.name || `Gene ${geneId}`}</h1>
          <span className="rounded-full bg-cyan-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-800 ring-1 ring-cyan-200">{usingBrowserCache ? t("detail.cached") : t("detail.verified")}</span>
          {loading && <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">{t("detail.refreshing")}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-slate-500">
          <span className="inline-flex items-center gap-2"><Fingerprint className="h-4 w-4 text-slate-400" />{t("detail.id")}: {geneId}</span>
          <span className="inline-flex items-center gap-2"><Microscope className="h-4 w-4 text-slate-400" />{t("detail.organism")}: {gene.organism || t("common.unknown")}</span>
          <span className="inline-flex items-center gap-2"><Database className="h-4 w-4 text-slate-400" />{t("detail.source")}: {gene.source || gene.database || t("common.unknown")}</span>
        </div>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600">{gene.description || gene.summary || t("detail.descriptionUnavailable")}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => copyToClipboard(JSON.stringify(gene, null, 2))} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-700 shadow-sm hover:bg-slate-50">
          <Download className="h-4 w-4" /> {t("detail.export")}
        </button>
        {external?.href && <a href={external.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-white shadow-sm shadow-cyan-500/20 hover:bg-cyan-600">{t("detail.viewOn").replace("{provider}", external.provider)}<ExternalLink className="h-4 w-4" /></a>}
      </div>
    </section>
  );
}

function MetricCard({ title, value, suffix, icon: Icon, sub }: { title: string; value: string; suffix?: string; icon: LucideIcon; sub?: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
        <Icon className="h-5 w-5 text-cyan-500" />
      </div>
      <div className="text-5xl font-black tracking-tight text-slate-950">{value} {suffix && <span className="text-base font-semibold text-slate-500">{suffix}</span>}</div>
      {sub && <p className="mt-3 flex items-center gap-1 text-xs font-black text-emerald-600"><CheckCircle2 className="h-4 w-4" />{sub}</p>}
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
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
        <h3 className="text-lg font-black text-slate-950">{t("detail.proteinInformation")}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">{gene.protein?.name || gene.name || t("detail.proteinNameUnavailable")}</p>
      </section>
    </div>
  );
}

function AminoAcidCompositionPanel({ gene }: { gene: GeneDetail }) {
  const { t } = useLanguage();
  const sequence = getPrimarySequence(gene, "protein");
  const counts = countLetters(sequence);
  const total = sequence.length;
  const topAminoAcids = AMINO_ACIDS
    .map(([code, name]) => ({ code, name, count: Number(counts[code] || 0), percent: total ? (Number(counts[code] || 0) / total) * 100 : 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  return (
    <section className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
      <div className="mb-7 flex items-center justify-between">
        <h3 className="text-lg font-black text-slate-950">{t("detail.aminoAcidComposition")}</h3>
        <BarChart3 className="h-5 w-5 text-slate-400" />
      </div>
      {topAminoAcids.length ? (
        <div className="space-y-5">
          {topAminoAcids.map((item) => (
            <div key={item.code}>
              <div className="mb-2 flex justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">{item.name} ({item.code})</span>
                <span className="font-mono text-xs font-bold text-slate-600">{item.percent.toFixed(1)}% / {formatNumber(item.count)} aa</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.max(3, item.percent)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-semibold text-slate-500">{t("detail.noAminoAcidComposition")}</p>
      )}
      <div className="mt-8 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
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
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-black text-slate-950">{t("detail.nucleotideOutputs")}</h3>
        <Dna className="h-5 w-5 text-cyan-500" />
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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">{title}</h4>
        <button type="button" onClick={copyValue} disabled={!value} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 ring-1 ring-slate-200 hover:text-cyan-700 disabled:opacity-50">
          {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? t("detail.copied") : t("detail.copy")}
        </button>
      </div>
      {value ? <pre className="custom-scrollbar max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-5 text-slate-600">{truncateSequence(value, 1800)}</pre> : <p className="text-sm font-semibold text-slate-500">{empty}</p>}
    </div>
  );
}

function UniProtAnnotationPanel({ gene, external }: { gene: GeneDetail; external: { provider: string; href: string } | null }) {
  const { t } = useLanguage();
  const annotation = gene.protein?.function || gene.summary || gene.description || t("detail.providerAnnotationFallback");
  return (
    <section className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100"><Info className="h-5 w-5" /></div>
        <div>
          <h3 className="text-lg font-black text-slate-950">{t("detail.uniprotAnnotation")}</h3>
          <p className="mt-1 text-xs font-black uppercase tracking-wider text-cyan-700">{gene.protein?.uniprot_id || gene.gene_id || "UniProt"}</p>
        </div>
      </div>
      <p className="text-sm leading-7 text-slate-600">{annotation}</p>
      {external?.href && <a href={external.href} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-cyan-600">{t("detail.viewOn").replace("{provider}", external.provider)}<ExternalLink className="h-4 w-4" /></a>}
    </section>
  );
}

function GcDonut({ gene }: { gene: GeneDetail }) {
  const { t } = useLanguage();
  const gc = Number(gene.gc_content || 0);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(gc, 0), 100) / 100) * circumference;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
      <h3 className="mb-5 text-lg font-black text-slate-950">{t("detail.gcContent")}</h3>
      <div className="relative flex items-center justify-center py-4">
        <svg className="h-44 w-44 -rotate-90">
          <circle cx="88" cy="88" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
          <circle cx="88" cy="88" r={radius} fill="transparent" stroke="#06B6D4" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" strokeWidth="12" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-slate-950">{gc.toFixed(1)}%</span>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t("detail.gcRatio")}</span>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-6 text-xs font-black text-slate-600">
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-cyan-500" />G+C</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-slate-100 ring-1 ring-slate-200" />A+T</span>
      </div>
    </section>
  );
}

function CompositionPanel({ gene }: { gene: GeneDetail }) {
  const { t } = useLanguage();
  const counts = gene.base_counts || gene.visualization?.sequence_composition?.base_counts || {};
  return (
    <section className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
      <div className="mb-7 flex items-center justify-between">
        <h3 className="text-lg font-black text-slate-950">{t("detail.nucleotideComposition")}</h3>
        <BarChart3 className="h-5 w-5 text-slate-400" />
      </div>
      <div className="space-y-7">
        {(["A", "T", "G", "C"] as const).map((base) => (
          <div key={base}>
            <div className="mb-2 flex justify-between gap-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">{baseName(base)} ({base})</span>
              <span className="font-mono text-xs font-bold text-slate-600">{basePercent(counts, base)} / {formatNumber(counts[base], t("common.unknown"))} bp</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${base === "A" || base === "T" ? "bg-slate-950" : "bg-cyan-500"}`} style={{ width: `${countWidth(counts, base)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
        <MiniStat label={t("detail.length")} value={formatNumber(sequenceLength(gene) || geneRangeLength(gene))} />
        <MiniStat label={t("detail.gcContent")} value={percent(gene.gc_content)} />
        <MiniStat label={t("detail.atContent")} value={percent(gene.at_content)} />
      </div>
    </section>
  );
}

function baseName(base: "A" | "T" | "G" | "C") {
  return { A: "Adenine", T: "Thymine", G: "Guanine", C: "Cytosine" }[base];
}

function SequencePanel({ gene, kind, wrapSequence, setWrapSequence, copied, onCopy }: { gene: GeneDetail; kind?: DetailRecordKind; wrapSequence: boolean; setWrapSequence: (value: boolean) => void; copied: boolean; onCopy: (value?: string) => void }) {
  const { t } = useLanguage();
  const resolvedKind = kind || getRecordKind(gene);
  const rawFasta = resolvedKind === "protein" ? gene.protein?.fasta || gene.fasta || "" : gene.fasta || "";
  const rawSequence = resolvedKind === "protein" ? gene.protein?.sequence || gene.sequence || "" : gene.sequence || "";
  const locationLabel = resolvedKind === "protein" ? `${gene.source || gene.database || "BioLab AI"}${gene.protein?.uniprot_id ? ` | ${gene.protein.uniprot_id}` : ""}` : gene.chromosome ? `Chr ${gene.chromosome}: ${formatNumber(gene.start)}-${formatNumber(gene.end)}` : gene.source || "BioLab AI";
  const header = `>${gene.symbol || gene.gene_id || "GENE"} | ${gene.organism || t("detail.unknownOrganism")} | ${locationLabel}`;
  const display = rawFasta || (rawSequence ? `${header}\n${rawSequence}` : "");
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-cyan-500" />
          <h3 className="text-lg font-black text-slate-950">{resolvedKind === "protein" ? t("detail.proteinFasta") : t("detail.nucleotideFasta")}</h3>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500">
            <input type="checkbox" checked={wrapSequence} onChange={(event) => setWrapSequence(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500" />
            {t("detail.wrapText")}
          </label>
          <button type="button" onClick={() => onCopy(display)} disabled={!display} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50">
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t("detail.copied") : t("detail.copy")}
          </button>
        </div>
      </div>
      <div className="bg-white p-6">
        {display ? (
          <pre className={`custom-scrollbar max-h-[520px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-6 font-mono text-[13px] leading-6 text-slate-700 ${wrapSequence ? "whitespace-pre-wrap break-all" : "whitespace-pre"}`}>{truncateSequence(display, 7000, t("detail.truncated").replace("{count}", display.length.toLocaleString()))}</pre>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">{t("detail.fastaUnavailable")}</div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-6 py-3 text-xs font-bold text-slate-500">
        <span>{t("detail.length")}: {formatNumber(sequenceLength(gene))}</span>
        <span className="inline-flex items-center gap-1 text-cyan-600"><ShieldCheck className="h-4 w-4" /> {display ? t("detail.sequenceAvailable") : t("detail.noSequence")}</span>
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
    <section className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
      <h3 className="mb-6 text-lg font-black text-slate-950">{t("detail.functionalDomains")}</h3>
      {items.length ? <div className="space-y-4">{items.map((item, index) => <div key={`${item.name || item.type}-${index}`} className="rounded-lg border-l-4 border-cyan-500 bg-slate-50 p-4"><div className="mb-1 flex justify-between gap-3"><span className="text-xs font-black uppercase tracking-wider text-slate-950">{item.name || item.type || t("detail.feature")}</span><span className="font-mono text-xs text-slate-500">{formatNumber(item.start)}..{formatNumber(item.end)}</span></div><p className="text-sm leading-6 text-slate-500">{item.type || t("detail.providerFeatureAnnotation")}</p></div>)}</div> : <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">{t("detail.noDomains")}</p>}
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
    <section className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
      <h3 className="mb-6 text-lg font-black text-slate-950">{t("detail.metadataSourceContext")}</h3>
      <div className="mb-6 flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100"><Info className="h-5 w-5" /></div>
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-cyan-700">{t("detail.providerAnnotation")}</h4>
          <p className="mt-1 text-sm leading-6 text-slate-500">{gene.summary || gene.description || t("detail.providerAnnotationFallback")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {refs.map((ref) => {
          const content = <><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{ref.label}</span><span className="truncate text-sm font-black text-slate-950">{ref.value}</span></>;
          return ref.href ? <a key={ref.label} href={ref.href} target="_blank" rel="noreferrer" className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:bg-white">{content}</a> : <div key={ref.label} className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-slate-50 p-3">{content}</div>;
        })}
      </div>
    </section>
  );
}

function GeneSummaryCard({ gene, geneId }: { gene: GeneDetail; geneId: string }) {
  const { t } = useLanguage();
  return (
    <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="absolute left-0 top-0 h-full w-1.5 bg-slate-950" />
      <h3 className="border-b border-slate-100 pb-3 text-xs font-black uppercase tracking-widest text-slate-400">{t("detail.geneSummary")}</h3>
      <div className="mt-5 space-y-4">
        <Field label={t("detail.symbol")} value={gene.symbol} strong />
        <Field label={t("detail.name")} value={gene.name || t("common.unknown")} />
        <div className="grid gap-4 sm:grid-cols-2">
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
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-black text-slate-950">{t("detail.chromosomeLocation")}</h3>
      <p className="mt-4 text-sm font-bold text-slate-600">chr{gene.chromosome || "?"}: {formatNumber(gene.start, t("common.unknown"))} - {formatNumber(gene.end, t("common.unknown"))} · {t("detail.strand")} {gene.strand ?? t("common.unknown")}</p>
      <div className="mt-6 h-5 rounded-full bg-slate-100 ring-1 ring-slate-200">
        <div className="mx-auto h-5 w-1/3 rounded-full bg-slate-950" title={gene.symbol} />
      </div>
      <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">{t("detail.assembly")}: {gene.assembly || t("common.unknown")}</p>
    </section>
  );
}

function TranscriptSection({ transcripts }: { transcripts: GeneTranscript[] }) {
  const { t } = useLanguage();
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">{t("detail.transcriptExonStructure")}</h2>
      {transcripts.length ? <div className="mt-5 space-y-4">{transcripts.slice(0, 5).map((transcript, index) => <div key={transcript.id || index} className="rounded-xl border border-slate-100 bg-slate-50 p-5"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-black text-slate-950">{transcript.id || t("detail.transcript")}</h3><span className="text-sm font-bold text-slate-500">{transcript.biotype || t("detail.unknownBiotype")}</span></div><p className="mt-2 text-sm text-slate-500">{formatNumber(transcript.start, t("common.unknown"))} - {formatNumber(transcript.end, t("common.unknown"))} · {transcript.exons?.length || 0} {t("detail.exons")}</p><div className="mt-4 flex items-center gap-1 overflow-hidden rounded-full bg-white p-2 ring-1 ring-slate-200">{(transcript.exons || []).slice(0, 24).map((exon, exonIndex) => <div key={exon.id || exonIndex} className="h-5 min-w-5 flex-1 rounded-full bg-slate-950" title={`${exon.id || "exon"}: ${exon.start}-${exon.end}`} />)}</div></div>)}</div> : <p className="mt-4 text-sm text-slate-500">{t("detail.noTranscript")}</p>}
    </section>
  );
}

function ProteinSection({ protein, gene }: { protein?: GeneProteinInfo; gene?: GeneDetail }) {
  const { t } = useLanguage();
  if (!protein && !gene) return <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm font-semibold text-slate-500">{t("detail.noProtein")}</section>;
  const sequence = gene ? getPrimarySequence(gene, "protein") : cleanSequence(protein?.sequence || protein?.fasta);
  const features = protein?.features || [];
  const length = Number(protein?.length || sequence.length || 0);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-950">{t("detail.proteinInformation")}</h2>
      <p className="mt-3 text-sm text-slate-600">{protein?.name || gene?.name || t("detail.proteinNameUnavailable")}</p>
      {(protein?.function || gene?.summary || gene?.description) && <p className="mt-4 text-sm leading-7 text-slate-600">{protein?.function || gene?.summary || gene?.description}</p>}
      <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-5">
        <div className="flex flex-wrap justify-between gap-2 text-sm font-bold text-slate-500"><span>{protein?.uniprot_id || gene?.gene_id || "UniProt"}</span><span>{formatNumber(length)} aa</span></div>
        <div className="relative mt-5 h-10 rounded-full bg-white ring-1 ring-slate-200">{features.slice(0, 16).map((feature, index) => { const start = Number(feature.start || 1); const end = Number(feature.end || start); const left = length ? Math.max(0, ((start - 1) / length) * 100) : index * 6; const width = length ? Math.max(3, ((end - start + 1) / length) * 100) : 8; return <div key={`${feature.name}-${index}`} className="absolute top-2 h-6 rounded-full bg-slate-950" style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} title={`${feature.name || feature.type}: ${feature.start}-${feature.end}`} />; })}</div>
        {features.length ? <div className="mt-4 flex flex-wrap gap-2">{features.slice(0, 12).map((feature, index) => <span key={`${feature.name}-${index}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">{feature.name || feature.type || t("detail.feature")} {feature.start ? `(${feature.start}-${feature.end})` : ""}</span>)}</div> : <p className="mt-4 text-sm text-slate-500">{t("detail.noProteinFeatures")}</p>}
      </div>
    </section>
  );
}

function AliasSection({ aliases }: { aliases: string[] }) {
  const { t } = useLanguage();
  return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">{t("detail.aliases")}</h2>{aliases.length ? <div className="mt-4 flex flex-wrap gap-2">{aliases.map((alias) => <span key={alias} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600">{alias}</span>)}</div> : <p className="mt-4 text-sm text-slate-500">{t("detail.noAliases")}</p>}</section>;
}

function Field({ label, value, mono, strong }: { label: string; value?: string; mono?: boolean; strong?: boolean }) {
  return <div><span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span><span className={`${mono ? "font-mono" : ""} ${strong ? "text-xl font-black" : "text-sm font-bold"} text-slate-800`}>{value || "—"}</span></div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-slate-950">{value}</p></div>;
}

function Notice({ title, message, onRetry, loading }: { title: string; message: string; onRetry: () => void; loading: boolean }) {
  const { t } = useLanguage();
  return <div className="mb-6 flex items-start gap-3 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 text-amber-900 shadow-sm"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div className="flex-1"><p className="font-black">{title}</p><p className="mt-1 text-sm font-semibold leading-6">{message}</p><button onClick={onRetry} disabled={loading} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-amber-900 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{t("detail.retry")}</button></div></div>;
}

function EmptyState() {
  const { t } = useLanguage();
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white/90 p-10 text-center shadow-sm"><Info className="mx-auto h-10 w-10 text-slate-400" /><h2 className="mt-4 text-xl font-black text-slate-950">{t("detail.notFoundTitle")}</h2><p className="mt-2 text-sm text-slate-500">{t("detail.notFoundMessage")}</p></div>;
}
