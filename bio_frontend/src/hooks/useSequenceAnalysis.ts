"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import { api, SequenceAnalysis } from "@/lib/api";
import { useToast } from "@/lib/Toast";
import { Translate } from "@/lib/i18n";

export function useSequenceAnalysis(t: Translate) {
  const [sequence, setSequence] = useState("ATGCGTACGTAGCTAGCTAGCGCGCGTTAA");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SequenceAnalysis | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const toast = useToast();
  const abortRef = useRef<AbortController | null>(null);

  const runAnalysis = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      const seq = sequence.trim();
      if (!seq) return;

      // Abort any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError("");
      setElapsed(null);
      const start = performance.now();

      try {
        const response = await api.analyzeSequence(seq, {
          signal: controller.signal,
        });
        const ms = Math.round(performance.now() - start);
        setResult(response.data);
        setElapsed(ms);
        toast.success(t("toast.analysisComplete"));
      } catch (err) {
        // Ignore aborted requests
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg =
          err instanceof Error ? err.message : "Sequence analysis failed";
        setError(msg);
        toast.error(msg);
      } finally {
        if (abortRef.current === controller) {
          setLoading(false);
        }
      }
    },
    [sequence, t, toast]
  );

  return {
    sequence,
    setSequence,
    loading,
    error,
    result,
    elapsed,
    runAnalysis,
  };
}
