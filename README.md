# 🧬 BioLab Workspace
### A Modern Bioinformatics Platform for Gene Discovery, Literature Mining & Sequence Analysis

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-Backend-green" />
  <img src="https://img.shields.io/badge/Next.js-15-black" />
  <img src="https://img.shields.io/badge/React-19-blue" />
  <img src="https://img.shields.io/badge/SQLAlchemy-2.0-orange" />
  <img src="https://img.shields.io/badge/Alembic-Migrations-red" />
  <img src="https://img.shields.io/badge/Python-3.10+-yellow" />
</p>

## 🚀 Overview

BioLab Workspace is a full-stack bioinformatics platform designed to help researchers, students, and developers explore biological data through a fast, scalable, and resilient architecture.

The platform combines:

- 🔬 Gene discovery and annotation
- 📚 PubMed literature search
- 🧬 DNA/RNA sequence analysis
- 💾 Local-first scientific workspace
- ⚡ Multi-provider biological data retrieval
- 📊 Search history and research persistence
- 🛡️ Secure API access and rate limiting

Unlike traditional bioinformatics tools that depend entirely on external services, BioLab adopts a **local-first architecture**, ensuring faster responses, better reliability, and reduced dependency on third-party APIs.

---

# ✨ Key Features

## 🧬 Gene Search Engine

Search biological genes using:

- NCBI
- Ensembl
- UniProt
- BV-BRC

Features:

- Multi-provider fallback orchestration
- Intelligent caching
- Local database persistence
- Search history tracking
- Offline-ready architecture

---

## 📚 Scientific Literature Search

Integrated PubMed search system:

- Keyword-based discovery
- DOI extraction
- Cached responses
- Local research storage
- External refresh capability

---

## 🔍 Sequence Analysis

Analyze biological sequences through dedicated endpoints:

- FASTA parsing
- GenBank retrieval
- Sequence validation
- Metadata extraction
- Reusable local storage

---

## 🏗 Local-First Research Workspace

Three search modes are supported:

| Mode | Description |
|--------|-------------|
| local_first | Search cache/database first |
| local_only | Never access external services |
| external_refresh | Refresh from external providers and save locally |

This design allows researchers to gradually build their own biological knowledge base.

---

# 🏛 Architecture

```text
                 ┌──────────────┐
                 │ Next.js UI   │
                 └──────┬───────┘
                        │
                        ▼
               ┌─────────────────┐
               │ FastAPI Backend │
               └────────┬────────┘
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
   Cache Layer     Local Database    Search History
        │
        ▼
 Provider Orchestrator
        │
 ┌──────┼──────────┬───────────┬─────────┐
 ▼      ▼          ▼           ▼
NCBI  Ensembl   UniProt     BV-BRC
```

### Retrieval Strategy

```text
Cache
  ↓
Local Database
  ↓
NCBI
  ↓
Fallback Providers
  ↓
Mock Data
```

This layered strategy improves resilience and availability.

---

# 🧰 Technology Stack

## Backend

- FastAPI
- SQLAlchemy
- Alembic
- HTTPX
- SlowAPI
- Pytest
- Pydantic v2

## Frontend

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Lucide React

## Infrastructure

- Docker
- Docker Compose

---

# 📂 Project Structure

```text
bio_project/
│
├── backend_scaffold/
│   ├── app/
│   │   ├── api/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── providers/
│   │   ├── clients/
│   │   ├── schemas/
│   │   └── db/
│   │
│   └── tests/
│
├── bio_frontend/
│   ├── app/
│   ├── components/
│   └── public/
│
└── docker-compose.yml
```

---

# ⚙️ Quick Start

## Using Docker

```bash
docker compose up --build
```

Frontend:

```text
http://localhost:3000
```

Backend:

```text
http://localhost:8000
```

API Docs:

```text
http://localhost:8000/docs
```

---

## Backend Development

```bash
cd backend_scaffold

python -m venv .venv

source .venv/bin/activate
# Windows:
# .venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env

alembic upgrade head

uvicorn app.main:app --reload
```

---

# 🔌 Main API Endpoints

```http
GET  /api/v1/health

GET  /api/v1/system/status

GET  /api/v1/genes/search

GET  /api/v1/pubmed/search

POST /api/v1/sequence/analyze

POST /api/v1/sequence/fetch/fasta

POST /api/v1/sequence/fetch/genbank
```

---

# 🔒 Security

Implemented protections include:

- API Key Authentication
- Timing-safe key validation
- Rate Limiting
- Secure error handling
- Environment-based configuration

---

# 🧪 Testing

```bash
pytest -q
```

Current test coverage includes:

- Authentication
- Gene Search
- PubMed Search
- Cache Handling
- Fallback Logic
- Sequence Parsing
- System Monitoring

---

# 📈 Future Roadmap

- Gene visualization dashboards
- Protein structure integration
- BLAST support
- Genome browser integration
- Research collaboration workspace
- AI-assisted biological interpretation

---

# 🎯 Why This Project Matters

Most educational bioinformatics projects stop at simple API consumption.

BioLab Workspace goes further by demonstrating:

- Clean Architecture principles
- Repository Pattern
- Provider Orchestration
- Cache-first design
- Local-first scientific computing
- Production-grade FastAPI development
- Modern Next.js frontend integration

This makes the project suitable for:

- Portfolio demonstrations
- Research prototypes
- Bioinformatics coursework
- Backend architecture showcases
- Open-source collaboration

---

## 👨‍💻 Author

Built with a passion for Bioinformatics, Software Engineering, and Scientific Computing.

If you find this project useful, consider giving it a ⭐ on GitHub.
