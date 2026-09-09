# Bioinformatics Backend Scaffold (FastAPI)

FastAPI backend for multi-provider gene discovery, PubMed literature mining, bioinformatics sequence analysis, FAIR provenance tracking, research data export, and system performance monitoring.

## 🚀 Main Features & Recent Upgrades

- **Multi-Provider Architecture**: NCBI (Entrez) as primary provider, with automatic fallback and dedicated filtering across **Ensembl**, **UniProt**, **BV-BRC**, and **Phytozome**. Route `/api/v1/genes/search` supports `provider` (`auto`, `ncbi`, `ensembl`, `uniprot`, `bvbrc`, `phytozome`, `all`) and `fallback: bool`.
- **FAIR Data Provenance**: Explicit tracking of `genome_assembly`, `taxid`, and `accession_version` columns in the `genes` table, ensuring data traceability across external genomic revisions.
- **Research-Grade Data Export**: Endpoints under `/api/v1/export/` for:
  - FASTA sequence downloads (`/api/v1/export/gene/{id}/fasta`)
  - Full GenBank flatfile downloads (`/api/v1/export/gene/{id}/genbank`)
  - BED track coordinate files (`/api/v1/export/gene/{id}/bed`)
  - Complete JSON machine-readable export (`/api/v1/export/gene/{id}/json`)
  - Query results CSV export (`/api/v1/export/search/csv`)
  - Academic citation exports: **BibTeX** (`/api/v1/export/citation/bibtex`) and **RIS** (`/api/v1/export/citation/ris`)
- **Advanced Sequence & Protein Analysis**:
  - Multi-FASTA file parsing (`parse_multi_fasta`)
  - Full IUPAC nucleotide degenerate code support (R, Y, S, W, K, M, B, D, H, V, N) & gap (`-`) handling
  - Automatic Protein vs. DNA/RNA sequence classification
  - Physicochemical protein profiling: Molecular Weight (Da), Isoelectric Point (pI), Instability Index, GRAVY hydropathy, Extinction Coefficient, and charge distribution
  - 6-Frame Open Reading Frame (ORF) finder supporting canonical (`ATG`) and alternative start codons (`GTG`, `TTG`, `CTG`) across both strands
- **Asynchronous BLAST Integration**: Integration with EBI/NCBI BLAST APIs with job dispatching, status polling, and visual alignment string parsing (`Query`, `Subject`, `Match`).
- **Dynamic IGV.js FASTA Slicing**: On-the-fly genomic sequence slicing (`/api/v1/sequence/igv/fasta`) with coordinate normalization for minus strands and customizable locus padding.
- **High-Performance System Stats**: Real-time stats (`/api/v1/system/stats`) with bounded asynchronous timeout (3.0s for external health pings) and 120s TTL caching, responding in < 0.5s.
- **Security & Reliability**: Timing-safe `X-API-Key` authentication, SlowAPI rate-limiting, and sanitized 500 error responses preventing internal traceback leaks.
- **Testing Suite**: **75 automated tests** across all modules with 100% pass rate.

---

## 🛠 Setup & Installation

### Windows (PowerShell)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

### Linux / macOS
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

---

## 🗄 Database Migrations (Alembic)

Schema management is strictly handled by Alembic:

```bash
# Apply all pending migrations (including FAIR provenance columns)
alembic upgrade head

# Rollback one migration if needed
alembic downgrade -1
```

*Note: In development mode, `alembic upgrade head` ensures all tables and columns (`genome_assembly`, `taxid`, `accession_version`) match the SQLAlchemy models.*

---

## ▶️ Running the Server

```bash
# Local development with auto-reload
py -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Interactive documentation:
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 🧪 Running Automated Tests

```bash
# Run the full 75-test suite
pytest -v
```

All 75 tests cover:
- `test_bioinformatics_upgrade.py`: Multi-FASTA, IUPAC, Protein physicochemical properties, 6-frame ORF
- `test_research_features.py`: FAIR provenance columns, data export (FASTA, GenBank, BED, CSV, BibTeX, RIS), BLAST alignment parsing
- `test_search_services.py`: Multi-provider fallback, cache hits, stale fallback, mock fallbacks
- `test_ncbi_client.py`: Entrez E-Utilities parsing, DOI extraction, retries
- `test_sequence.py`: IGV subregion slicing, FASTA parser, GenBank parser
- `test_system.py`: Health checks, system status, real-time stats
- `test_security.py` & `test_rate_limit.py`: API key validation, dev/prod enforcement, rate limits
- `test_exceptions.py`: Provider error hierarchy, sanitization of 500 error responses
- `test_validators.py`: DNA, Protein, and sequence length validations

---

## 📡 API Reference Overview

### Health & System
| Method | Path | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service health (DB + NCBI connectivity) | Public |
| `GET` | `/api/v1/system/status` | Uptime, cache metrics, active services | `X-API-Key` |
| `GET` | `/api/v1/system/stats` | Real-time indexed stats, provider count | Public |
| `GET` | `/api/v1/workspace/overview`| Internal vs. external dependency breakdown | Public |

### Gene Discovery & Visualization
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/genes/search` | Search genes (`q`, `provider`, `fallback`, `mode`, `organism`, `data_type`) |
| `GET` | `/api/v1/genes/{id}` | Detailed record with genome coordinates, transcripts, and protein info |
| `GET` | `/api/v1/sequence/igv/fasta` | Dynamic FASTA locus extraction for IGV.js browser |

### Sequence Analysis & BLAST
| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/sequence/analyze` | Comprehensive DNA/RNA/Protein analysis, codon table, ORF finder |
| `POST` | `/api/v1/sequence/blast` | Submit and check async NCBI/EBI BLAST search |
| `GET` | `/api/v1/sequence/local` | List locally saved sequence analyses |

### Research Data Export
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/export/gene/{id}/fasta` | Download gene sequence in standard FASTA format |
| `GET` | `/api/v1/export/gene/{id}/genbank` | Download full GenBank flatfile (.gb) |
| `GET` | `/api/v1/export/gene/{id}/bed` | Download exon/feature coordinates in BED format |
| `GET` | `/api/v1/export/gene/{id}/json` | Download complete JSON record |
| `GET` | `/api/v1/export/search/csv` | Export search query results to CSV |
| `GET` | `/api/v1/export/citation/bibtex` | Export citation for PubMed record in BibTeX format |
| `GET` | `/api/v1/export/citation/ris` | Export citation for PubMed record in RIS format |

### Literature Mining
| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/pubmed/search` | Query PubMed articles (`q`, `limit`, `mode`) with DOI extraction |
