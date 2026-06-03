"use client";

import { useState } from "react";
import { api, ApiResponse, FastaResult, GenBankResult, SequenceAnalysis } from "@/lib/api";
import { Badge, BarChart, Button, Card, CopyButton, EmptyState, ErrorBox, Input, MetaBadge, Spinner, StatCard, Textarea } from "./ui";

type SubTab = "analyze" | "fasta" | "genbank";

export default function SequenceTools() {
  const [subTab, setSubTab] = useState<SubTab>("analyze");

  return (
    <Card>
      <div className="card-header">
        <div>
          <h2 className="card-title">Sequence Tools</h2>
          <p className="card-description">
            Analyze DNA sequence composition or fetch FASTA and GenBank records.
          </p>
        </div>
        <Badge>DNA/RNA</Badge>
      </div>

      <div className="quick-row" style={{ marginBottom: 18 }}>
        {([
          ["analyze", "Analyze DNA"],
          ["fasta", "Fetch FASTA"],
          ["genbank", "Fetch GenBank"],
        ] as [SubTab, string][]).map(([key, label]) => (
          <Button key={key} variant={subTab === key ? "primary" : "secondary"} onClick={() => setSubTab(key)} type="button">
            {label}
          </Button>
        ))}
      </div>

      {subTab === "analyze" && <AnalyzePanel />}
      {subTab === "fasta" && <FastaPanel />}
      {subTab === "genbank" && <GenBankPanel />}
    </Card>
  );
}

function AnalyzePanel() {
  const [sequence, setSequence] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SequenceAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    const seq = sequence.trim().toUpperCase().replace(/\s+/g, "");
    if (!seq) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.analyzeSequence(seq);
      setResult(response.data);
    } catch (event) {
      setError(event instanceof Error ? event.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const totalBases = result
    ? result.base_counts.A + result.base_counts.T + result.base_counts.G + result.base_counts.C
    : 0;

  const baseItems = result
    ? [
        { label: "A", value: result.base_counts.A },
        { label: "T", value: result.base_counts.T },
        { label: "G", value: result.base_counts.G },
        { label: "C", value: result.base_counts.C },
      ]
    : [];

  return (
    <div>
      <Textarea
        value={sequence}
        onChange={(event) => setSequence(event.target.value)}
        placeholder="Paste DNA sequence here, e.g. ATGCGTACGATCGATCG..."
      />
      <div className="quick-row">
        <Button disabled={loading || sequence.trim().length === 0} onClick={analyze} type="button">
          {loading ? "Analyzing..." : "Analyze"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setSequence("ATGCGTACGATCGATCGGCATGCATCGTAGCATCGATCGTAGCATGCATCGATCG")}
          type="button"
        >
          Load sample
        </Button>
      </div>

      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}

      {result ? (
        <>
          <div className="stat-grid">
            <StatCard label="Length" value={`${result.sequence_length} bp`} />
            <StatCard label="GC Content" value={`${result.gc_content_percent}%`} />
            <StatCard label="AT Bases" value={result.base_counts.A + result.base_counts.T} />
            <StatCard label="GC Bases" value={result.base_counts.G + result.base_counts.C} />
          </div>

          <BarChart title={`Base composition (${totalBases} bases)`} items={baseItems} />

          <div className="grid two" style={{ marginTop: 18 }}>
            <div className="viz-block">
              <div className="card-header" style={{ marginBottom: 12 }}>
                <h3 className="viz-title" style={{ margin: 0 }}>Reverse complement</h3>
                <CopyButton text={result.reverse_complement} />
              </div>
              <code className="sequence-code">{result.reverse_complement}</code>
            </div>

            <div className="viz-block">
              <div className="card-header" style={{ marginBottom: 12 }}>
                <h3 className="viz-title" style={{ margin: 0 }}>RNA transcript</h3>
                <CopyButton text={result.rna_sequence} />
              </div>
              <code className="sequence-code">{result.rna_sequence}</code>
            </div>
          </div>
        </>
      ) : (
        <EmptyState title="No sequence analyzed" description="Paste a DNA sequence and click Analyze." />
      )}
    </div>
  );
}

function FastaPanel() {
  const [accession, setAccession] = useState("");
  const [db, setDb] = useState("nuccore");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse<FastaResult> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchRecord() {
    if (accession.trim().length < 2) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.fetchFasta(accession.trim(), db);
      setResult(response);
    } catch (event) {
      setError(event instanceof Error ? event.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FetchResultPanel
      title="FASTA record"
      accession={accession}
      setAccession={setAccession}
      db={db}
      setDb={setDb}
      loading={loading}
      error={error}
      raw={result?.data.raw}
      meta={result?.meta}
      onFetch={fetchRecord}
      sample="NC_045512.2"
    />
  );
}

function GenBankPanel() {
  const [accession, setAccession] = useState("");
  const [db, setDb] = useState("nuccore");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse<GenBankResult> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchRecord() {
    if (accession.trim().length < 2) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.fetchGenbank(accession.trim(), db);
      setResult(response);
    } catch (event) {
      setError(event instanceof Error ? event.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FetchResultPanel
      title="GenBank record"
      accession={accession}
      setAccession={setAccession}
      db={db}
      setDb={setDb}
      loading={loading}
      error={error}
      raw={result?.data.raw}
      meta={result?.meta}
      onFetch={fetchRecord}
      sample="NC_045512.2"
    />
  );
}

function FetchResultPanel({
  title,
  accession,
  setAccession,
  db,
  setDb,
  loading,
  error,
  raw,
  meta,
  onFetch,
  sample,
}: {
  title: string;
  accession: string;
  setAccession: (value: string) => void;
  db: string;
  setDb: (value: string) => void;
  loading: boolean;
  error: string | null;
  raw?: string;
  meta?: ApiResponse<unknown>["meta"];
  onFetch: () => void;
  sample: string;
}) {
  return (
    <div>
      <div className="form-row">
        <Input value={accession} onChange={(event) => setAccession(event.target.value)} placeholder="Accession ID" />
        <Input value={db} onChange={(event) => setDb(event.target.value)} placeholder="Database, e.g. nuccore" />
        <Button disabled={loading || accession.trim().length < 2} onClick={onFetch} type="button">
          {loading ? "Fetching..." : "Fetch"}
        </Button>
      </div>
      <div className="quick-row">
        <Button variant="secondary" onClick={() => setAccession(sample)} type="button">
          Use sample
        </Button>
      </div>

      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}

      {raw ? (
        <div className="viz-block">
          <div className="card-header" style={{ marginBottom: 12 }}>
            <h3 className="viz-title" style={{ margin: 0 }}>{title}</h3>
            <CopyButton text={raw} />
          </div>
          <MetaBadge source={meta?.source} cached={meta?.cached} stale={meta?.stale} />
          <code className="sequence-code">{raw}</code>
        </div>
      ) : (
        <EmptyState title="No record fetched" description="Enter an accession ID and fetch a record from NCBI." />
      )}
    </div>
  );
}
