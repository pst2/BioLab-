"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api, BlastHit } from "@/lib/api";
import { useToast } from "@/lib/Toast";

import { Translate } from "@/lib/i18n";

export interface BlastHistoryItem {
  id: string;
  timestamp: number;
  seq: string;
  sequencePreview: string;
  seqType: "auto" | "dna" | "protein";
  provider: "auto" | "ebi" | "uniprot";
  database: string;
  evalueCutoff: number;
  matrix: string;
  gapOpen?: number;
  gapExtend?: number;
  hitCount: number;
  topHit?: {
    accession: string;
    description: string;
    identityPercent?: number;
    eValue?: number;
  };
  hits: BlastHit[];
}

const BLAST_HISTORY_KEY = "biolab:blast_history";
const BLAST_SESSION_KEY = "biolab:blast_active_state";

export function useBlastSearch(t?: Translate) {
  const [seq, setSeq] = useState("");
  const [provider, setProvider] = useState<"auto" | "ebi" | "uniprot">("auto");
  const [seqType, setSeqType] = useState<"auto" | "dna" | "protein">("auto");
  const [database, setDatabase] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [hits, setHits] = useState<BlastHit[]>([]);
  const [error, setError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [evalueCutoff, setEvalueCutoff] = useState<number>(10);
  const [matrix, setMatrix] = useState<string>("BLOSUM62");
  const [gapOpen, setGapOpen] = useState<number | undefined>(undefined);
  const [gapExtend, setGapExtend] = useState<number | undefined>(undefined);

  const [history, setHistory] = useState<BlastHistoryItem[]>([]);

  const pollCount = useRef(0);
  const timerRef = useRef<any>(null);
  const toast = useToast();

  // Restore history and active session state on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedHistory = localStorage.getItem(BLAST_HISTORY_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory) as BlastHistoryItem[]);
      }
    } catch {
      // ignore storage parsing error
    }

    try {
      const savedSession = sessionStorage.getItem(BLAST_SESSION_KEY);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed.seq) setSeq(parsed.seq);
        if (parsed.provider) setProvider(parsed.provider);
        if (parsed.seqType) setSeqType(parsed.seqType);
        if (parsed.database !== undefined) setDatabase(parsed.database);
        if (parsed.evalueCutoff !== undefined) setEvalueCutoff(parsed.evalueCutoff);
        if (parsed.matrix) setMatrix(parsed.matrix);
        if (parsed.gapOpen !== undefined) setGapOpen(parsed.gapOpen);
        if (parsed.gapExtend !== undefined) setGapExtend(parsed.gapExtend);
        if (Array.isArray(parsed.hits) && parsed.hits.length > 0) {
          setHits(parsed.hits);
          setStatus(parsed.status || "FINISHED");
        }
      }
    } catch {
      // ignore session parsing error
    }
  }, []);

  // Save active session state whenever search inputs or hits change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (seq.trim() || hits.length > 0) {
        sessionStorage.setItem(
          BLAST_SESSION_KEY,
          JSON.stringify({
            seq,
            provider,
            seqType,
            database,
            evalueCutoff,
            matrix,
            gapOpen,
            gapExtend,
            hits,
            status,
          })
        );
      }
    } catch {
      // ignore storage quota error
    }
  }, [seq, provider, seqType, database, evalueCutoff, matrix, gapOpen, gapExtend, hits, status]);

  // Tick elapsed seconds while loading
  useEffect(() => {
    if (loading) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  const saveToHistory = (
    currentSeq: string,
    currentSeqType: "auto" | "dna" | "protein",
    currentProvider: "auto" | "ebi" | "uniprot",
    currentDb: string,
    currentHits: BlastHit[]
  ) => {
    if (typeof window === "undefined" || !currentSeq.trim()) return;
    const clean = currentSeq.trim();
    const item: BlastHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      seq: clean,
      sequencePreview: clean.slice(0, 40) + (clean.length > 40 ? "..." : ""),
      seqType: currentSeqType,
      provider: currentProvider,
      database: currentDb,
      evalueCutoff,
      matrix,
      gapOpen,
      gapExtend,
      hitCount: currentHits.length,
      topHit: currentHits[0]
        ? {
            accession: currentHits[0].accession,
            description: currentHits[0].description,
            identityPercent: currentHits[0].identity_percent,
            eValue: currentHits[0].e_value,
          }
        : undefined,
      hits: currentHits,
    };

    setHistory((prev) => {
      // Filter out duplicate identical sequence searches
      const filtered = prev.filter((p) => p.seq !== clean);
      const updated = [item, ...filtered].slice(0, 20);
      try {
        localStorage.setItem(BLAST_HISTORY_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  useEffect(() => {
    if (!jobId || status === "FINISHED" || status === "ERROR" || status === "NOT_FOUND" || status === "idle") return;
    pollCount.current = 0;
    let consecutiveErrors = 0;
    const MAX_POLLS = 100; // ~4 minutes max at 2.5s interval
    const intervalId = setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current > MAX_POLLS) {
        setStatus("ERROR");
        setError(t ? t("toast.blastTimedOut") : "BLAST search timed out. Please try again or select a local provider.");
        setLoading(false);
        clearInterval(intervalId);
        return;
      }
      try {
        const res = await api.checkSequenceSearchStatus(jobId);
        consecutiveErrors = 0;
        const job = res.data;
        if (job) {
          if (job.status === "FINISHED") {
            setStatus("FINISHED");
            const hitResults = job.hits || [];
            setHits(hitResults);
            setLoading(false);
            saveToHistory(seq, seqType, provider, database, hitResults);
            const successMsg = t
              ? t("toast.blastComplete").replace("{count}", String(hitResults.length))
              : `BLAST search complete — ${hitResults.length} alignments found`;
            toast.success(successMsg);
            clearInterval(intervalId);
          } else if (job.status === "ERROR" || job.status === "NOT_FOUND") {
            setStatus(job.status);
            setError(job.error || res.message || (t ? t("blast.failed") : "BLAST search failed."));
            setLoading(false);
            clearInterval(intervalId);
          } else {
            setStatus(job.status || "RUNNING");
          }
        }
      } catch (err) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 6) {
          setStatus("ERROR");
          const msg = err instanceof Error ? err.message : (t ? t("blast.failed") : "Connection lost while polling BLAST status.");
          setError(msg);
          setLoading(false);
          clearInterval(intervalId);
        }
      }
    }, 2500);

    return () => clearInterval(intervalId);
  }, [jobId, status, toast, t, seq, seqType, provider, database]);

  async function submitJob(event?: FormEvent) {
    event?.preventDefault();
    const cleanSeq = seq.trim();
    if (!cleanSeq) return;
    setLoading(true);
    setError("");
    setHits([]);
    setJobId(null);
    setStatus("SUBMITTING");

    try {
      const response = await api.submitSequenceSearch({
        sequence: cleanSeq,
        sequence_type: seqType,
        provider,
        database: database.trim() || undefined,
        evalue_cutoff: evalueCutoff,
        matrix: matrix || undefined,
        gap_open: gapOpen,
        gap_extend: gapExtend,
      });

      if (!response.success || !response.data?.job_id) {
        const errorMsg =
          response.message || (t ? t("blast.failed") : "Failed to submit BLAST job");
        setError(errorMsg);
        setStatus("ERROR");
        setLoading(false);
        toast.error(errorMsg);
        return;
      }

      const job = response.data;
      setJobId(job.job_id);

      // If already finished (e.g. cached or instant mock)
      if (job.status === "FINISHED") {
        setStatus("FINISHED");
        const hitResults = job.hits || [];
        setHits(hitResults);
        setLoading(false);
        saveToHistory(cleanSeq, seqType, provider, database, hitResults);
        const successMsg = t
          ? t("toast.blastComplete").replace("{count}", String(hitResults.length))
          : `BLAST search complete — ${hitResults.length} alignments found`;
        toast.success(successMsg);
        return;
      }

      setStatus(job.status || "RUNNING");
      const submittedMsg = t
        ? t("toast.blastSubmitted").replace("{jobId}", job.job_id)
        : `BLAST job submitted: ${job.job_id}`;
      toast.info(submittedMsg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : (t ? t("blast.failed") : "Failed to submit BLAST job");
      setError(msg);
      setStatus("ERROR");
      setLoading(false);
      toast.error(msg);
    }
  }

  function reset() {
    setLoading(false);
    setJobId(null);
    setStatus("idle");
    setHits([]);
    setError("");
    setElapsedSeconds(0);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(BLAST_SESSION_KEY);
      } catch {}
    }
  }

  function loadHistoryItem(item: BlastHistoryItem) {
    setSeq(item.seq);
    setSeqType(item.seqType);
    setProvider(item.provider);
    setDatabase(item.database);
    setEvalueCutoff(item.evalueCutoff);
    setMatrix(item.matrix);
    setGapOpen(item.gapOpen);
    setGapExtend(item.gapExtend);
    setHits(item.hits || []);
    setStatus("FINISHED");
    setError("");
    setLoading(false);
    toast.info(
      t
        ? t("toast.blastComplete").replace("{count}", String(item.hitCount))
        : `Loaded search with ${item.hitCount} alignments`
    );
  }

  function deleteHistoryItem(id: string) {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(BLAST_HISTORY_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }

  function clearHistory() {
    setHistory([]);
    try {
      localStorage.removeItem(BLAST_HISTORY_KEY);
    } catch {}
  }

  const loadSampleDna = () => {
    setSeq("ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGATCCAACAATAGAGGATTCCTACAGGAAGCAAGTAGTAATTGATGGAGAAACCTGTCTCTTGGATATTCTCGACACAGCAGGTCAAGAGGAGTACAGTGCAATGAGGGACCAGTACATGAGGACTGGGGAGGGCTTTCTTTGTGTATTTGCCATAAATAAT");
    setSeqType("dna");
    setProvider("auto");
    setDatabase("em_std_hum");
  };

  const loadSampleProtein = () => {
    setSeq("MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHHYREQIKRVKDSEDVPMVLVGNKCDLPSRTVDTKQAQDLARSYGIPFIETSAKTRQGVDDAFYTLVREIRKHKEKMSKDGKKKKKKSKTKCIM");
    setSeqType("protein");
    setProvider("auto");
    setDatabase("uniprotkb_swissprot");
  };

  return {
    seq,
    setSeq,
    provider,
    setProvider,
    seqType,
    setSeqType,
    database,
    setDatabase,
    evalueCutoff,
    setEvalueCutoff,
    matrix,
    setMatrix,
    gapOpen,
    setGapOpen,
    gapExtend,
    setGapExtend,
    loading,
    jobId,
    status,
    hits,
    error,
    elapsedSeconds,
    pollCount: pollCount.current,
    history,
    loadHistoryItem,
    deleteHistoryItem,
    clearHistory,
    submitJob,
    reset,
    loadSampleDna,
    loadSampleProtein,
  };
}
