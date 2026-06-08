<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0ea5e9,100:6366f1&height=200&section=header&text=BioLab%20Workspace&fontSize=60&fontColor=ffffff&fontAlignY=38&desc=A%20Modern%20Bioinformatics%20Platform&descAlignY=58&descSize=20&descColor=cbd5e1" width="100%"/>

<br/>

<p>
  <a href="https://github.com/pst2/bio-lab-workspace/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/pst2/bio-lab-workspace/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI&color=22c55e" />
  </a>
  <a href="https://www.python.org/downloads/">
    <img src="https://img.shields.io/badge/Python-3.10%2B-3776ab?style=for-the-badge&logo=python&logoColor=white" />
  </a>
  <a href="https://nextjs.org/">
    <img src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  </a>
  <a href="https://react.dev/">
    <img src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=black" />
  </a>
  <img src="https://img.shields.io/badge/License-MIT-a855f7?style=for-the-badge" />
</p>

<p>
  <a href="https://fastapi.tiangolo.com/">
    <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  </a>
  <a href="https://www.sqlalchemy.org/">
    <img src="https://img.shields.io/badge/SQLAlchemy-2.0-d71f00?style=for-the-badge&logo=sqlalchemy&logoColor=white" />
  </a>
  <a href="https://www.docker.com/">
    <img src="https://img.shields.io/badge/Docker-Ready-2496ed?style=for-the-badge&logo=docker&logoColor=white" />
  </a>
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript&logoColor=white" />
</p>

<br/>

> **🧬 Gene Discovery · 📚 Literature Mining · 🔍 Sequence Analysis · 💾 Local-First Architecture**

<br/>

<a href="#-quick-start">Quick Start</a> •
<a href="#-features">Features</a> •
<a href="#-architecture">Architecture</a> •
<a href="#-api-reference">API</a> •
<a href="#-tech-stack">Stack</a> •
<a href="#-contributing">Contribute</a>

<br/>

</div>

---

## 🌟 What is BioLab Workspace?

**BioLab Workspace** is a full-stack bioinformatics platform that empowers researchers, students, and engineers to explore biological data through a **fast, scalable, and resilient** architecture.

Instead of relying entirely on external services, BioLab adopts a **local-first philosophy** — building a private knowledge base that grows smarter with every query. Results are cached, stored locally, and retrieved instantly on repeat visits — reducing latency, API dependency, and network costs.

```
Query → Cache → Local DB → NCBI → Fallback Providers → Mock Data
```

Whether you're annotating genes, mining PubMed literature, or analyzing raw sequences — BioLab gives you a research-grade toolchain that feels like a local IDE for biology.

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🧬 Gene Search Engine

Search across **4 major biological providers** simultaneously:

