"use client";

import * as React from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return <button className={`button ${variant} ${className}`} {...props} />;
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="textarea" {...props} />;
}

export function Spinner() {
  return <div className="spinner" aria-label="Loading" />;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="alert">{message}</div>;
}

export function EmptyState({
  title = "No results yet",
  description = "Run a query to see results here.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p style={{ margin: "6px 0 0" }}>{description}</p>
    </div>
  );
}

export function MetaBadge({
  source,
  cached,
  stale,
}: {
  source?: string;
  cached?: boolean;
  stale?: boolean;
}) {
  if (!source && !cached && !stale) return null;

  return (
    <div className="quick-row">
      {source && <Badge>{source}</Badge>}
      {cached && <Badge>Cached</Badge>}
      {stale && <Badge>Stale</Badge>}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  loading,
  minLength = 2,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  loading: boolean;
  minLength?: number;
}) {
  return (
    <div className="form-row">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !loading && value.trim().length >= minLength) onSubmit();
        }}
        placeholder={placeholder}
      />
      <Button disabled={loading || value.trim().length < minLength} onClick={onSubmit}>
        {loading ? "Searching..." : "Search"}
      </Button>
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <Button variant="secondary" onClick={copy} type="button">
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function BarChart({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="viz-block">
      <h3 className="viz-title">{title}</h3>
      {items.length === 0 ? (
        <p className="small muted">No visualization data available.</p>
      ) : (
        items.map((item) => {
          const width = Math.max(4, Math.round((item.value / max) * 100));

          return (
            <div className="bar-row" key={item.label}>
              <span title={item.label}>{item.label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${width}%` }} />
              </div>
              <strong>{item.value}</strong>
            </div>
          );
        })
      )}
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
