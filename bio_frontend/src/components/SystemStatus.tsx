"use client";

import { useState } from "react";
import { api, HealthData, SystemStatus } from "@/lib/api";
import { Badge, Button, Card, ErrorBox, Spinner, StatCard } from "./ui";

export default function SystemStatusPage() {
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const [healthResponse, statusResponse] = await Promise.all([
        api.health(),
        api.systemStatus(),
      ]);
      setHealth(healthResponse.data);
      setStatus(statusResponse.data);
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
          <h2 className="card-title">System Status</h2>
          <p className="card-description">
            Check FastAPI health, database status and runtime configuration.
          </p>
        </div>
        <Badge>Backend</Badge>
      </div>

      <Button onClick={refresh} disabled={loading} type="button">
        {loading ? "Refreshing..." : "Refresh status"}
      </Button>

      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}

      <div className="stat-grid">
        <StatCard label="Health" value={health?.status ?? "Unknown"} />
        <StatCard label="Database" value={health?.db ?? status?.db_status ?? "Unknown"} />
        <StatCard label="NCBI" value={health?.ncbi ?? "Unknown"} />
        <StatCard label="Cache hits" value={String(status?.cache_hits ?? "—")} />
      </div>

      {status && (
        <div className="viz-block">
          <h3 className="viz-title">Raw status payload</h3>
          <code className="sequence-code">{JSON.stringify(status, null, 2)}</code>
        </div>
      )}
    </Card>
  );
}
