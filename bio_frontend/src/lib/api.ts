const BASE_URL = "/api/backend";

export interface MetaInfo {
  source: string;
  cached: boolean;
  stale: boolean;
  count?: number;
  keyword?: string;
  mode?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: MetaInfo;
}

export type GeneDataType = "gene" | "nucleotide" | "protein";
export type GeneSearchBy = "name" | "accession" | "id";
export type GeneProvider = "auto" | "ncbi" | "ensembl" | "uniprot" | "bvbrc" | "phytozome";

export interface GeneSearchParams {
  q: string;
  dataType?: GeneDataType;
  searchBy?: GeneSearchBy;
  organism?: string;
  mode?: "local_first" | "local_only" | "external_refresh";
  provider?: GeneProvider;
  fallback?: boolean;
}

export interface GeneTranscript {
  id?: string;
  biotype?: string;
  start?: number;
  end?: number;
  strand?: number | string;
  protein_id?: string | null;
  exons?: Array<{ id?: string; start?: number; end?: number; strand?: number | string }>;
}

export interface ProteinFeature {
  type?: string;
  name?: string;
  start?: number;
  end?: number;
}

export interface GeneProteinInfo {
  uniprot_id?: string;
  name?: string;
  length?: number;
  function?: string;
  sequence?: string;
  fasta?: string;
  features?: ProteinFeature[];
}

export interface GeneVisualization {
  location?: {
    chromosome?: string;
    start?: number;
    end?: number;
    strand?: number | string;
    assembly?: string;
    genomic_accession?: string;
  };
  sequence_composition?: {
    sequence_length?: number;
    base_counts?: Record<string, number>;
    gc_content?: number;
    at_content?: number;
  };
  transcripts?: GeneTranscript[];
  protein?: GeneProteinInfo | null;
}

export interface GeneResult {
  id?: string | number;
  gene_id: string;
  external_id?: string | number;
  data_type?: string;
  database?: string;
  symbol: string;
  name: string;
  description: string;
  organism: string;
  source?: string;
  source_url?: string;
  provider_url?: string;
  ncbi_url?: string;
  last_synced_at?: string;
}

export interface GeneDetail {
  id?: string | number;
  gene_id?: string | number;
  external_id?: string | number;
  data_type?: string;
  database?: string;
  symbol: string;
  name?: string;
  description?: string;
  organism?: string;
  summary?: string;
  chromosome?: string;
  start?: number;
  end?: number;
  strand?: number | string;
  assembly?: string;
  /** NC_/NW_/NZ_ RefSeq chromosome accession for IGV.js, e.g. "NC_000005.10".
   *  Populated only for NCBI Gene records. */
  genomic_accession?: string;
  aliases?: string[];
  sequence?: string;
  sequence_type?: string;
  sequence_length?: number;
  fasta?: string;
  base_counts?: Record<string, number>;
  gc_content?: number;
  at_content?: number;
  transcripts?: GeneTranscript[];
  protein?: GeneProteinInfo | null;
  visualization?: GeneVisualization;
  source_url?: string;
  provider_url?: string;
  ncbi_url?: string;
  source?: string;
  last_synced_at?: string;
  raw?: unknown;
}

export interface PubMedResult {
  pmid: string;
  title: string;
  source: string;
  pubdate: string;
  authors: string[];
  doi?: string;
}

export interface SequenceAnalysis {
  sequence_length: number;
  gc_content_percent: number;
  base_counts: { A: number; T: number; G: number; C: number };
  reverse_complement: string;
  rna_sequence: string;
}

export interface FastaResult {
  accession: string;
  db: string;
  format: string;
  raw: string;
  parsed?: { header: string; sequence: string };
}

export interface GenBankResult {
  accession: string;
  db: string;
  format: string;
  raw: string;
}

// ── BLAST Similarity Search ────────────────────────────────────────────────────

export interface BlastHit {
  accession: string;
  description: string;
  e_value: number;
  identity_percent: number;
  query_coverage_percent: number;
  alignment_length: number;
  source: "ebi" | "uniprot" | string;
}

export interface SequenceSearchJob {
  job_id: string;
  status: "PENDING" | "RUNNING" | "FINISHED" | "ERROR" | "NOT_FOUND" | string;
  provider: string;
  sequence_type: string;
  database: string;
  hits?: BlastHit[];
  error?: string;
}

export interface HealthData {
  status: string;
  db: string;
  ncbi?: string;
}

