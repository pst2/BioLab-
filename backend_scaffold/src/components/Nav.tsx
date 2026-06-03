"use client";

export type Tab = "dashboard" | "genes" | "pubmed" | "sequence" | "system";

const tabs: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Overview" },
  { key: "genes", label: "Genes" },
  { key: "pubmed", label: "PubMed" },
  { key: "sequence", label: "Sequence" },
  { key: "system", label: "System" },
];

export default function Nav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div>
            <p className="brand-title">BioLab</p>
            <p className="brand-subtitle">Minimal bioinformatics workspace</p>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="Main navigation">
          {tabs.map((tab) => (
            <button
              className={`nav-tab ${active === tab.key ? "active" : ""}`}
              key={tab.key}
              onClick={() => onChange(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