| Provider | Description |
|----------|-------------|
| ![NCBI](https://img.shields.io/badge/NCBI-blue?style=flat-square) | National Center for Biotechnology Information |
| ![Ensembl](https://img.shields.io/badge/Ensembl-red?style=flat-square) | European genome annotation database |
| ![UniProt](https://img.shields.io/badge/UniProt-orange?style=flat-square) | Universal protein knowledgebase |
| ![BV‑BRC](https://img.shields.io/badge/BV--BRC-green?style=flat-square) | Bacterial & Viral Bioinformatics Resource |

- ✅ Multi-provider fallback orchestration
- ✅ Intelligent result caching
- ✅ Local database persistence
- ✅ Full search history tracking
- ✅ Offline-ready architecture

</td>
<td width="50%">

### 📚 Literature Mining

Integrated **PubMed** search with research persistence:

- 🔎 Keyword-based article discovery
- 📄 Automatic DOI extraction
- 💾 Cached responses for speed
- 🗄️ Local research storage
- 🔄 On-demand external refresh

### 🔍 Sequence Analysis

Analyze biological sequences end-to-end:

- 🧪 FASTA format parsing & validation
- 🗂️ GenBank record retrieval
- 🔬 Sequence metadata extraction
- 💽 Reusable local sequence storage
- ⚡ Async processing pipeline

</td>
</tr>
</table>

---

### 🏠 Local-First Research Workspace

BioLab supports **three distinct search modes** to balance freshness vs. speed:

```
┌──────────────────┬────────────────────────────────────────────────┬───────────┐
│ Mode             │ Description                                    │ Use Case  │
├──────────────────┼────────────────────────────────────────────────┼───────────┤
│ local_first      │ Check cache/DB first, fetch external if missed │ Default   │
│ local_only       │ Never contact external services                │ Offline   │
│ external_refresh │ Force re-fetch and overwrite local data        │ Updates   │
└──────────────────┴────────────────────────────────────────────────┴───────────┘
```

Over time, your BioLab instance becomes a **self-growing biological knowledge base** — tailored to your research domain.

---

## 🏛 Architecture

```
                         ╔══════════════════╗
                         ║   Next.js 15 UI  ║
                         ║  (React 19 + TS) ║
                         ╚════════╤═════════╝
                                  │ HTTPS / REST
                                  ▼
                    ╔═════════════════════════╗
                    ║     FastAPI Backend      ║
                    ║  Auth · Rate Limit · API ║
                    ╚══════════╤══════════════╝
                               │
            ┌──────────────────┼───────────────────┐
            ▼                  ▼                   ▼
     ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐
     │  Cache      │   │  Local SQLite│   │  Search History  │
     │  (in-mem)   │   │  (SQLAlchemy)│   │  (Persistence)   │
     └──────┬──────┘   └──────────────┘   └──────────────────┘
            │
            ▼
   ╔══════════════════╗
   ║ Provider         ║
   ║ Orchestrator     ║
   ╚═════════╤════════╝
             │
   ┌─────────┼──────────┬───────────┐
   ▼         ▼          ▼           ▼
 NCBI     Ensembl    UniProt     BV-BRC
```

### 📦 Project Structure

```
bio_project/
│
├── 📂 backend_scaffold/
│   ├── 📂 app/
│   │   ├── 📂 api/            # Route handlers & versioned endpoints
│   │   ├── 📂 services/       # Business logic layer
│   │   ├── 📂 repositories/   # Data access (Repository Pattern)
│   │   ├── 📂 providers/      # External API integrations
│   │   ├── 📂 clients/        # HTTP client wrappers (HTTPX)
│   │   ├── 📂 schemas/        # Pydantic v2 models
│   │   └── 📂 db/             # SQLAlchemy models & Alembic migrations
│   │
│   └── 📂 tests/              # Pytest test suites
│
├── 📂 bio_frontend/
│   ├── 📂 app/                # Next.js App Router pages
│   ├── 📂 components/         # Reusable React components
│   └── 📂 public/             # Static assets
│
└── 🐳 docker-compose.yml      # One-command deployment
```

---

## 🚀 Quick Start

### 🐳 Option 1: Docker (Recommended)

> The fastest way to get everything running.

```bash
# Clone the repository
git clone https://github.com/pst2/bio-lab-workspace.git
cd bio-lab-workspace

# Launch all services
docker compose up --build
```

| Service  | URL |
|----------|-----|
| 🖥️ Frontend | http://localhost:3000 |
| ⚡ Backend API | http://localhost:8000 |
| 📖 API Docs (Swagger) | http://localhost:8000/docs |
| 📘 ReDoc | http://localhost:8000/redoc |

---

### 🛠 Option 2: Local Development

<details>
<summary><b>🐍 Backend Setup</b></summary>

```bash
cd backend_scaffold

# Create and activate virtual environment
python -m venv .venv

# Linux / macOS
source .venv/bin/activate

# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# → Edit .env with your API keys and settings

# Run database migrations
alembic upgrade head

# Start the development server
uvicorn app.main:app --reload --port 8000
```

</details>

<details>
<summary><b>⚛️ Frontend Setup</b></summary>

```bash
cd bio_frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

</details>

---

## 🔌 API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/health` | Health check |
| `GET` | `/api/v1/system/status` | System & service status |
| `GET` | `/api/v1/genes/search` | Search genes across providers |
| `GET` | `/api/v1/pubmed/search` | Search PubMed literature |
| `POST` | `/api/v1/sequence/analyze` | Analyze a biological sequence |
| `POST` | `/api/v1/sequence/fetch/fasta` | Retrieve sequence in FASTA format |
| `POST` | `/api/v1/sequence/fetch/genbank` | Retrieve GenBank record |

### Example: Gene Search

```bash
curl -X GET "http://localhost:8000/api/v1/genes/search?query=BRCA1&mode=local_first" \
     -H "X-API-Key: your_api_key_here"
```

```json
{
  "query": "BRCA1",
  "source": "cache",
  "results": [
    {
      "gene_id": "672",
      "symbol": "BRCA1",
      "name": "BRCA1 DNA repair associated",
      "organism": "Homo sapiens",
      "chromosome": "17",
      "provider": "ncbi"
    }
  ]
}
```

### Example: Sequence Analysis

```bash
curl -X POST "http://localhost:8000/api/v1/sequence/analyze" \
     -H "X-API-Key: your_api_key_here" \
     -H "Content-Type: application/json" \
     -d '{"sequence": "ATGGCTAGCTAGCTAGCTAGC", "format": "fasta"}'
```

> 📖 Full interactive documentation available at `/docs` (Swagger UI) and `/redoc` (ReDoc).

---

## 🧰 Tech Stack

<table>
<tr>
<td valign="top" width="50%">

### Backend
| Technology | Role |
|------------|------|
| ![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white) | Async REST framework |
| ![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-d71f00?logo=sqlalchemy) | ORM & database layer |
| ![Alembic](https://img.shields.io/badge/Alembic-migrations-6b7280) | Schema migrations |
| ![HTTPX](https://img.shields.io/badge/HTTPX-async%20client-0ea5e9) | Async HTTP client |
| ![SlowAPI](https://img.shields.io/badge/SlowAPI-rate%20limiter-f59e0b) | Rate limiting |
| ![Pydantic](https://img.shields.io/badge/Pydantic-v2-e11d48?logo=pydantic) | Data validation |
| ![Pytest](https://img.shields.io/badge/Pytest-testing-0d9488?logo=pytest) | Test framework |

</td>
<td valign="top" width="50%">

### Frontend
| Technology | Role |
|------------|------|
| ![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs) | React framework |
| ![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black) | UI library |
| ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript) | Type safety |
| ![Tailwind](https://img.shields.io/badge/Tailwind-CSS-06b6d4?logo=tailwindcss) | Utility-first CSS |
| ![Lucide](https://img.shields.io/badge/Lucide-Icons-f97316) | Icon library |
| ![Docker](https://img.shields.io/badge/Docker-Compose-2496ed?logo=docker&logoColor=white) | Containerization |

</td>
</tr>
</table>

---

## 🔒 Security

BioLab implements production-grade security practices:

- 🔑 **API Key Authentication** — all endpoints require a valid key
- ⏱️ **Timing-Safe Comparison** — prevents timing-based key extraction attacks
- 🚦 **Rate Limiting** — powered by SlowAPI to prevent abuse
- 🛡️ **Secure Error Handling** — no stack traces or internals exposed to clients
- 🔐 **Environment-Based Configuration** — secrets never hardcoded in source

---

## 🧪 Testing

```bash
cd backend_scaffold

# Run all tests
pytest -q

# Run with verbose output
pytest -v

# Run a specific test module
pytest tests/test_gene_search.py -v

# Generate coverage report
pytest --cov=app --cov-report=html
```

### Test Coverage

| Module | Coverage |
|--------|----------|
| Authentication | ✅ |
| Gene Search | ✅ |
| PubMed Search | ✅ |
| Cache Handling | ✅ |
| Fallback Logic | ✅ |
| Sequence Parsing | ✅ |
| System Monitoring | ✅ |

---

## 📈 Roadmap

```
2025 Q1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2025 Q4
  │                                                    │
  ├── ✅ Gene search engine (NCBI, Ensembl, UniProt)   │
  ├── ✅ PubMed literature integration                 │
  ├── ✅ Sequence analysis pipeline                    │
  ├── ✅ Local-first caching architecture              │
  ├── ✅ API key auth + rate limiting                  │
  ├── 🔜 Gene visualization dashboards                │
  ├── 🔜 Protein structure integration (AlphaFold)    │
  ├── 🔜 BLAST sequence similarity search             │
  ├── 🔜 Genome browser integration                   │
  ├── 🔜 Collaboration workspace                      │
  └── 🔜 AI-assisted biological interpretation        │
```

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

```bash
# 1. Fork and clone
git clone https://github.com/pst2/bio-lab-workspace.git

# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make your changes and write tests
pytest -q  # All tests must pass

# 4. Push and open a Pull Request
git push origin feature/your-feature-name
```

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for our code of conduct and pull request guidelines.

---

## 🎯 Why BioLab Workspace?

Most educational bioinformatics projects stop at simple API consumption. **BioLab goes further** by demonstrating software engineering principles that matter in production:

| Principle | Implementation |
|-----------|---------------|
| 🏛️ Clean Architecture | Strict separation of concerns across layers |
| 📦 Repository Pattern | Decoupled data access from business logic |
| 🎻 Provider Orchestration | Intelligent multi-source fallback strategy |
| ⚡ Cache-First Design | Sub-millisecond repeat query response |
| 🏠 Local-First Computing | Build your own biological knowledge base |
| 🔒 Production Security | API keys, rate limiting, safe error handling |
| 🧪 Test-Driven Quality | Comprehensive pytest coverage |

Whether for a **portfolio**, **research prototype**, **bioinformatics coursework**, or **open-source collaboration** — BioLab is built to impress.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

---

<div align="center">

<br/>

**Built with ❤️ for Bioinformatics, Software Engineering & Scientific Computing**

<br/>

*If BioLab Workspace helped your research or learning, please consider giving it a* ⭐

<br/>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:6366f1,100:0ea5e9&height=100&section=footer" width="100%"/>

</div>
