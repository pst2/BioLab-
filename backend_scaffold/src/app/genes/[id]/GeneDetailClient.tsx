"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, GeneDetail } from "@/lib/api";

const GENE_CACHE_PREFIX = "biolab:gene:";

function normalizeGene(id: string, gene: Partial<GeneDetail>): GeneDetail {
  const geneId = String(gene.id ?? gene.gene_id ?? id);

  return {
    gene_id: geneId,
    symbol: gene.symbol || gene.name || `Gene ${geneId}`,
    name: gene.name,
    description: gene.description || gene.summary || "No description available.",
    organism: gene.organism || "Unknown",
    summary: gene.summary || gene.description || "No summary available.",
    chromosome: gene.chromosome || "Unknown",
    aliases: Array.isArray(gene.aliases) ? gene.aliases : [],
    ncbi_url: gene.ncbi_url || `https://www.ncbi.nlm.nih.gov/gene/${geneId}`,
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
  } catch {
    // Ignore storage failures; the detail page still works without browser cache.
  }
}

export default function GeneDetailClient({ id }: { id: string }) {
  const [gene, setGene] = useState<GeneDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingBrowserCache, setUsingBrowserCache] = useState(false);

  const geneId = useMemo(() => String(gene?.id ?? gene?.gene_id ?? id), [gene, id]);

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

      const message = event instanceof Error ? event.message : "Unable to load gene details.";
      setError(cached ? `${message} Showing temporarily cached browser data.` : message);

      if (!cached) {
        setGene(null);
        setUsingBrowserCache(false);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    fetchGeneDetail(controller.signal);
    return () => controller.abort();
  }, [fetchGeneDetail]);

  return (
    <main className="min-h-screen bg-[#e9e8e6] px-4 py-8 text-neutral-950 md:px-8">
      <div className="mx-auto max-w-5xl rounded-[2rem] bg-[#f7f6f3] p-4 shadow-[0_24px_80px_rgba(23,23,23,0.10)] ring-1 ring-black/5">
        <div className="rounded-[1.75rem] bg-white p-8">
          <Link href="/" className="inline-flex rounded-full border border-neutral-200 px-4 py-2 text-sm font-bold text-neutral-600 transition hover:bg-neutral-50">
            ← Back to dashboard
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {loading && <StatusBadge>Loading data...</StatusBadge>}
            {usingBrowserCache && <StatusBadge>Cached data</StatusBadge>}
            {gene?.source && <StatusBadge>Source: {gene.source}</StatusBadge>}
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => fetchGeneDetail()}
                disabled={loading}
                className="mt-3 rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-black text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Retrying..." : "Retry"}
              </button>
            </div>
          )}

          {!gene && !loading && !error && (
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm font-semibold text-neutral-700">
              No detailed data was found for this gene.
            </div>
          )}

          {gene && (
            <div className="mt-10 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-400">NCBI Gene ID {geneId}</p>
                <h1 className="mt-3 text-5xl font-black tracking-tight">{gene.symbol || gene.name || `Gene ${geneId}`}</h1>
                <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-600">{gene.description || "No description available."}</p>
              </div>

              <a
                href={gene.ncbi_url || `https://www.ncbi.nlm.nih.gov/gene/${geneId}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-neutral-950 px-5 py-3 text-sm font-black text-white"
              >
                View on NCBI ↗
              </a>
            </div>
          )}
        </div>

        {gene && (
          <>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Info label="Organism" value={gene.organism || "Unknown"} />
              <Info label="Chromosome" value={gene.chromosome || "Unknown"} />
              <Info label="Gene ID" value={geneId} />
            </div>

            <section className="mt-4 rounded-[1.75rem] bg-white p-8">
              <h2 className="text-2xl font-black">Summary</h2>
              <p className="mt-4 leading-8 text-neutral-600">{gene.summary || "No summary available."}</p>
            </section>

            <section className="mt-4 rounded-[1.75rem] bg-white p-8">
              <h2 className="text-2xl font-black">Aliases</h2>
              {gene.aliases?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {gene.aliases.map((alias) => (
                    <span key={alias} className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-bold text-neutral-600">
                      {alias}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-neutral-500">No aliases available.</p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function StatusBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-neutral-500">
      {children}
    </span>
  );
}
