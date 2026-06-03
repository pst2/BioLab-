const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "dev-key-1";

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
export type GeneSearchBy = "name" | "id";

export interface GeneSearchParams {
  q: string;
  dataType?: GeneDataType;
  searchBy?: GeneSearchBy;
  organism?: string;
  mode?: "local_first" | "local_only" | "external_refresh";
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
  ncbi_url?: string;
  last_synced_at?: string;
}

export interface GeneDetail {
  id?: string | number;
  gene_id?: string | number;
  symbol: string;
  name?: string;
  description?: string;
  organism?: string;
  summary?: string;
  chromosome?: string;
  aliases?: string[];
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

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
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
    throw new ApiError(message, res.status, code);
  }

  return res.json();
}

export const api = {
  health: (options?: RequestInit) => apiFetch<HealthData>("/api/v1/health", options),

  systemStatus: (options?: RequestInit) =>
    apiFetch<SystemStatus>("/api/v1/system/status", {
      ...options,
      headers: { "X-API-Key": API_KEY, ...options?.headers },
    }),

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
};

export async function getGeneDetail(geneId: string): Promise<GeneDetail> {
  const response = await api.geneDetail(geneId);
  return response.data;
}
