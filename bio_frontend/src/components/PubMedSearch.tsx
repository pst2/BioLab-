"use client";

import { useMemo, useState } from "react";
import { api, ApiResponse, PubMedResult } from "@/lib/api";
import { Badge, BarChart, Button, Card, EmptyState, ErrorBox, MetaBadge, SearchInput, Spinner, StatCard } from "./ui";

function extractYear(pubdate: string) {
  const match = pubdate?.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "Unknown";
}

function countTop(items: string[], limit = 8) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item || "Unknown", (counts.get(item || "Unknown") || 0) + 1);
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function buildBibtexUrl(article: PubMedResult): string {
  const params = new URLSearchParams({
    pmid: article.pmid,
    title: article.title || "",
    authors: (article.authors || []).join(", "),
    journal: article.source || "",
    year: article.pubdate || "",
    doi: article.doi || "",
  });
  return `/api/backend/api/v1/export/citation/bibtex?${params.toString()}`;
}

function buildRisUrl(article: PubMedResult): string {
  const params = new URLSearchParams({
    pmid: article.pmid,
    title: article.title || "",
    authors: (article.authors || []).join(", "),
    journal: article.source || "",
    year: article.pubdate || "",
    doi: article.doi || "",
    abstract: article.abstract || "",
  });
  return `/api/backend/api/v1/export/citation/ris?${params.toString()}`;
}

export default function PubMedSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse<PubMedResult[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedAbstracts, setExpandedAbstracts] = useState<Set<string>>(new Set());

  const articles = Array.isArray(result?.data) ? result.data : [];
  const years = useMemo(() => countTop(articles.map((article) => extractYear(article.pubdate)), 10), [articles]);
  const journals = useMemo(() => countTop(articles.map((article) => article.source), 8), [articles]);
  const withAbstracts = useMemo(() => articles.filter((a) => a.abstract && a.abstract.length > 0).length, [articles]);

  function toggleAbstract(pmid: string) {
    setExpandedAbstracts((prev) => {
      const next = new Set(prev);
      if (next.has(pmid)) next.delete(pmid);
      else next.add(pmid);
      return next;
    });
  }

  async function search() {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setExpandedAbstracts(new Set());

    try {
      const response = await api.searchPubmed(query.trim());
      setResult(response);
    } catch (event) {
      setError(event instanceof Error ? event.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="card-header">
        <div>
          <h2 className="card-title">PubMed Search</h2>
          <p className="card-description">
            Search biomedical literature with full abstracts, MeSH terms, and citation export.
          </p>
        </div>
        <Badge>Literature</Badge>
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        onSubmit={search}
        placeholder="Enter medical term or gene name, e.g. cancer, BRCA1, covid"
        loading={loading}
      />

      <div className="quick-row">
        {["cancer", "BRCA1", "CRISPR Cas9", "covid"].map((example) => (
          <Button key={example} variant="secondary" onClick={() => setQuery(example)} type="button">
            {example}
          </Button>
        ))}
      </div>

      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}

      {result && !loading && (
        <>
          <div className="stat-grid">
            <StatCard label="Articles" value={articles.length} />
            <StatCard label="With Abstract" value={withAbstracts} />
            <StatCard label="Journals" value={journals.length} />
            <StatCard label="With DOI" value={articles.filter((article) => article.doi).length} />
          </div>

          <MetaBadge source={result.meta?.source} cached={result.meta?.cached} stale={result.meta?.stale} />

          {articles.length > 0 && (
            <div className="grid two" style={{ marginTop: 18 }}>
              <BarChart title="Publication timeline" items={years} />
              <BarChart title="Top journals" items={journals} />
            </div>
          )}

          {articles.length === 0 ? (
            <EmptyState title="No articles found" description={`No PubMed records for "${query}".`} />
          ) : (
            <div className="result-list">
              {articles.map((article, index) => (
                <article className="result-card" key={article.pmid || index}>
                  <div className="card-header" style={{ marginBottom: 0 }}>
                    <div style={{ flex: 1 }}>
                      <h3 className="result-title">{article.title}</h3>
                      <div className="result-meta">
                        <span>PMID: {article.pmid}</span>
                        <span>{article.source || "Unknown journal"}</span>
                        <span>{article.pubdate || "Unknown date"}</span>
                      </div>
                      {article.authors?.length > 0 && (
                        <p className="small muted" style={{ marginTop: 10 }}>
                          {article.authors.slice(0, 5).join(", ")}
                          {article.authors.length > 5 ? ` +${article.authors.length - 5} more` : ""}
                        </p>
                      )}

                      {/* Abstract (collapsible) */}
                      {article.abstract && (
                        <div style={{ marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={() => toggleAbstract(article.pmid)}
                            className="small"
                            style={{
                              cursor: "pointer",
                              background: "none",
                              border: "none",
                              color: "var(--accent, #06b6d4)",
                              fontWeight: 600,
                              fontSize: 12,
                              padding: 0,
                            }}
                          >
                            {expandedAbstracts.has(article.pmid) ? "▾ Hide Abstract" : "▸ Show Abstract"}
                          </button>
                          {expandedAbstracts.has(article.pmid) && (
                            <p
                              className="small"
                              style={{
                                marginTop: 8,
                                padding: "12px 14px",
                                background: "var(--card-hover, rgba(255,255,255,0.04))",
                                borderRadius: 8,
                                lineHeight: 1.6,
                                color: "var(--text-secondary, #94a3b8)",
                                borderLeft: "3px solid var(--accent, #06b6d4)",
                              }}
                            >
                              {article.abstract}
                            </p>
                          )}
                        </div>
                      )}

                      {/* MeSH terms */}
                      {article.mesh_terms && article.mesh_terms.length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {article.mesh_terms.slice(0, 6).map((term) => (
                            <span
                              key={term}
                              style={{
                                fontSize: 10,
                                padding: "2px 8px",
                                borderRadius: 12,
                                background: "rgba(6,182,212,0.12)",
                                color: "var(--accent, #06b6d4)",
                                fontWeight: 500,
                              }}
                            >
                              {term}
                            </span>
                          ))}
                          {article.mesh_terms.length > 6 && (
                            <span style={{ fontSize: 10, color: "var(--text-muted, #64748b)" }}>
                              +{article.mesh_terms.length - 6} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* DOI + Citation Export */}
                      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        {article.doi && (
                          <a className="small muted" href={`https://doi.org/${article.doi}`} target="_blank" rel="noreferrer">
                            DOI: {article.doi}
                          </a>
                        )}
                        <a
                          href={buildBibtexUrl(article)}
                          target="_blank"
                          rel="noreferrer"
                          className="small"
                          style={{
                            fontSize: 11,
                            padding: "2px 10px",
                            borderRadius: 6,
                            background: "rgba(99,102,241,0.15)",
                            color: "#818cf8",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          BibTeX
                        </a>
                        <a
                          href={buildRisUrl(article)}
                          target="_blank"
                          rel="noreferrer"
                          className="small"
                          style={{
                            fontSize: 11,
                            padding: "2px 10px",
                            borderRadius: 6,
                            background: "rgba(34,197,94,0.15)",
                            color: "#4ade80",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          RIS
                        </a>
                      </div>
                    </div>
                    <a
                      className="button secondary"
                      href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      PubMed ↗
                    </a>
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
