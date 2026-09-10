"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { api, BlastHit } from "@/lib/api";
import { useToast } from "@/lib/Toast";

import { Translate } from "@/lib/i18n";

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
  }, [jobId, status, toast, t]);

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
  }

  const loadSampleDna = () => {
    // Human KRAS proto-oncogene exon fragment (verified live matches)
    setSeq("ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGATCCAACAATAGAGGATTCCTACAGGAAGCAAGTAGTAATTGATGGAGAAACCTGTCTCTTGGATATTCTCGACACAGCAGGTCAAGAGGAGTACAGTGCAATGAGGGACCAGTACATGAGGACTGGGGAGGGCTTTCTTTGTGTATTTGCCATAAATAAT");
    setSeqType("dna");
    setProvider("auto");
    setDatabase("em_std_hum");
  };

  const loadSampleProtein = () => {
    // Human KRAS protein (SwissProt P01116)
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
    submitJob,
    reset,
    loadSampleDna,
    loadSampleProtein,
  };
}
