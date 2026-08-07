"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, GeneDataType, GeneProvider, GeneResult, GeneSearchBy } from "@/lib/api";
import { useToast } from "@/lib/Toast";
import { Translate } from "@/lib/i18n";

export type SearchMode = "local_first" | "local_only" | "external_refresh";

const SEARCH_STATE_KEY = "biolab:search_state";

export function useGeneSearch(t: Translate) {
  const [query, setQuery] = useState("BRCA1");
  const [dataType, setDataType] = useState<GeneDataType>("gene");
  const [searchBy, setSearchBy] = useState<GeneSearchBy>("name");
  const [organism, setOrganism] = useState("");
  const [mode, setMode] = useState<SearchMode>("local_first");
  const [provider, setProvider] = useState<GeneProvider>("auto");
  const [fallbackEnabled, setFallbackEnabled] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [genes, setGenes] = useState<GeneResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const toast = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.sessionStorage.getItem(SEARCH_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.query !== undefined) setQuery(parsed.query);
        if (parsed.dataType) setDataType(parsed.dataType);
        if (parsed.searchBy) setSearchBy(parsed.searchBy);
        if (parsed.organism !== undefined) setOrganism(parsed.organism);
        if (parsed.mode) setMode(parsed.mode);
        if (parsed.provider) setProvider(parsed.provider);
        if (parsed.fallbackEnabled !== undefined) setFallbackEnabled(parsed.fallbackEnabled);
        if (Array.isArray(parsed.genes) && parsed.genes.length > 0) setGenes(parsed.genes);
        if (parsed.geneMessage) setMessage(parsed.geneMessage);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        SEARCH_STATE_KEY,
        JSON.stringify({
          query,
          dataType,
          searchBy,
          organism,
          mode,
          provider,
          fallbackEnabled,
          genes,
          geneMessage: message,
        })
      );
    } catch {}
  }, [query, dataType, searchBy, organism, mode, provider, fallbackEnabled, genes, message]);

  async function runSearch(event?: FormEvent, override?: Partial<{ q: string; mode: SearchMode }>) {
    event?.preventDefault();
    const q = (override?.q ?? query).trim();
    if (!q) return;
    setQuery(q);
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.searchGenes({
        q,
        dataType,
        searchBy,
        organism: organism.trim() || undefined,
        mode: override?.mode ?? mode,
        provider,
        fallback: fallbackEnabled,
      });
      const results = response.data || [];
      setGenes(results);
      const msg = response.message || `Found ${results.length} matching records.`;
      setMessage(msg);
      if (results.length > 0) {
        toast.success(`${t("toast.searchSuccess")}: ${results.length}`);
      } else {
        toast.info(t("toast.searchEmpty"));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Search failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return {
    query,
    setQuery,
    dataType,
    setDataType,
    searchBy,
    setSearchBy,
    organism,
    setOrganism,
    mode,
    setMode,
    provider,
    setProvider,
    fallbackEnabled,
    setFallbackEnabled,
    showFilters,
    setShowFilters,
    genes,
    loading,
    error,
    message,
    runSearch,
  };
}