export interface SystemStatus {
  uptime_seconds?: number;
  db_status?: string;
  cache_hits?: number;
  api_keys_configured?: number;
  [key: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  retryAfter?: number;

  constructor(message: string, status: number, code?: string, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function humanizeApiError(payload: unknown, status: number): { code?: string; message: string } {
  const detail = isRecord(payload) ? payload.detail : undefined;
  const detailRecord = isRecord(detail) ? detail : undefined;

  const code =
    (typeof detailRecord?.code === "string" && detailRecord.code) ||
    (isRecord(payload) && typeof payload.code === "string" ? payload.code : undefined);

  const rawMessage =
    (typeof detailRecord?.message === "string" && detailRecord.message) ||
    (typeof detail === "string" && detail) ||
    (isRecord(payload) && typeof payload.message === "string" ? payload.message : undefined);

  if (code === "NCBI_ACCESS_DENIED" || status === 403) {
    return {
      code: code || "NCBI_ACCESS_DENIED",
      message:
        "NCBI is temporarily rate limiting requests. The system will use cached data when available.",
    };
  }

  if (code === "NCBI_TIMEOUT" || status === 408 || status === 504) {
    return {
      code: code || "NCBI_TIMEOUT",
      message: "NCBI is responding too slowly. Please try again later.",
    };
  }

  if (status === 404) {
    return { code: code || "NOT_FOUND", message: rawMessage || "No matching data was found." };
  }

  if (status === 429) {
    return {
      code: code || "RATE_LIMITED",
      message: "The system is sending too many requests to the data source. Please try again later.",
    };
  }

  return {
    code,
    message: rawMessage || `Unable to load data from the backend (HTTP ${status}).`,
  };
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({ message: res.statusText }));
    const { code, message } = humanizeApiError(payload, res.status);
    let retryAfter: number | undefined;
    if (res.status === 429) {
      const ra = res.headers.get("Retry-After");
      if (ra) retryAfter = parseInt(ra, 10) || undefined;
    }
    throw new ApiError(message, res.status, code, retryAfter);
  }

  return res.json();
}

export interface SystemStats {
  genes_indexed: number | null;
  providers_active: number | null;
  providers_list?: string[];
  success_rate: number | null;
  queries_today: number | null;
  computed_at: string;
}

export const api = {
  health: (options?: RequestInit) => apiFetch<HealthData>("/api/v1/health", options),
  systemStatus: (options?: RequestInit) => apiFetch<SystemStatus>("/api/v1/system/status", options),
  systemStats: (options?: RequestInit) => apiFetch<SystemStats>("/api/v1/system/stats", options),

  searchGenes: (params: string | GeneSearchParams, options?: RequestInit) => {
    const normalized: GeneSearchParams =
      typeof params === "string" ? { q: params } : params;
    const query = new URLSearchParams({
      q: normalized.q,
      data_type: normalized.dataType || "gene",
      search_by: normalized.searchBy || "name",
      mode: normalized.mode || "local_first",
    });
    if (normalized.organism) query.set("organism", normalized.organism);
    if (normalized.provider) query.set("provider", normalized.provider);
    if (typeof normalized.fallback === "boolean") query.set("fallback", String(normalized.fallback));
    return apiFetch<GeneResult[]>(`/api/v1/genes/search?${query.toString()}`, options);
  },

  geneDetail: (geneId: string, options?: RequestInit) =>
    apiFetch<GeneDetail>(`/api/v1/genes/${encodeURIComponent(geneId)}`, options),

  searchPubmed: (q: string, options?: RequestInit) =>
    apiFetch<PubMedResult[]>(
      `/api/v1/pubmed/search?q=${encodeURIComponent(q)}`,
      options
    ),

  analyzeSequence: (sequence: string, options?: RequestInit) =>
    apiFetch<SequenceAnalysis>("/api/v1/sequence/analyze", {
      ...options,
      method: "POST",
      body: JSON.stringify({ sequence }),
    }),

  fetchFasta: (accession: string, db = "nuccore", options?: RequestInit) =>
    apiFetch<FastaResult>("/api/v1/sequence/fetch/fasta", {
      ...options,
      method: "POST",
      body: JSON.stringify({ accession, db }),
    }),

  fetchGenbank: (accession: string, db = "nuccore", options?: RequestInit) =>
    apiFetch<GenBankResult>("/api/v1/sequence/fetch/genbank", {
      ...options,
      method: "POST",
      body: JSON.stringify({ accession, db }),
    }),

  submitSequenceSearch: (
    payload: {
      sequence: string;
      sequence_type?: "auto" | "dna" | "protein";
      provider?: "auto" | "ebi" | "uniprot";
      database?: string;
    },
    options?: RequestInit
  ) =>
    apiFetch<SequenceSearchJob>("/api/v1/sequence/search/submit", {
      ...options,
      method: "POST",
      body: JSON.stringify(payload),
    }),

  checkSequenceSearchStatus: (jobId: string, options?: RequestInit) =>
    apiFetch<SequenceSearchJob>(
      `/api/v1/sequence/search/status/${encodeURIComponent(jobId)}`,
      options
    ),
};

export async function getGeneDetail(geneId: string): Promise<GeneDetail> {
  const response = await api.geneDetail(geneId);
  return response.data;
}
