"use client";

import { Badge, Card, StatCard } from "./ui";
import type { Tab } from "./Nav";

const modules: { tab: Tab; title: string; description: string; tag: string }[] = [
  {
    tab: "genes",
    title: "Gene Search",
    description: "Search genes, inspect organism distribution and open in-app gene detail pages.",
    tag: "NCBI Gene",
  },
  {
    tab: "pubmed",
    title: "PubMed Literature",
    description: "Explore PubMed articles with publication timeline and journal distribution.",
    tag: "PubMed",
  },
  {
    tab: "sequence",
    title: "Sequence Analysis",
    description: "Analyze DNA sequence length, GC content, base composition and NCBI records.",
    tag: "DNA/RNA",
  },
  {
    tab: "system",
    title: "System Status",
    description: "Check backend health, database status, cache and API configuration.",
    tag: "FastAPI",
  },
];

export default function Dashboard({
  health,
  healthData,
  onNavigate,
}: {
  health: boolean | null;
  healthData: Record<string, unknown> | null;
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <>
      <section className="hero">
        <div className="eyebrow">Bioinformatics Workspace</div>
        <h1>Explore biological data with clarity.</h1>
        <p>
          A minimal interface for gene lookup, PubMed literature discovery and sequence analysis,
          powered by your FastAPI backend.
        </p>
        <div className="health-pill">
          <span className={`dot ${health === true ? "ok" : health === false ? "bad" : "warn"}`} />
          {health === null && "Checking backend..."}
          {health === true && "Backend online"}
          {health === false && "Backend offline"}
        </div>
      </section>

      <div className="stat-grid">
        <StatCard label="Backend" value={health ? "Online" : health === false ? "Offline" : "..."} />
        <StatCard label="Database" value={String(healthData?.db ?? "Unknown")} />
        <StatCard label="NCBI" value={String(healthData?.ncbi ?? "Unknown")} />
        <StatCard label="Modules" value="4" />
      </div>

      <div style={{ marginTop: 22 }} className="grid two">
        {modules.map((module) => (
          <button
            className="card clickable"
            key={module.tab}
            onClick={() => onNavigate(module.tab)}
            type="button"
          >
            <div className="card-header">
              <div>
                <h2 className="card-title">{module.title}</h2>
                <p className="card-description">{module.description}</p>
              </div>
              <Badge>{module.tag}</Badge>
            </div>
            <span className="small muted">Open module →</span>
          </button>
        ))}
      </div>
    </>
  );
}
