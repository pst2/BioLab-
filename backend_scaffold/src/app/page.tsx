"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "dev-key-1";

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

type Tool = "dashboard" | "genes" | "pubmed" | "sequence" | "status" | "research";
type FeatureTab = "genes" | "pubmed" | "sequence";
type GeneDataType = "gene" | "nucleotide" | "protein";
type GeneSearchBy = "name" | "id";

type GeneResult = {
  id?: string | number;
  gene_id?: string | number;
  uid?: string | number;
  symbol?: string;
  name?: string;
  description?: string;
  organism?: string;
  taxname?: string;
  data_type?: string;
  database?: string;
  external_id?: string | number;
  ncbi_url?: string;
  source?: string;
};

type PubMedArticle = {
  id?: string | number;
  pmid?: string | number;
  title?: string;
  journal?: string;
  source?: string;
  authors?: string[] | string;
  pub_date?: string;
  pubdate?: string;
  year?: string | number;
  doi?: string;
  abstract?: string;
};

type SequenceResult = {
  length?: number;
  sequence_length?: number;
  gc_content?: number;
  gc_percent?: number;
  gc_content_percent?: number;
  sequence_type?: string;
  type?: string;
  a_count?: number;
  t_count?: number;
  g_count?: number;
  c_count?: number;
  u_count?: number;
  base_counts?: Record<string, number>;
  reverse_complement?: string;
  rna_transcript?: string;
  rna_sequence?: string;
};

type HealthData = {
  status?: string;
  db?: string;
  db_status?: string;
  ncbi?: string;
  cache_hits?: number;
  uptime_seconds?: number;
  api_keys_configured?: number;
  [key: string]: unknown;
};

type ResearchItem = {
  id: number;
  title: string;
  subtitle: string;
  gene: string;
  year: string;
  score: number;
  article?: PubMedArticle;
};

type ChartItem = {
  label: string;
  value: number;
};

const fallbackResearches: ResearchItem[] = [
  {
    id: 1,
    title: "The BRCA1 and BRCA2 Genes in Early-Onset Breast Cancer Patients.",
    subtitle: "Research item",
    gene: "BRCA1",
    year: "2024",
    score: 92,
  },
  {
    id: 2,
    title: "Hereditary Breast Cancer: BRCA Mutations and Beyond.",
    subtitle: "Research item",
    gene: "BRCA2",
    year: "2023",
    score: 86,
  },
  {
    id: 3,
    title: "MRI Surveillance and Breast Cancer Mortality in Women With BRCA1.",
    subtitle: "Research item",
    gene: "BRCA1",
    year: "2025",
    score: 78,
  },
];

function normalizeArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["items", "results", "genes", "articles"] as const) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

function geneId(gene: GeneResult): string {
  return String(gene.id ?? gene.gene_id ?? gene.external_id ?? gene.uid ?? "");
}

function safeText(value: unknown, fallback = "Unknown") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function getArticleYear(article: PubMedArticle): string {
  const raw = article.year ?? article.pub_date ?? article.pubdate ?? "";
  const match = String(raw).match(/\d{4}/);
  return match?.[0] || "Unknown";
}

function getArticleJournal(article: PubMedArticle): string {
  return safeText(article.journal ?? article.source, "Unknown journal");
}

function getGcValue(result: SequenceResult | null): number {
  return Number(result?.gc_content ?? result?.gc_percent ?? result?.gc_content_percent ?? 0);
}

function getSequenceLength(result: SequenceResult | null): number {
  return Number(result?.length ?? result?.sequence_length ?? 0);
}

