"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiResponse, GeneResult } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { Badge, BarChart, Button, Card, EmptyState, ErrorBox, MetaBadge, SearchInput, Spinner, StatCard } from "./ui";

const MIN_QUERY_LENGTH = 3;
const GENE_CACHE_PREFIX = "biolab:gene:";

function countByOrganism(genes: GeneResult[]) {
  const counts = new Map<string, number>();
  for (const gene of genes) {
    const label = gene.organism || "Unknown";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function externalLinkForGene(gene: GeneResult) {
  const id = String(gene.gene_id || gene.external_id || gene.id || "");
  const source = String(gene.source || gene.database || "").toLowerCase();
  if (source === "ensembl") {
    return { label: "Ensembl ↗", href: gene.source_url || gene.provider_url || `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${id}` };
  }
  if (source === "uniprot" || gene.database === "uniprotkb") {
    return { label: "UniProt ↗", href: gene.source_url || gene.provider_url || `https://www.uniprot.org/uniprotkb/${id}/entry` };
  }
  if (source === "bvbrc") {
    return { label: "BV-BRC ↗", href: gene.source_url || gene.provider_url || "https://www.bv-brc.org/" };
  }
  return { label: "NCBI ↗", href: gene.ncbi_url || gene.source_url || `https://www.ncbi.nlm.nih.gov/gene/${id}` };
}

function rememberGene(gene: GeneResult) {
  if (typeof window === "undefined" || !gene.gene_id) return;

  try {
    window.sessionStorage.setItem(
      `${GENE_CACHE_PREFIX}${gene.gene_id}`,
      JSON.stringify({
        ...gene,
        summary: gene.description || gene.name || "Temporary data from search results.",
        chromosome: "Unknown",
        aliases: [],
        ncbi_url: gene.ncbi_url,
        source_url: gene.source_url,
        provider_url: gene.provider_url,
        source: gene.source || gene.database || "browser-cache",
      })
    );
  } catch {
    // Browser storage can be unavailable in private mode; navigation should still work.
  }
}

export default function GeneSearch() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 600);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse<GeneResult[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSearchedQuery = useRef("");

  const genes = Array.isArray(result?.data) ? result.data : [];
  const organismData = useMemo(() => countByOrganism(genes), [genes]);
  const trimmedQuery = query.trim();
  const debouncedTrimmedQuery = debouncedQuery.trim();
  const showMinLengthHint = trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY_LENGTH;

  const runSearch = useCallback(async (term: string, signal?: AbortSignal) => {
    const normalizedTerm = term.trim();

    if (normalizedTerm.length < MIN_QUERY_LENGTH) {
      setLoading(false);
      setError(null);
      setResult(null);
      return;
    }

    lastSearchedQuery.current = normalizedTerm;
    setLoading(true);
    setError(null);

    try {
      const response = await api.searchGenes(normalizedTerm, { signal });
      setResult(response);
    } catch (event) {
      if (event instanceof DOMException && event.name === "AbortError") return;
      setError(event instanceof Error ? event.message : "Unable to load gene data. Please try again.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const normalizedTerm = debouncedTrimmedQuery;

    if (normalizedTerm.length < MIN_QUERY_LENGTH) {
      lastSearchedQuery.current = "";
      setLoading(false);
      setResult(null);
      setError(null);
      return;
    }

    if (normalizedTerm === lastSearchedQuery.current) return;

    const controller = new AbortController();
    runSearch(normalizedTerm, controller.signal);

    return () => controller.abort();
  }, [debouncedTrimmedQuery, runSearch]);

  function handleSubmit() {
    if (trimmedQuery.length < MIN_QUERY_LENGTH || loading) return;
    runSearch(trimmedQuery);
  }

  return (
    <Card>
      <div className="card-header">
        <div>
          <h2 className="card-title">Gene Search</h2>
          <p className="card-description">
            Search NCBI Gene and open detail pages directly inside BioLab.
          </p>
        </div>
        <Badge>NCBI Gene</Badge>
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        onSubmit={handleSubmit}
        placeholder="Enter at least 3 characters, e.g. BRCA1, TP53, EGFR"
        loading={loading}
        minLength={MIN_QUERY_LENGTH}
      />

      {showMinLengthHint && (
        <p className="small muted" style={{ marginTop: 8 }}>
          Enter at least {MIN_QUERY_LENGTH} characters to search and avoid sending too many requests to NCBI.
        </p>
      )}

      <div className="quick-row">
        {["BRCA1", "TP53", "EGFR"].map((example) => (
          <Button key={example} variant="secondary" onClick={() => setQuery(example)} type="button" disabled={loading}>
            {example}
          </Button>
        ))}
      </div>

      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}

      {result && !loading && (
        <>
          <div className="stat-grid">
            <StatCard label="Results" value={genes.length} />
            <StatCard label="Organisms" value={organismData.length} />
            <StatCard label="Source" value={result.meta?.source ?? "API"} />
            <StatCard label="Cache" value={result.meta?.cached ? "Yes" : "No"} />
          </div>

          <MetaBadge source={result.meta?.source} cached={result.meta?.cached} stale={result.meta?.stale} />

          {genes.length > 0 && (
            <BarChart title="Organism distribution" items={organismData} />
          )}

          {genes.length === 0 ? (
            <EmptyState title="No genes found" description={`No results for "${debouncedTrimmedQuery}".`} />
          ) : (
            <div className="result-list">
              {genes.map((gene, index) => (
                <article className="result-card" key={gene.gene_id || index}>
                  <div className="card-header" style={{ marginBottom: 0 }}>
                    <div>
                      <Link href={`/genes/${gene.gene_id}`} onClick={() => rememberGene(gene)}>
                        <h3 className="result-title">{gene.symbol || gene.name || `Gene ${gene.gene_id}`}</h3>
                      </Link>
                      <p className="card-description">{gene.description || gene.name || "No description available."}</p>
                      <div className="result-meta">
                        <span>ID: {gene.gene_id}</span>
                        <span>Organism: {gene.organism || "Unknown"}</span>
                      </div>
                    </div>

                    <div className="quick-row" style={{ justifyContent: "flex-end", marginTop: 0 }}>
                      <Link className="button secondary" href={`/genes/${gene.gene_id}`} onClick={() => rememberGene(gene)}>
                        Details
                      </Link>
                      {(() => {
                        const external = externalLinkForGene(gene);
                        return (
                          <a
                            className="button ghost"
                            href={external.href}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {external.label}
                          </a>
                        );
                      })()}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
