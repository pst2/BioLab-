# Bioinformatics Backend Scaffold

FastAPI backend for gene lookup, PubMed lookup, sequence parsing, caching, and system status monitoring.

## Main upgrades in this scaffold

- Startup/DB: `init_db()` no longer runs as an import side effect. Local table creation is only triggered in the FastAPI lifespan when `DEBUG=true`; production schema management is handled by Alembic.
- Security: generic 500 responses no longer expose stack traces; protected endpoints use `X-API-Key` with timing-safe comparison and multiple keys.
- NCBI client: async `httpx` client with retries, timeout, real `esearch` + `esummary`, DOI extraction for PubMed, and FASTA/GenBank fetch support.
- Code quality: `GeneService` and `PubMedService` share cache/fallback behavior through `BaseSearchService`.
- Multi-provider gene search: NCBI remains the primary source; Ensembl, UniProt, and BV-BRC are used as trusted fallback providers when NCBI is unavailable or returns no result.
- Reliability: cache-first search, stale-cache fallback, local DB fallback, multi-provider external fallback, local mock fallback, and real DB/NCBI health checks.
- Rate limiting: SlowAPI-based IP rate limiting, configurable from environment.
- Tests: 31 tests covering auth, NCBI parsing, cache hit, stale fallback, service failure, sequence parsing, and system status.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
copy .env.example .env
```

For Linux/macOS:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Database migrations

Use Alembic for schema changes:

```bash
alembic upgrade head
```

Rollback:

```bash
alembic downgrade -1
```

For local quick development, `DEBUG=true` will create tables in lifespan if they do not exist. For production, set `DEBUG=false` and run Alembic migrations explicitly.

## Run

```bash
uvicorn app.main:app --reload
```

Open:

```text
http://localhost:8000/docs
```

## API endpoints

```text
GET  /api/v1/health
GET  /api/v1/system/status        # requires X-API-Key
GET  /api/v1/genes/search?q=BRCA1&organism=Homo%20sapiens
GET  /api/v1/pubmed/search?q=cancer
POST /api/v1/sequence/analyze
POST /api/v1/sequence/fetch/fasta
POST /api/v1/sequence/fetch/genbank
```

Example protected request:

```bash
curl -H "X-API-Key: dev-key-1" http://localhost:8000/api/v1/system/status
```

## Tests

```bash
pytest -q
```

Current suite: 31 tests.

## Important configuration

See `.env.example` for:

- `API_KEYS`
- `NCBI_API_KEY`
- `CACHE_TTL_*`
- `RATE_LIMIT_*`
- `DEBUG`

## Local-first Bioinformatics Workspace update

This backend now treats NCBI as an optional external reference provider instead of the only data source. The intended dependency split is roughly:

- 60-70% internal workspace data, local database, local cache, and backend analysis logic
- 30-40% NCBI reference data when a refresh or missing external lookup is needed

### Added database tables

The new workspace layer adds:

- `genes` - local gene records imported from NCBI or bundled local references
- `research_papers` - saved PubMed/research records
- `sequences` - locally analyzed user sequences
- extended `search_history` fields: `mode`, `result_source`, `result_count`

Run migrations after pulling this version:

```bash
alembic upgrade head
```

For a fresh local development database, you can also run with `DEBUG=true` and the app will create missing tables via `init_db()`.

### Search modes

Gene and PubMed search endpoints now accept a `mode` query parameter:

```text
local_first       # default: local cache/database first, NCBI only when needed
local_only        # never calls NCBI
external_refresh  # refreshes from NCBI and saves results into the local workspace
```

Examples:

```bash
curl "http://localhost:8000/api/v1/genes/search?q=BRCA1&organism=Homo%20sapiens&mode=local_first"
curl "http://localhost:8000/api/v1/genes/search?q=TP53&data_type=gene&search_by=name&organism=human"
curl "http://localhost:8000/api/v1/genes/search?q=NP_009225&data_type=protein&search_by=id&organism=Homo%20sapiens"
curl "http://localhost:8000/api/v1/genes/search?q=spike&organism=virus"
curl "http://localhost:8000/api/v1/pubmed/search?q=breast%20cancer&mode=external_refresh"
```

### Multi-provider fallback for gene search

The gene search route keeps the old response envelope, cache behavior, and local-first mode. The external lookup step now follows this order:

```text
1. Local valid cache
2. Local gene database
3. NCBI Gene / Nucleotide / Protein
4. If NCBI fails or is empty:
   - human / animal genes -> Ensembl + UniProt
   - protein/function lookup -> UniProt + BV-BRC
   - bacteria / virus -> BV-BRC + UniProt
   - plant keyword -> UniProt for now; Phytozome can be added as another provider later
5. Stale cache / local DB / bundled mock fallback
```

Provider output is normalized into the same frontend-friendly fields: `id`, `gene_id`, `symbol`, `name`, `description`, `organism`, `source`, `source_url`, `data_type`, and `raw`. The `meta.source` value can now be `ncbi`, `ensembl`, `uniprot`, or `bvbrc`.

### Internal sequence analysis

The `/api/v1/sequence/analyze` endpoint is now fully internal. It computes:

- sequence length
- GC content
- AT content
- base counts
- base composition for charts
- reverse complement
- RNA transcription
- motif search
- ORF detection
- codon frequency
- GC windows for visualization

Example:

```bash
curl -X POST "http://localhost:8000/api/v1/sequence/analyze" \
  -H "Content-Type: application/json" \
  -d '{"name":"demo","sequence":"ATGCGTACGTAGCTAGCTAGCTAA","motifs":["ATG","CTA"],"save":true}'
```

List saved sequence analyses:

```bash
curl "http://localhost:8000/api/v1/sequence/local"
```

### Workspace overview endpoint

Frontend dashboards can use this endpoint to show whether the system is becoming too dependent on NCBI:

```bash
curl "http://localhost:8000/api/v1/workspace/overview"
```

It returns counts for local genes, saved papers, analyzed sequences, cache entries, recent searches, and an estimated internal-vs-NCBI dependency ratio.

## Gene detail visualization upgrade

This version enriches gene detail responses for multi-provider records:

- Ensembl detail records can include genomic location, transcripts/exons, genomic sequence, FASTA, base counts, GC/AT content, and a `visualization` payload.
- UniProt detail records can include protein sequence, protein FASTA, function text, feature/domain annotations, and a `visualization.protein` payload.
- The existing `/api/v1/genes/search` and `/api/v1/genes/{gene_id}` routes are preserved, so the frontend can keep using the same URLs.
- NCBI remains the primary source. Ensembl and UniProt are used to enrich fallback-provider detail pages when the record ID indicates the source.

Recommended frontend detail sections:

1. Overview
2. Sequence & FASTA
3. Gene Visualization
4. Transcript / Exon Structure
5. Protein Information
6. External provider links
