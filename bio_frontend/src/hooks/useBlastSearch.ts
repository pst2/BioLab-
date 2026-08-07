"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api, BlastHit } from "@/lib/api";
import { useToast } from "@/lib/Toast";

export function useBlastSearch() {
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

  const pollCount = useRef(0);
  const timerRef = useRef<any>(null);
  const toast = useToast();

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

  useEffect(() => {
    if (!jobId || status === "FINISHED" || status === "ERROR" || status === "NOT_FOUND" || status === "idle") return;
    pollCount.current = 0;
    const MAX_POLLS = 120; // 4 minutes max at 2s interval
    const intervalId = setInterval(async () => {
      pollCount.current += 1;
      if (pollCount.current > MAX_POLLS) {
        setStatus("ERROR");
        setError("BLAST search timed out. Please try again or select a local provider.");
        setLoading(false);
        clearInterval(intervalId);
        return;
      }
      try {
        const res = await api.checkSequenceSearchStatus(jobId);
        const job = res.data;
        if (job) {
          setStatus(job.status || "RUNNING");
          if (job.status === "FINISHED") {
            const hitResults = job.hits || [];
            setHits(hitResults);
            setLoading(false);
            toast.success(`BLAST search complete — ${hitResults.length} alignments found`);
          } else if (job.status === "ERROR" || job.status === "NOT_FOUND") {
            setError(job.error || res.message || "BLAST search failed.");
            setLoading(false);
          }
        }
      } catch {
        /* keep polling on transient error */
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [jobId, status, toast]);

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
      });
      const job = response.data;
      setJobId(job.job_id);
      setStatus(job.status || "RUNNING");
      toast.info(`BLAST job submitted: ${job.job_id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit BLAST job";
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
  }

  const loadSampleDna = () => {
    setSeq("ATGCGTACGATCGATCGGCATGCATCGTAGCATCGATCGTAGCATGCATCGATCG");
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
    loading,
    jobId,
    status,
    hits,
    error,
    elapsedSeconds,
    pollCount: pollCount.current,
    submitJob,
    reset,
    loadSampleDna,
    loadSampleProtein,
  };
}