export default function BioLabDashboard() {
  const [activeTool, setActiveTool] = useState<Tool>("dashboard");
  const [activeTab, setActiveTab] = useState<FeatureTab>("genes");
  const [selectedResearch, setSelectedResearch] = useState<ResearchItem | null>(null);
  const [status, setStatus] = useState<"idle" | "online" | "offline">("idle");
  const [healthData, setHealthData] = useState<HealthData | null>(null);

  const [geneQuery, setGeneQuery] = useState("BRCA1");
  const [geneDataType, setGeneDataType] = useState<GeneDataType>("gene");
  const [geneSearchBy, setGeneSearchBy] = useState<GeneSearchBy>("name");
  const [geneOrganism, setGeneOrganism] = useState("");
  const [geneLoading, setGeneLoading] = useState(false);
  const [geneError, setGeneError] = useState("");
  const [genes, setGenes] = useState<GeneResult[]>([]);

  const [pubmedQuery, setPubmedQuery] = useState("BRCA1 cancer");
  const [pubmedLoading, setPubmedLoading] = useState(false);
  const [pubmedError, setPubmedError] = useState("");
  const [articles, setArticles] = useState<PubMedArticle[]>([]);

  const [sequence, setSequence] = useState("ATGCGTACGTAGCTAGCTAGCGCGCGTTAA");
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [sequenceError, setSequenceError] = useState("");
  const [sequenceResult, setSequenceResult] = useState<SequenceResult | null>(null);

  function navigate(tool: Tool) {
    setActiveTool(tool);
    setSelectedResearch(null);
    if (tool === "genes" || tool === "pubmed" || tool === "sequence") {
      setActiveTab(tool);
    }
  }

  function switchTab(tab: FeatureTab) {
    setActiveTab(tab);
    setActiveTool(tab);
    setSelectedResearch(null);
  }

  function selectResearch(item: ResearchItem) {
    setSelectedResearch(item);
    setActiveTool("research");
  }

  async function checkHealth() {
    try {
      setStatus("idle");
      const res = await fetch(`${API_URL}/api/v1/health`, { cache: "no-store" });
      if (!res.ok) throw new Error("Health check failed");
      const json = (await res.json()) as ApiEnvelope<HealthData>;
      setHealthData(json.data || { status: "online" });
      setStatus("online");
    } catch {
      setHealthData(null);
      setStatus("offline");
    }
  }

  async function handleSystemStatus() {
    try {
      setStatus("idle");
      const res = await fetch(`${API_URL}/api/v1/system/status`, {
        cache: "no-store",
        headers: { "X-API-Key": API_KEY },
      });
      if (!res.ok) throw new Error("System status failed");
      const json = (await res.json()) as ApiEnvelope<HealthData>;
      setHealthData(json.data || { status: "online" });
      setStatus("online");
      navigate("status");
    } catch {
      setStatus("offline");
      navigate("status");
    }
  }

  async function handleGeneSearch(e?: FormEvent) {
    e?.preventDefault();
    setGeneLoading(true);
    setGeneError("");
    setSelectedResearch(null);
    setActiveTool("genes");
    setActiveTab("genes");

    try {
      const params = new URLSearchParams({
        q: geneQuery.trim(),
        data_type: geneDataType,
        search_by: geneSearchBy,
        mode: "local_first",
      });
      if (geneOrganism.trim()) params.set("organism", geneOrganism.trim());

      const res = await fetch(`${API_URL}/api/v1/genes/search?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Gene search failed");
      const json = (await res.json()) as ApiEnvelope<unknown>;
      setGenes(normalizeArray<GeneResult>(json.data));
    } catch {
      setGeneError("Unable to search biological data. Check the backend or the /api/v1/genes/search endpoint.");
    } finally {
      setGeneLoading(false);
    }
  }

  async function handlePubMedSearch(e?: FormEvent) {
    e?.preventDefault();
    setPubmedLoading(true);
    setPubmedError("");
    setSelectedResearch(null);
    setActiveTool("pubmed");
    setActiveTab("pubmed");

    try {
      const res = await fetch(`${API_URL}/api/v1/pubmed/search?q=${encodeURIComponent(pubmedQuery)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("PubMed search failed");
      const json = (await res.json()) as ApiEnvelope<unknown>;
      setArticles(normalizeArray<PubMedArticle>(json.data));
    } catch {
      setPubmedError("Unable to search PubMed articles. Check the backend or the /api/v1/pubmed/search endpoint.");
    } finally {
      setPubmedLoading(false);
    }
  }

  async function handleSequenceAnalyze(e?: FormEvent) {
    e?.preventDefault();
    setSequenceLoading(true);
    setSequenceError("");
    setSelectedResearch(null);
    setActiveTool("sequence");
    setActiveTab("sequence");

    try {
      const res = await fetch(`${API_URL}/api/v1/sequence/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({ sequence }),
      });
      if (!res.ok) throw new Error("Sequence analyze failed");
      const json = (await res.json()) as ApiEnvelope<SequenceResult>;
      setSequenceResult(json.data || null);
    } catch {
      setSequenceError("Unable to analyze the sequence. Check the backend or request schema.");
    } finally {
      setSequenceLoading(false);
    }
  }

  const organismStats = useMemo<ChartItem[]>(() => {
    const counts = new Map<string, number>();
    for (const gene of genes) {
      const organism = gene.organism || gene.taxname || "Unknown";
      counts.set(organism, (counts.get(organism) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [genes]);

  const geneScoreData = useMemo<ChartItem[]>(() => {
    if (genes.length) {
      return genes.slice(0, 6).map((gene, index) => ({
        label: safeText(gene.symbol || gene.name || geneId(gene), `Gene ${index + 1}`).slice(0, 12),
        value: Math.max(20, 96 - index * 9),
      }));
    }
    return [
      { label: "BRCA1", value: 82 },
      { label: "BRCA2", value: 76 },
      { label: "TP53", value: 68 },
      { label: "EGFR", value: 55 },
      { label: "KRAS", value: 49 },
    ];
  }, [genes]);

  const pubmedTimeline = useMemo<ChartItem[]>(() => {
    const counts = new Map<string, number>();
    for (const article of articles) {
      const year = getArticleYear(article);
      counts.set(year, (counts.get(year) || 0) + 1);
    }
    const data = Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label)))
      .slice(-7);
    if (data.length) return data;
    return [
      { label: "2020", value: 12 },
      { label: "2021", value: 18 },
      { label: "2022", value: 25 },
      { label: "2023", value: 34 },
      { label: "2024", value: 41 },
      { label: "2025", value: 48 },
    ];
  }, [articles]);

  const baseCounts = useMemo<Record<string, number>>(() => {
    const r = sequenceResult;
    const fromBaseCounts = r?.base_counts || {};
    return {
      A: Number(r?.a_count ?? fromBaseCounts.A ?? 0),
      T: Number(r?.t_count ?? fromBaseCounts.T ?? 0),
      G: Number(r?.g_count ?? fromBaseCounts.G ?? 0),
      C: Number(r?.c_count ?? fromBaseCounts.C ?? 0),
      U: Number(r?.u_count ?? fromBaseCounts.U ?? 0),
    };
  }, [sequenceResult]);

  const gcWindowData = useMemo<ChartItem[]>(() => {
    const cleaned = sequence.toUpperCase().replace(/[^ATGCU]/g, "");
    const windowSize = Math.max(6, Math.ceil(cleaned.length / 8));
    const chunks: ChartItem[] = [];
    for (let i = 0; i < cleaned.length; i += windowSize) {
      const chunk = cleaned.slice(i, i + windowSize);
      if (!chunk) continue;
      const gc = chunk.split("").filter((base) => base === "G" || base === "C").length;
      chunks.push({ label: String(chunks.length + 1), value: Number(((gc / chunk.length) * 100).toFixed(1)) });
    }
    return chunks.length ? chunks : [{ label: "1", value: 0 }];
  }, [sequence]);

  const researchItems = useMemo<ResearchItem[]>(() => {
    if (!articles.length) return fallbackResearches;
    return articles.slice(0, 5).map((article, index) => ({
      id: index + 1,
      title: safeText(article.title, `Research item ${index + 1}`),
      subtitle: getArticleJournal(article),
      gene: geneQuery.split(/\s+/)[0]?.toUpperCase() || "GENE",
      year: getArticleYear(article),
      score: Math.max(58, 94 - index * 7),
      article,
    }));
  }, [articles, geneQuery]);

  const activeTitle = selectedResearch
    ? "Research Insight"
    : activeTool === "dashboard"
      ? "DNA Overview"
      : activeTool === "genes"
        ? "Bio Search"
        : activeTool === "pubmed"
          ? "PubMed Explorer"
          : activeTool === "sequence"
            ? "Sequence Analyzer"
            : "System Status";

  return (
    <main className="min-h-screen bg-[#e9e8e6] p-2 text-neutral-950 md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-[1480px] gap-4 rounded-[2rem] bg-[#f7f6f3] p-4 shadow-[0_24px_80px_rgba(23,23,23,0.10)] ring-1 ring-black/5 xl:grid-cols-[240px_1fr_340px]">
        <Sidebar activeTool={activeTool} onNavigate={navigate} onStatus={handleSystemStatus} onHealth={checkHealth} />

        <section className="min-w-0 space-y-4">
          <WorkspaceHeader title={activeTitle} />

          <VisualizationPanel
            activeTool={activeTool}
            activeTab={activeTab}
            selectedResearch={selectedResearch}
            geneScoreData={geneScoreData}
            pubmedTimeline={pubmedTimeline}
            gcWindowData={gcWindowData}
            baseCounts={baseCounts}
            genes={genes}
            articles={articles}
            sequence={sequence}
            sequenceResult={sequenceResult}
            status={status}
            healthData={healthData}
            onNavigate={navigate}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Gene results" value={String(genes.length)} caption="Current search" />
            <MetricCard label="PubMed hits" value={String(articles.length)} caption="Articles loaded" />
            <MetricCard label="GC content" value={sequenceResult ? `${getGcValue(sequenceResult).toFixed(1)}%` : `${gcWindowData[0]?.value ?? 0}%`} caption="Sequence analyzer" />
          </div>

          <ToolSwitcher active={activeTab} setActive={switchTab} />

          <InteractiveToolPanel
            activeTool={activeTool}
            geneQuery={geneQuery}
            setGeneQuery={setGeneQuery}
            geneDataType={geneDataType}
            setGeneDataType={setGeneDataType}
            geneSearchBy={geneSearchBy}
            setGeneSearchBy={setGeneSearchBy}
            geneOrganism={geneOrganism}
            setGeneOrganism={setGeneOrganism}
            geneLoading={geneLoading}
            geneError={geneError}
            genes={genes}
            organismStats={organismStats}
            onGeneSearch={handleGeneSearch}
            pubmedQuery={pubmedQuery}
            setPubmedQuery={setPubmedQuery}
            pubmedLoading={pubmedLoading}
            pubmedError={pubmedError}
            articles={articles}
            pubmedTimeline={pubmedTimeline}
            onPubmedSearch={handlePubMedSearch}
            sequence={sequence}
            setSequence={setSequence}
            sequenceLoading={sequenceLoading}
            sequenceError={sequenceError}
            sequenceResult={sequenceResult}
            baseCounts={baseCounts}
            onSequenceAnalyze={handleSequenceAnalyze}
            onStatus={handleSystemStatus}
          />
        </section>

        <RightPanel
          status={status}
          activeTool={activeTool}
          gcValue={sequenceResult ? getGcValue(sequenceResult) : gcWindowData[0]?.value ?? 0}
          gcWindowData={gcWindowData}
          researches={researchItems}
          selectedResearch={selectedResearch}
          onSelectResearch={selectResearch}
        />
      </div>
    </main>
  );
}

function Sidebar({
  activeTool,
  onNavigate,
  onStatus,
  onHealth,
}: {
  activeTool: Tool;
  onNavigate: (tool: Tool) => void;
  onStatus: () => void;
  onHealth: () => void;
}) {
  const items: { key: Tool; label: string; icon: string; action?: () => void }[] = [
    { key: "dashboard", label: "Dashboard", icon: "⌂" },
    { key: "genes", label: "Bio Search", icon: "◌" },
    { key: "pubmed", label: "PubMed", icon: "□" },
    { key: "sequence", label: "Sequence", icon: "◇" },
    { key: "status", label: "Status", icon: "●", action: onStatus },
  ];

  return (
    <aside className="flex flex-col rounded-[1.75rem] bg-white p-4 shadow-sm">
      <div className="mb-8 flex items-center justify-between">
        <button className="text-left text-xl font-black tracking-tight" type="button" onClick={() => onNavigate("dashboard")}>
          BIO<span className="text-[#8d74e8]">LAB</span>
        </button>
        <button className="grid h-10 w-10 place-items-center rounded-full bg-neutral-950 text-white" onClick={onHealth} type="button" title="Check backend">
          ⌕
        </button>
      </div>

      <nav className="space-y-2 text-sm font-medium">
        {items.map((item) => {
          const isActive = activeTool === item.key || (item.key === "dashboard" && activeTool === "research");
          return (
            <button
              key={item.key}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${isActive ? "bg-[#8d74e8] text-white shadow-lg shadow-violet-200" : "text-neutral-700 hover:bg-neutral-100"}`}
              onClick={() => (item.action ? item.action() : onNavigate(item.key))}
              type="button"
            >
              <span className="w-4 text-center">{item.icon}</span>
              <span>{item.label}</span>
              {isActive && <span className="ml-auto">›</span>}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[1.25rem] bg-[#f7f6f3] p-3">
        <p className="text-xs text-neutral-500">Connected services</p>
        <div className="mt-3 flex items-center gap-2">
          <Avatar color="bg-violet-400" />
          <Avatar color="bg-emerald-400" />
          <Avatar color="bg-amber-400" />
          <button className="ml-auto rounded-full bg-neutral-950 px-3 py-1.5 text-[11px] font-semibold text-white" onClick={onHealth} type="button">
            Check
          </button>
        </div>
      </div>
    </aside>
  );
}

function WorkspaceHeader({ title }: { title: string }) {
  return (
    <header className="flex flex-col gap-4 rounded-[1.5rem] bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-neutral-400">Bioinformatics workspace</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{title}</h1>
      </div>
      <div className="flex w-fit rounded-full bg-[#eee9ff] p-1 text-xs font-semibold text-neutral-600">
        <button className="rounded-full bg-[#8d74e8] px-4 py-2 text-white" type="button">Day</button>
        <button className="px-4 py-2" type="button">Week</button>
        <button className="px-4 py-2" type="button">Month</button>
      </div>
    </header>
  );
}

function VisualizationPanel({
  activeTool,
  selectedResearch,
  geneScoreData,
  pubmedTimeline,
  gcWindowData,
  baseCounts,
  genes,
  articles,
  sequence,
  sequenceResult,
  status,
  healthData,
  onNavigate,
}: {
  activeTool: Tool;
  activeTab: FeatureTab;
  selectedResearch: ResearchItem | null;
  geneScoreData: ChartItem[];
  pubmedTimeline: ChartItem[];
  gcWindowData: ChartItem[];
  baseCounts: Record<string, number>;
  genes: GeneResult[];
  articles: PubMedArticle[];
  sequence: string;
  sequenceResult: SequenceResult | null;
  status: "idle" | "online" | "offline";
  healthData: HealthData | null;
  onNavigate: (tool: Tool) => void;
}) {
  if (selectedResearch) {
    return (
      <VisualCard eyebrow="Research visualization" title={selectedResearch.title} description={`Related gene: ${selectedResearch.gene}. Publication year: ${selectedResearch.year}. Relevance score: ${selectedResearch.score}%.`}>
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <ChartShell>
            <LineChartSvg data={pubmedTimeline} />
          </ChartShell>
          <div className="rounded-[1.5rem] bg-[#f7f6f3] p-5">
            <p className="text-sm text-neutral-500">Selected gene</p>
            <h3 className="mt-2 text-4xl font-black">{selectedResearch.gene}</h3>
            <InfoBlock label="Research score" value={`${selectedResearch.score}%`} />
            <InfoBlock label="Publication year" value={selectedResearch.year} />
            {selectedResearch.article?.pmid || selectedResearch.article?.id ? (
              <a className="mt-4 inline-flex rounded-full bg-neutral-950 px-4 py-2 text-xs font-black text-white" href={`https://pubmed.ncbi.nlm.nih.gov/${selectedResearch.article.pmid ?? selectedResearch.article.id}/`} target="_blank" rel="noreferrer">
                Open PubMed ↗
              </a>
            ) : null}
          </div>
        </div>
      </VisualCard>
    );
  }

  if (activeTool === "genes") {
    return (
      <VisualCard eyebrow="Gene search visualization" title="Gene Expression Overview" description="Search genes from your FastAPI backend and visualize the most relevant gene records in the central workspace.">
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <ChartShell>
            <BarChartSvg data={geneScoreData} />
          </ChartShell>
          <div className="space-y-3 rounded-[1.5rem] bg-[#f7f6f3] p-5">
            <p className="text-sm font-bold text-neutral-500">Latest gene records</p>
            {(genes.length ? genes.slice(0, 4) : [{ symbol: "BRCA1", description: "Example gene result" }, { symbol: "BRCA2", description: "Example gene result" }]).map((gene, index) => (
              <div key={`${safeText(gene.symbol)}-${index}`} className="rounded-2xl bg-white p-3">
                <p className="font-black">{safeText(gene.symbol || gene.name, `Gene ${index + 1}`)}</p>
                <p className="line-clamp-2 text-xs leading-5 text-neutral-500">{safeText(gene.description, "No description available.")}</p>
              </div>
            ))}
          </div>
        </div>
      </VisualCard>
    );
  }

  if (activeTool === "pubmed") {
    return (
      <VisualCard eyebrow="PubMed analytics" title="Publication Trend" description="Search biomedical literature and turn publication years into a readable visual timeline.">
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <ChartShell>
            <LineChartSvg data={pubmedTimeline} />
          </ChartShell>
          <div className="space-y-3 rounded-[1.5rem] bg-[#f7f6f3] p-5">
            <p className="text-sm font-bold text-neutral-500">Research summary</p>
            <InfoBlock label="Articles loaded" value={String(articles.length)} />
            <InfoBlock label="Most recent year" value={pubmedTimeline[pubmedTimeline.length - 1]?.label || "—"} />
          </div>
        </div>
      </VisualCard>
    );
  }

  if (activeTool === "sequence") {
    return (
      <VisualCard eyebrow="Sequence analyzer" title="GC Content Distribution" description="Paste DNA/RNA sequence, analyze base composition and visualize GC percentage across sequence windows.">
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <ChartShell>
            <AreaChartSvg data={gcWindowData} />
          </ChartShell>
          <div className="rounded-[1.5rem] bg-[#f7f6f3] p-5">
            <p className="text-sm font-bold text-neutral-500">Sequence preview</p>
            <div className="mt-4 max-h-[150px] overflow-auto break-all rounded-2xl bg-white p-4 font-mono text-sm leading-7 text-neutral-700">{sequence || "Paste a sequence to preview it here."}</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <InfoBlock label="Length" value={String(getSequenceLength(sequenceResult) || sequence.replace(/\s/g, "").length)} compact />
              <InfoBlock label="GC" value={`${(sequenceResult ? getGcValue(sequenceResult) : gcWindowData[0]?.value ?? 0).toFixed(1)}%`} compact />
            </div>
          </div>
        </div>
      </VisualCard>
    );
  }

  if (activeTool === "status") {
    const backendValue = status === "online" ? "Online" : status === "offline" ? "Offline" : "Checking";
    return (
      <VisualCard eyebrow="System health" title="API Health Monitor" description="Check FastAPI backend, database status, API-key protected system endpoint and NCBI readiness.">
        <div className="grid gap-4 md:grid-cols-2">
          <StatusBox label="FastAPI Backend" value={backendValue} status={status} />
          <StatusBox label="Database" value={safeText(healthData?.db_status ?? healthData?.db, "Unknown")} status={status} />
          <StatusBox label="NCBI Client" value={safeText(healthData?.ncbi, "Unknown")} status={status} />
          <StatusBox label="Cache Hits" value={safeText(healthData?.cache_hits, "—")} status={status} />
        </div>
      </VisualCard>
    );
  }

  return (
    <VisualCard eyebrow="Workspace overview" title="Bioinformatics Dashboard" description="The center panel is now the main visualization area. Choose a tool on the left or select a research item on the right to update this workspace.">
      <div className="grid gap-4 md:grid-cols-3">
        <button className="rounded-[1.5rem] bg-[#f7f6f3] p-5 text-left transition hover:bg-violet-50" type="button" onClick={() => onNavigate("genes")}>
          <p className="text-3xl">◌</p>
          <h3 className="mt-5 text-xl font-black">Gene Search</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-500">Search gene records and display score charts.</p>
        </button>
        <button className="rounded-[1.5rem] bg-[#f7f6f3] p-5 text-left transition hover:bg-violet-50" type="button" onClick={() => onNavigate("pubmed")}>
          <p className="text-3xl">□</p>
          <h3 className="mt-5 text-xl font-black">PubMed</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-500">Explore papers with publication timeline.</p>
        </button>
        <button className="rounded-[1.5rem] bg-[#f7f6f3] p-5 text-left transition hover:bg-violet-50" type="button" onClick={() => onNavigate("sequence")}>
          <p className="text-3xl">◇</p>
          <h3 className="mt-5 text-xl font-black">Sequence</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-500">Analyze sequence and GC distribution.</p>
        </button>
      </div>
    </VisualCard>
  );
}

function InteractiveToolPanel({
  activeTool,
  geneQuery,
  setGeneQuery,
  geneDataType,
  setGeneDataType,
  geneSearchBy,
  setGeneSearchBy,
  geneOrganism,
  setGeneOrganism,
  geneLoading,
  geneError,
  genes,
  organismStats,
  onGeneSearch,
  pubmedQuery,
  setPubmedQuery,
  pubmedLoading,
  pubmedError,
  articles,
  pubmedTimeline,
  onPubmedSearch,
  sequence,
  setSequence,
  sequenceLoading,
  sequenceError,
  sequenceResult,
  baseCounts,
  onSequenceAnalyze,
  onStatus,
}: {
  activeTool: Tool;
  geneQuery: string;
  setGeneQuery: (value: string) => void;
  geneDataType: GeneDataType;
  setGeneDataType: (value: GeneDataType) => void;
  geneSearchBy: GeneSearchBy;
  setGeneSearchBy: (value: GeneSearchBy) => void;
  geneOrganism: string;
  setGeneOrganism: (value: string) => void;
  geneLoading: boolean;
  geneError: string;
  genes: GeneResult[];
  organismStats: ChartItem[];
  onGeneSearch: (e?: FormEvent) => void;
  pubmedQuery: string;
  setPubmedQuery: (value: string) => void;
  pubmedLoading: boolean;
  pubmedError: string;
  articles: PubMedArticle[];
  pubmedTimeline: ChartItem[];
  onPubmedSearch: (e?: FormEvent) => void;
  sequence: string;
  setSequence: (value: string) => void;
  sequenceLoading: boolean;
  sequenceError: string;
  sequenceResult: SequenceResult | null;
  baseCounts: Record<string, number>;
  onSequenceAnalyze: (e?: FormEvent) => void;
  onStatus: () => void;
}) {
  if (activeTool === "dashboard" || activeTool === "research" || activeTool === "status") {
    return (
      <Panel title={activeTool === "status" ? "System actions" : "Workspace actions"} subtitle="Use these controls to load real backend data into the visualization area.">
        <div className="grid gap-3 md:grid-cols-4">
          <button className="btn-primary" type="button" onClick={() => onGeneSearch()}>Load genes</button>
          <button className="btn-primary" type="button" onClick={() => onPubmedSearch()}>Load papers</button>
          <button className="btn-primary" type="button" onClick={() => onSequenceAnalyze()}>Analyze sequence</button>
          <button className="btn-primary" type="button" onClick={onStatus}>Check status</button>
        </div>
      </Panel>
    );
  }

  if (activeTool === "genes") {
    return (
      <Panel title="Bio Search" subtitle="Choose Gene, Nucleotide, or Protein; filter by organism; then search by name or ID/accession.">
        <form onSubmit={onGeneSearch} className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto]">
          <label className="space-y-1 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Data type
            <select
              className="input normal-case tracking-normal"
              value={geneDataType}
              onChange={(e) => setGeneDataType(e.target.value as GeneDataType)}
            >
              <option value="gene">Gene</option>
              <option value="nucleotide">Nucleotide</option>
              <option value="protein">Protein</option>
            </select>
          </label>

          <label className="space-y-1 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Organism
            <select
              className="input normal-case tracking-normal"
              value={geneOrganism}
              onChange={(e) => setGeneOrganism(e.target.value)}
            >
              <option value="">All organisms</option>
              <option value="Homo sapiens">Homo sapiens</option>
              <option value="Mus musculus">Mus musculus</option>
              <option value="Escherichia coli">Escherichia coli</option>
              <option value="Saccharomyces cerevisiae">Saccharomyces cerevisiae</option>
              <option value="Arabidopsis thaliana">Arabidopsis thaliana</option>
            </select>
          </label>

          <label className="space-y-1 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Search mode
            <select
              className="input normal-case tracking-normal"
              value={geneSearchBy}
              onChange={(e) => setGeneSearchBy(e.target.value as GeneSearchBy)}
            >
              <option value="name">By name / symbol</option>
              <option value="id">By ID / accession</option>
            </select>
          </label>

          <label className="space-y-1 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            Keyword
            <input
              className="input normal-case tracking-normal"
              value={geneQuery}
              onChange={(e) => setGeneQuery(e.target.value)}
              placeholder={geneSearchBy === "id" ? "e.g. 672, NM_007294, NP_009225" : "e.g. BRCA1, TP53"}
            />
          </label>

          <button className="btn-primary self-end" disabled={geneLoading || !geneQuery.trim()} type="submit">
            {geneLoading ? "Searching..." : "Search"}
          </button>
        </form>
        <p className="text-xs leading-5 text-neutral-500">
          Select Gene, Nucleotide, or Protein; optionally filter by organism; then choose whether to search by name or ID before running the search.
        </p>
        {geneError && <ErrorBox message={geneError} />}
        {organismStats.length > 0 && <MiniBars title="Organism distribution" items={organismStats} />}
        <div className="grid gap-3">
          {genes.map((gene, idx) => {
            const id = geneId(gene);
            return (
              <article key={`${id}-${idx}`} className="rounded-[1.25rem] border border-neutral-200 bg-white p-4 transition hover:border-neutral-950/30">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {id ? (
                      <Link href={`/genes/${id}`} className="text-lg font-black hover:underline">{safeText(gene.symbol || gene.name, `Gene ${id}`)}</Link>
                    ) : (
                      <h3 className="text-lg font-black">{safeText(gene.symbol || gene.name, `Gene ${idx + 1}`)}</h3>
                    )}
                    <p className="mt-1 text-sm leading-6 text-neutral-500">{safeText(gene.description, "No description available.")}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-neutral-400">
                      <span>{safeText(gene.organism || gene.taxname)}</span>
                      <span>• {safeText(gene.data_type || gene.database, "gene")}</span>
                      {gene.source && <span>• {gene.source}</span>}
                    </div>
                  </div>
                  {id && (gene.data_type === "nucleotide" || gene.data_type === "protein") ? (
                    <a
                      href={gene.ncbi_url || `https://www.ncbi.nlm.nih.gov/${gene.database || gene.data_type}/${id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white"
                    >
                      NCBI ↗
                    </a>
                  ) : id ? (
                    <Link href={`/genes/${id}`} className="shrink-0 rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white">Details</Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    );
  }

  if (activeTool === "pubmed") {
    return (
      <Panel title="PubMed Search" subtitle="Search biomedical literature and visualize recent publication years.">
        <form onSubmit={onPubmedSearch} className="flex flex-col gap-3 md:flex-row">
          <input className="input" value={pubmedQuery} onChange={(e) => setPubmedQuery(e.target.value)} placeholder="Example: BRCA1 cancer" />
          <button className="btn-primary" disabled={pubmedLoading} type="submit">{pubmedLoading ? "Searching..." : "Search papers"}</button>
        </form>
        {pubmedError && <ErrorBox message={pubmedError} />}
        {pubmedTimeline.length > 0 && <MiniBars title="Publication timeline" items={pubmedTimeline} />}
        <div className="grid gap-3">
          {articles.map((article, idx) => {
            const pmid = String(article.pmid ?? article.id ?? "");
            return (
              <article key={`${pmid}-${idx}`} className="rounded-[1.25rem] border border-neutral-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-black leading-snug">{safeText(article.title, "Untitled article")}</h3>
                    <p className="mt-2 text-sm text-neutral-500">{getArticleJournal(article)} · {safeText(article.pub_date || article.pubdate || article.year, "Unknown year")}</p>
                  </div>
                  {pmid && (
                    <a className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-bold hover:bg-neutral-50" href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} target="_blank" rel="noreferrer">
                      PubMed ↗
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Sequence Analyzer" subtitle="Visualize length, GC content and base composition.">
      <form onSubmit={onSequenceAnalyze} className="space-y-3">
        <textarea className="textarea" value={sequence} onChange={(e) => setSequence(e.target.value)} placeholder="Paste DNA/RNA sequence..." />
        <button className="btn-primary" disabled={sequenceLoading} type="submit">{sequenceLoading ? "Analyzing..." : "Analyze sequence"}</button>
      </form>
      {sequenceError && <ErrorBox message={sequenceError} />}
      {sequenceResult && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Length" value={String(getSequenceLength(sequenceResult) || "—")} caption="nucleotides" />
            <MetricCard label="GC content" value={`${getGcValue(sequenceResult).toFixed(2)}%`} caption="GC ratio" />
            <MetricCard label="Type" value={safeText(sequenceResult.sequence_type || sequenceResult.type, "DNA")} caption="detected" />
          </div>
          <BaseComposition bases={baseCounts} />
        </div>
      )}
    </Panel>
  );
}

function RightPanel({
  status,
  activeTool,
  gcValue,
  gcWindowData,
  researches,
  selectedResearch,
  onSelectResearch,
}: {
  status: "idle" | "online" | "offline";
  activeTool: Tool;
  gcValue: number;
  gcWindowData: ChartItem[];
  researches: ResearchItem[];
  selectedResearch: ResearchItem | null;
  onSelectResearch: (item: ResearchItem) => void;
}) {
  return (
    <aside className="space-y-4">
      <section className="rounded-[1.75rem] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar color="bg-[#8d74e8]" />
          <div>
            <p className="font-black">BioLab User</p>
            <p className="text-xs text-neutral-500">FastAPI + Next.js</p>
          </div>
          <button className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-neutral-950 text-white" type="button">⚙</button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <SmallStat label="API status" value={status === "online" ? "Online" : status === "offline" ? "Offline" : "Check"} />
          <SmallStat label="Active tool" value={activeTool === "research" ? "Research" : activeTool} />
        </div>
      </section>

      <section className="rounded-[1.75rem] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">GC content</p>
            <p className="text-xl font-black">Sequence rate</p>
          </div>
          <button className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold" type="button">•••</button>
        </div>
        <p className="text-6xl font-black tracking-tight">{Number(gcValue || 0).toFixed(0)}<span className="text-xl text-neutral-400">%</span></p>
        <div className="mt-4 h-[120px]">
          <AreaChartSvg data={gcWindowData} compact />
        </div>
      </section>

      <section className="rounded-[1.75rem] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">Researches</h2>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold">Week</span>
        </div>
        <div className="space-y-3">
          {researches.map((item) => {
            const active = selectedResearch?.id === item.id;
            return (
              <button key={item.id} onClick={() => onSelectResearch(item)} type="button" className={`w-full rounded-[1.25rem] p-4 text-left transition ${active ? "bg-[#8d74e8] text-white shadow-lg shadow-violet-200" : "bg-[#f7f6f3] hover:bg-neutral-100"}`}>
                <h3 className="line-clamp-2 font-black leading-snug">{item.title}</h3>
                <p className="mt-2 text-sm opacity-70">{item.subtitle}</p>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}

function ToolSwitcher({ active, setActive }: { active: FeatureTab; setActive: (v: FeatureTab) => void }) {
  const items: { key: FeatureTab; label: string }[] = [
    { key: "genes", label: "Bio Search" },
    { key: "pubmed", label: "PubMed" },
    { key: "sequence", label: "Sequence" },
  ];

  return (
    <div className="flex flex-wrap gap-2 rounded-[1.25rem] bg-white p-2 shadow-sm">
      {items.map((item) => (
        <button key={item.key} onClick={() => setActive(item.key)} className={`rounded-full px-4 py-2 text-sm font-bold transition ${active === item.key ? "bg-neutral-950 text-white" : "text-neutral-500 hover:bg-neutral-100"}`} type="button">
          {item.label}
        </button>
      ))}
    </div>
  );
}

function VisualCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="min-h-[520px] rounded-[1.75rem] bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.26em] text-neutral-400">{eyebrow}</p>
      <h2 className="mt-2 max-w-4xl text-3xl font-black tracking-tight">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">{description}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function ChartShell({ children }: { children: React.ReactNode }) {
  return <div className="h-[320px] rounded-[1.5rem] bg-[#f7f6f3] p-4">{children}</div>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 rounded-[1.75rem] bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-2xl font-black tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-[1.25rem] bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-400">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-neutral-500">{caption}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] bg-[#f7f6f3] p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-2 truncate text-xl font-black capitalize">{value}</p>
    </div>
  );
}

function InfoBlock({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`${compact ? "mt-0" : "mt-4"} rounded-2xl bg-white p-4`}>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function StatusBox({ label, value, status }: { label: string; value: string; status: "idle" | "online" | "offline" }) {
  const cls = status === "online" ? "text-emerald-600" : status === "offline" ? "text-red-600" : "text-amber-600";
  return (
    <div className="rounded-[1.5rem] bg-[#f7f6f3] p-6">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${cls}`}>{value}</p>
    </div>
  );
}

function Avatar({ color }: { color: string }) {
  return <span className={`inline-block h-10 w-10 rounded-full ${color}`} />;
}

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{message}</div>;
}

function MiniBars({ title, items }: { title: string; items: ChartItem[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (!items.length) return null;
  return (
    <div className="rounded-[1.25rem] bg-[#f7f6f3] p-4">
      <h3 className="mb-3 text-sm font-black">{title}</h3>
      <div className="space-y-3">
        {items.slice(0, 6).map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between gap-3 text-xs">
              <span className="truncate text-neutral-500">{item.label}</span>
              <span className="font-bold">{item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-white">
              <div className="h-2 rounded-full bg-[#8d74e8]" style={{ width: `${Math.round((item.value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BaseComposition({ bases }: { bases: Record<string, number> }) {
  const items = Object.entries(bases).filter(([, value]) => value > 0);
  const total = Math.max(items.reduce((sum, [, value]) => sum + value, 0), 1);
  if (!items.length) return null;

  return (
    <div className="rounded-[1.25rem] bg-[#f7f6f3] p-4">
      <h3 className="mb-3 text-sm font-black">Base composition</h3>
      <div className="space-y-3">
        {items.map(([label, value]) => {
          const percent = (value / total) * 100;
          return (
            <div key={label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-black">{label}</span>
                <span className="text-neutral-500">{value} · {percent.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white">
                <div className="h-2 rounded-full bg-neutral-950" style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarChartSvg({ data }: { data: ChartItem[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 640;
  const height = 280;
  const gap = 18;
  const barWidth = Math.max(26, (width - gap * (data.length + 1)) / Math.max(data.length, 1));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Bar chart">
      {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2={width} y1={40 + i * 55} y2={40 + i * 55} stroke="#e7e5e4" strokeDasharray="5 5" />)}
      {data.map((item, index) => {
        const h = Math.max(18, (item.value / max) * 185);
        const x = gap + index * (barWidth + gap);
        const y = 220 - h;
        return (
          <g key={`${item.label}-${index}`}>
            <rect x={x} y={y} width={barWidth} height={h} rx="14" fill="#8d74e8" opacity="0.92" />
            <text x={x + barWidth / 2} y={248} textAnchor="middle" fontSize="13" fontWeight="700" fill="#57534e">{item.label}</text>
            <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" fontSize="13" fontWeight="800" fill="#171717">{item.value}</text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChartSvg({ data }: { data: ChartItem[] }) {
  const width = 640;
  const height = 280;
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = data.map((item, index) => {
    const x = 32 + index * ((width - 64) / Math.max(data.length - 1, 1));
    const y = 220 - ((item.value - min) / range) * 165;
    return { ...item, x, y };
  });
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Line chart">
      {[0, 1, 2, 3].map((i) => <line key={i} x1="20" x2={width - 20} y1={45 + i * 50} y2={45 + i * 50} stroke="#e7e5e4" strokeDasharray="5 5" />)}
      <path d={d} fill="none" stroke="#8d74e8" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point) => (
        <g key={point.label}>
          <circle cx={point.x} cy={point.y} r="7" fill="#8d74e8" />
          <text x={point.x} y="250" textAnchor="middle" fontSize="13" fontWeight="700" fill="#57534e">{point.label}</text>
        </g>
      ))}
    </svg>
  );
}

function AreaChartSvg({ data, compact = false }: { data: ChartItem[]; compact?: boolean }) {
  const width = 640;
  const height = compact ? 160 : 280;
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const top = compact ? 20 : 40;
  const bottom = compact ? 125 : 220;
  const points = data.map((item, index) => {
    const x = 28 + index * ((width - 56) / Math.max(data.length - 1, 1));
    const y = bottom - ((item.value - min) / range) * (bottom - top);
    return { ...item, x, y };
  });
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${line} L ${points[points.length - 1]?.x ?? 28} ${bottom} L ${points[0]?.x ?? 28} ${bottom} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Area chart">
      {!compact && [0, 1, 2, 3].map((i) => <line key={i} x1="20" x2={width - 20} y1={45 + i * 50} y2={45 + i * 50} stroke="#e7e5e4" strokeDasharray="5 5" />)}
      <path d={area} fill="#8d74e8" opacity="0.16" />
      <path d={line} fill="none" stroke="#8d74e8" strokeWidth={compact ? 8 : 6} strokeLinecap="round" strokeLinejoin="round" />
      {!compact && points.map((point) => <text key={point.label} x={point.x} y="250" textAnchor="middle" fontSize="13" fontWeight="700" fill="#57534e">{point.label}</text>)}
    </svg>
  );
}
