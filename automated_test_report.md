# Báo Cáo Kết Quả Kiểm Thử Tự Động (Automated Test Suite Report)

**Dự án:** Bioinformatics Research Platform (BioLab)  
**Thời gian thực thi:** 23/09/2026 - 17:41 (UTC+7)  
**Môi trường:** Python 3.10.8 / pytest-8.3.3 / Next.js 15.5.18 / TypeScript 5.x  

---

## 1. Tổng quan kiểm thử (Executive Summary)

| Hạng mục | Kết quả | Trạng thái |
| :--- | :--- | :--- |
| **Backend Test Suite (Pytest)** | **78 / 78 Passed (100%)** |  PASS |
| **Frontend Static Typing (TSC)** | **0 errors (100% Type-safe)** |  PASS |
| **Thời gian chạy backend** | **~7.95 giây** |  Tối ưu |
| **File XML chi tiết (JUnit)** | [`backend_scaffold/test-results.xml`](file:///f:/python_vscode/bio_project/backend_scaffold/test-results.xml) |  Đã xuất |

---

## 2. Chi tiết kết quả kiểm thử Backend (`pytest`)

Dưới đây là chi tiết phân loại 78 bài kiểm thử theo từng module tính năng:

### 2.1. Nâng cấp xử lý tin sinh học (`test_bioinformatics_upgrade.py`)
-  `test_multi_fasta_parsing` (PASSED)
-  `test_single_fasta_no_multi_wrapper` (PASSED)
-  `test_parse_multi_always_returns_list` (PASSED)
-  `test_fasta_parser_accepts_iupac_bases` (PASSED)
-  `test_iupac_reverse_complement` (PASSED)
-  `test_fasta_parser_gap_character` (PASSED)
-  `test_fasta_parser_protein_detection` (PASSED)
-  `test_protein_analysis_metrics` (PASSED)
-  `test_protein_visualization_data` (PASSED)
-  `test_six_frame_orf_finds_reverse_strand` (PASSED)
-  `test_six_frame_orf_alternative_start_codons` (PASSED)
-  `test_six_frame_orf_forward_strand` (PASSED)
-  `test_analyze_protein_via_service` (PASSED)
-  `test_analyze_dna_still_works` (PASSED)

### 2.2. Xử lý lỗi & Ngoại lệ hệ thống (`test_exceptions.py`)
-  `test_provider_error_hierarchy` (PASSED)
-  `test_provider_rate_limit_error` (PASSED)
-  `test_provider_not_found_error` (PASSED)
-  `test_generic_exception_handler_no_traceback_leak` (PASSED)

### 2.3. Kiểm tra sức khỏe & Trạng thái (`test_health.py` & `test_system.py`)
-  `test_root` (PASSED)
-  `test_health` (PASSED)
-  `test_system_status_requires_api_key` (PASSED)
-  `test_system_status_accepts_api_key` (PASSED)
-  `test_health_is_healthy_when_db_and_ncbi_ok` (PASSED)
-  `test_health_is_degraded_when_ncbi_down` (PASSED)
-  `test_system_status_reports_services` (PASSED)
-  `test_get_system_stats_returns_valid_structure` (PASSED)

### 2.4. Tương tác NCBI Client (`test_ncbi_client.py`)
-  `test_search_genes_uses_esummary` (PASSED)
-  `test_search_pubmed_extracts_authors_and_doi` (PASSED)
-  `test_fetch_sequence_fasta_uses_text_endpoint` (PASSED)
-  `test_ping_returns_true` (PASSED)
-  `test_extract_pubmed_doi_missing_returns_none` (PASSED)

### 2.5. Giới hạn tốc độ & Bảo mật (`test_rate_limit.py` & `test_security.py`)
-  `test_get_rate_limit_key_with_api_key` (PASSED)
-  `test_get_rate_limit_key_fallback_ip` (PASSED)
-  `test_verify_api_key_accepts_valid_key` (PASSED)
-  `test_verify_api_key_rejects_missing_key` (PASSED)
-  `test_verify_api_key_rejects_invalid_key` (PASSED)
-  `test_verify_api_key_allows_dev_mode_without_keys` (PASSED)
-  `test_verify_api_key_rejects_production_without_keys` (PASSED)

### 2.6. Tính năng xuất dữ liệu & FAIR Provenance (`test_research_features.py`)
-  `test_export_gene_fasta` (PASSED)
-  `test_export_gene_json` (PASSED)
-  `test_export_gene_genbank` (PASSED)
-  `test_export_gene_bed` (PASSED)
-  `test_export_search_csv` (PASSED)
-  `test_export_bibtex` (PASSED)
-  `test_export_ris` (PASSED)
-  `test_parse_ebi_hits_with_alignment` (PASSED)
-  `test_parse_uniprot_tsv_with_alignment` (PASSED)
-  `test_db_models_fair_provenance_columns` (PASSED)
-  `test_sequence_record_provenance_columns` (PASSED)
-  `test_search_service_provenance_metadata` (PASSED)
-  `test_normalize_exp_values` (PASSED)
-  `test_mock_blast_fallback` (PASSED)

### 2.7. Dịch vụ tìm kiếm & Bộ nhớ đệm (`test_search_services.py`)
-  `test_gene_search_cache_hit_calls_ncbi_once` (PASSED)
-  `test_gene_search_uses_stale_cache_when_ncbi_down` (PASSED)
-  `test_gene_search_uses_mock_data_when_available` (PASSED)
-  `test_gene_search_raises_503_without_cache_or_mock` (PASSED)
-  `test_gene_search_uses_provider_fallback_when_ncbi_down` (PASSED)
-  `test_pubmed_search_cache_hit` (PASSED)
-  `test_pubmed_search_raises_when_no_fallback` (PASSED)

### 2.8. Phân tích chuỗi & IGV Integration (`test_sequence.py`)
-  `test_sequence_analyze_returns_gc_and_counts` (PASSED)
-  `test_fasta_parser_returns_visualization_data` (PASSED)
-  `test_fasta_parser_protein_analysis` (PASSED)
-  `test_fetch_fasta_cache_hit_calls_ncbi_once` (PASSED)
-  `test_fetch_fasta_returns_stale_cache_when_ncbi_down` (PASSED)
-  `test_fetch_genbank_cache_hit` (PASSED)
-  `test_fetch_genbank_returns_failure_without_cache` (PASSED)
-  `test_fetch_raw_fasta_for_igv_local_lookup` (PASSED)
-  `test_fetch_raw_fasta_for_igv_subregion_slicing` (PASSED)

### 2.9. Kiểm tra tính hợp lệ dữ liệu sinh học (`test_validators.py`)
-  `test_validate_sequence_length_pass` (PASSED)
-  `test_validate_sequence_length_fail` (PASSED)
-  `test_validate_sequence_length_at_boundary` (PASSED)
-  `test_validate_dna_sequence_valid` (PASSED)
-  `test_validate_dna_sequence_iupac_degenerate_codes` (PASSED)
-  `test_validate_dna_sequence_invalid_chars` (PASSED)
-  `test_validate_dna_sequence_empty` (PASSED)
-  `test_validate_protein_sequence_valid` (PASSED)
-  `test_validate_protein_sequence_selenocysteine_and_pyrrolysine` (PASSED)
-  `test_validate_protein_sequence_invalid_chars` (PASSED)

---

## 3. Frontend Static Verification (`bio_frontend`)
- **Lệnh thực thi:** `npx tsc --noEmit`
- **Kết quả:** `0 errors` (Hoàn tất không có lỗi cú pháp hoặc Type mismatch trong toàn bộ ứng dụng Next.js).
