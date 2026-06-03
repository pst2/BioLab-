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

export default function PubMedSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse<PubMedResult[]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const articles = Array.isArray(result?.data) ? result.data : [];
  const years = useMemo(() => countTop(articles.map((article) => extractYear(article.pubdate)), 10), [articles]);
  const journals = useMemo(() => countTop(articles.map((article) => article.source), 8), [articles]);

  async function search() {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    setResult(null);

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
            Search biomedical literature and visualize publication years and journal sources.
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
        {["cancer", "BRCA1", "covid"].map((example) => (
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
            <StatCard label="Years" value={years.length} />
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
                    <div>
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
                      {article.doi && (
                        <a className="small muted" href={`https://doi.org/${article.doi}`} target="_blank" rel="noreferrer">
                          DOI: {article.doi}
                        </a>
                      )}
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
