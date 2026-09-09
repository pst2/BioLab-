<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0ea5e9,100:6366f1&height=220&section=header&text=BioLab%20Workspace&fontSize=60&fontColor=ffffff&fontAlignY=38&desc=A%20Modern%20Full-Stack%20Bioinformatics%20%26%20Genomics%20Platform&descAlignY=58&descSize=18&descColor=cbd5e1" width="100%"/>

<br/>

<p>
  <a href="https://github.com/pst2/BioLab-/actions">
    <img src="https://img.shields.io/badge/CI-75%2F75%20Passed-22c55e?style=for-the-badge&logo=githubactions&logoColor=white" alt="CI Passed" />
  </a>
  <a href="https://www.python.org/downloads/">
    <img src="https://img.shields.io/badge/Python-3.10%2B-3776ab?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.10+" />
  </a>
  <a href="https://fastapi.tiangolo.com/">
    <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  </a>
  <a href="https://nextjs.org/">
    <img src="https://img.shields.io/badge/Next.js-15.5-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  </a>
  <a href="https://react.dev/">
    <img src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5" />
  </a>
</p>

<br/>

> **🧬 5-Provider Gene Discovery · 🗺️ Interactive IGV.js Genome Browser · 🔬 Multi-FASTA & Protein Analysis · ⚡ 6-Frame ORF Finder · 📑 Research-Grade Exports (FASTA, GenBank, BED, BibTeX) · 💾 FAIR Provenance & Local-First**

<br/>

<a href="#-tính-năng-nổi-bật--key-features">Tính năng / Features</a> •
<a href="#-kiến-trúc-hệ-thống--architecture">Kiến trúc / Architecture</a> •
<a href="#-hướng-dẫn-chạy--quick-start">Cài đặt / Quick Start</a> •
<a href="#-chuẩn-dữ-liệu-fair--xuất-file-nghiên-cứu">Xuất dữ liệu / Exports</a> •
<a href="#-kiểm-thử-tự-động--testing-suite">Kiểm thử / Tests</a> •
<a href="#-api-documentation">API Docs</a> •
<a href="#-tài-liệu-bảo-vệ-đồ-án--thesis-defense-guide">Bảo vệ đồ án / Defense Guide</a>

<br/>

</div>

---

## 🌟 Giới thiệu tổng quan / Overview

**BioLab Workspace** là một nền tảng tin sinh học toàn diện (**Full-Stack Bioinformatics Platform**) đạt chuẩn phục vụ nghiên cứu khoa học và đào tạo y sinh, được thiết kế theo triết lý **Local-First & Multi-Tier Fault Tolerance**.

Hệ thống cho phép các nhà nghiên cứu, sinh viên và kỹ sư y sinh:
1. **Khám phá dữ liệu sinh học đa nguồn (Multi-Provider Discovery)**: Tích hợp đồng thời từ 5 kho dữ liệu quốc tế hàng đầu: **NCBI (Entrez API)**, **Ensembl**, **UniProt**, **BV-BRC**, và **Phytozome**, hỗ trợ lọc theo provider cụ thể hoặc kích hoạt chế độ tự động chuyển đổi dự phòng (Fallback).
2. **Trực quan hóa hệ gen sống động với IGV.js**: Tích hợp trình duyệt **IGV.js (Integrated Genomics Viewer)** với cơ chế **Dynamic FASTA Slicing** và tự động chuẩn hóa tọa độ âm (Minus Strand).
3. **Phân tích trình tự & Protein chuyên sâu**:
   - Phân tích DNA/RNA: Tỷ lệ GC/AT, tần suất codon, biểu đồ phân bố nucleotide, bổ sung đảo ngược (Reverse Complement) hỗ trợ mã thoái hóa **IUPAC**.
   - Thuật toán tìm khung đọc mở **6-Frame ORF** hỗ trợ các bộ ba mở đầu thay thế (`ATG`, `GTG`, `TTG`, `CTG`).
   - Phân tích lý hóa Protein: Trọng lượng phân tử (Molecular Weight), điểm đẳng điện (pI), chỉ số bất ổn định (Instability Index), tính kỵ nước (GRAVY), hệ số tuyệt chủng (Extinction Coefficient).
4. **Đối chiếu trình tự BLAST (EBI / NCBI)**: Gửi job BLAST bất đồng bộ, theo dõi tiến trình (pending, running, complete) và phân tích chuỗi căn hàng (Alignment Match/Mismatch).
5. **Khai phá y văn PubMed & Xuất trích dẫn học thuật**: Tìm kiếm bài báo khoa học, trích xuất DOI/Abstract, xuất trích dẫn dạng **BibTeX** và **RIS** tương thích Zotero, Mendeley, EndNote.
6. **Chuẩn dữ liệu FAIR & Xuất file nghiên cứu**: Lưu trữ nguồn gốc dữ liệu (`genome_assembly`, `taxid`, `accession_version`), cho phép tải về các tệp định dạng chuẩn: **FASTA**, **GenBank (.gb)**, **BED track**, **JSON**, **CSV/TSV**.

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 QUY TRÌNH TRUY VẤN DỮ LIỆU              │
                  │ In-Memory Cache ──► Local SQLite ──► NCBI Entrez API   │
                  │ ──► Multi-Provider Fallback (Ensembl/UniProt/BV-BRC)    │
                  │ ──► FAIR Provenance Tracking & Research Export          │
                  └─────────────────────────────────────────────────────────┘
```

---

## ✨ Tính năng nổi bật / Key Features

<table>
<tr>
<td width="50%" valign="top">

### 🧬 1. Khám phá Gen Đa Nhà Cung Cấp
- **5 Nhà cung cấp quốc tế**: NCBI, Ensembl, UniProt, BV-BRC, Phytozome.
- **Tham số linh hoạt**: Hỗ trợ chỉ định `provider` (`ncbi`, `ensembl`, `uniprot`, `bvbrc`, `phytozome`, `all`, `auto`) và cờ `fallback=true/false`.
- **Dung lỗi tự động (Fault-Tolerance)**: Khi máy chủ NCBI nghẽn mạng hoặc quá tải, hệ thống tự động trích xuất từ Ensembl/UniProt mà không làm gián đoạn người dùng.
- **Truy nguyên nguồn gốc FAIR**: Ghi nhận `genome_assembly`, `taxid`, `accession_version`, `source_url`.

### 🗺️ 2. Trình duyệt Hệ gen IGV.js Tích hợp
- **Trực quan hóa Locus**: Thu phóng linh hoạt từ quy mô nhiễm sắc thể xuống từng cặp bazơ (bp).
- **Dynamic FASTA Slicing**: Trích xuất cửa sổ trình tự động theo tọa độ kèm vùng đệm (`LOCUS_PADDING = 5,000 bp`), mượt mà cho các gen dài hàng trăm kbp.
- **Tự động chuẩn hóa tọa độ**: Xử lý hoàn hảo các gen trên strand âm (`strand = -1`) với cơ chế đảo chiều tọa độ `start <= end`.

</td>
<td width="50%" valign="top">

### 🔬 3. Phân tích Trình tự & BLAST Nâng cao
- **Đọc Multi-FASTA & IUPAC**: Đọc nhiều bản ghi FASTA đồng thời, hỗ trợ ký tự khuyết (`-`) và mã thoái hóa IUPAC (R, Y, S, W, K, M, B, D, H, V, N).
- **6-Frame ORF Finder**: Quét cả 2 mạch (Forward & Reverse), nhận diện cả `ATG` và các codon khởi đầu thay thế (`GTG`, `TTG`, `CTG`).
- **Protein Profiler**: Tự động nhận diện Protein, tính toán pI, trọng lượng phân tử (Da), GRAVY, điện tích và hệ số hấp thụ quang.
- **BLAST Job Runner**: Gửi và kiểm tra trạng thái job NCBI/EBI BLAST không đồng bộ kèm visual alignment viewer.

### 📑 4. Xuất Dữ liệu Nghiên cứu & Trích dẫn
- **Định dạng sinh học chuẩn**: Tải nhanh file **FASTA**, **GenBank (.gb)** phẳng, **BED track** cho IGV/UCSC, và **JSON**.
- **Khai phá & Trích dẫn PubMed**: Tìm kiếm bài báo khoa học, xuất trích dẫn **BibTeX (.bib)** và **RIS (.ris)** cho các phần mềm quản lý trích dẫn.
- **Giao diện Song ngữ & Dark Mode**: Hỗ trợ chuyển đổi nhanh **Tiếng Việt 🇻🇳** và **Tiếng Anh 🇬🇧**.

</td>
</tr>
</table>

---

## 🏛 Kiến trúc Hệ thống / Architecture

```
                          ╔═══════════════════════════════════╗
                          ║      Next.js 15.5 Frontend        ║
                          ║   (React 19 + TypeScript + IGV)   ║
                          ╚═════════════════╤═════════════════╝
                                            │ HTTP Proxy /api/backend
                                            ▼
                          ╔═══════════════════════════════════╗
                          ║        FastAPI 0.115 Backend      ║
                          ║   Auth · RateLimit · CORS · Metrics║
                          ╚═════════════════╤═════════════════╝
                                            │
         ┌───────────────────┬──────────────┴───────────────┬───────────────────┐
         ▼                   ▼                              ▼                   ▼
  ┌─────────────┐     ┌──────────────┐              ┌────────────────┐   ┌──────────────┐
  │ In-Memory   │     │ SQLite DB    │              │  Bioinformatics│   │ Export &     │
  │ Cache Repos │     │ (Alembic)    │              │  Sequence Core │   │ Citations    │
  └──────┬──────┘     └──────┬───────┘              └────────────────┘   └──────────────┘
         │                   │ (FAIR Provenance:
         ▼                   │  assembly, taxid, version)
  ╔══════════════════════════╧══════════════════════════════╗
  ║                Provider Orchestrator                    ║
  ╚══════════════════════════╤══════════════════════════════╗
                             │
     ┌───────────┬───────────┼───────────┬─────────────┐
     ▼           ▼           ▼           ▼             ▼
   NCBI       Ensembl     UniProt     BV-BRC       Phytozome
 (Entrez)     (REST)      (REST)      (API)        (Plant DB)
```

### 3 Chế độ tìm kiếm (Search Modes):
| Chế độ | Mô tả | Ứng dụng thực tế |
| :--- | :--- | :--- |
| `local_first` *(Mặc định)* | Kiểm tra Cache & Database trước, nếu chưa có sẽ gọi API quốc tế và tự động lưu lại | Tiết kiệm băng thông, tăng tốc độ 40-60 lần |
| `local_only` *(Offline)* | Chỉ tìm kiếm trong cơ sở dữ liệu nội bộ, không gửi request ra ngoài | Nghiên cứu bảo mật dữ liệu, làm việc khi mất mạng |
| `external_refresh` *(Force)* | Bắt buộc tải dữ liệu mới nhất từ máy chủ quốc tế và ghi đè dữ liệu cũ | Cập nhật các chú giải hệ gen mới nhất |

---

## 🚀 Hướng dẫn Cài đặt & Chạy / Quick Start

### 🐳 Cách 1: Chạy bằng Docker (Khuyên dùng - 1 lệnh duy nhất)

```bash
# 1. Clone mã nguồn
git clone https://github.com/pst2/BioLab-.git
cd BioLab-

# 2. Khởi chạy toàn bộ hệ thống
docker compose up --build
```

- **Giao diện người dùng**: [http://localhost:3000](http://localhost:3000)
- **Tài liệu Swagger API**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 🛠 Cách 2: Chạy trực tiếp trên máy (Local Development)

#### Bước 1: Khởi động Backend (FastAPI)
```powershell
cd backend_scaffold

# Tạo và kích hoạt môi trường ảo
py -m venv .venv
.\.venv\Scripts\Activate.ps1   # Trên Windows (hoặc source .venv/bin/activate trên Linux/macOS)

# Cài đặt thư viện phụ thuộc
pip install -r requirements.txt

# Chạy cập nhật database migration (Alembic)
alembic upgrade head

# Khởi động Backend server
py -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Bước 2: Khởi động Frontend (Next.js)
```powershell
cd bio_frontend

# Cài đặt dependencies (nếu chưa cài)
npm install

# Khởi động Next.js development server
npm run dev
```

Truy cập hệ thống tại: **[http://localhost:3000](http://localhost:3000)**.

---

## 🧪 Kiểm thử Tự động / Testing Suite

Dự án được kiểm soát chất lượng nghiêm ngặt bởi bộ kiểm thử tự động toàn diện **75 bài test**:

```bash
# Chạy toàn bộ kiểm thử Backend
cd backend_scaffold
pytest -v
```

```text
============================= test session starts =============================
platform win32 -- Python 3.10.8, pytest-8.3.3
plugins: anyio-4.12.1, asyncio-0.24.0
collected 75 items

tests/test_bioinformatics_upgrade.py ..............                      [ 18%]
tests/test_exceptions.py ....                                            [ 24%]
tests/test_health.py ....                                                [ 29%]
tests/test_ncbi_client.py .....                                          [ 36%]
tests/test_rate_limit.py ..                                              [ 38%]
tests/test_research_features.py ...........                              [ 53%]
tests/test_search_services.py .......                                    [ 62%]
tests/test_security.py .....                                             [ 69%]
tests/test_sequence.py .........                                         [ 81%]
tests/test_system.py ....                                                [ 86%]
tests/test_validators.py ..........                                      [100%]

============================= 75 passed in 10.41s =============================
```

---

## 📑 Chuẩn dữ liệu FAIR & Xuất file Nghiên cứu

Hệ thống cung cấp sẵn các endpoint tải dữ liệu phục vụ nghiên cứu và xuất bản khoa học:

| Định dạng | Endpoint API | Mục đích nghiên cứu |
| :--- | :--- | :--- |
| **FASTA** | `GET /api/v1/export/gene/{id}/fasta` | Phục vụ căn hàng BLAST, ClustalW, xây dựng cây phát sinh |
| **GenBank** | `GET /api/v1/export/gene/{id}/genbank` | Flatfile chuẩn đầy đủ LOCUS, DEFINITION, FEATURES, ORIGIN |
| **BED Track** | `GET /api/v1/export/gene/{id}/bed` | Nạp tọa độ Exon/Intron vào IGV.js, UCSC Genome Browser |
| **JSON** | `GET /api/v1/export/gene/{id}/json` | Dữ liệu cấu trúc máy đọc, phục vụ pipeline tin sinh học tự động |
| **CSV** | `GET /api/v1/export/search/csv?q=...` | Bảng tính tổng hợp kết quả tìm kiếm đa nguồn |
| **BibTeX** | `GET /api/v1/export/citation/bibtex?pmid=...` | File `.bib` nạp trực tiếp vào LaTeX, Overleaf |
| **RIS** | `GET /api/v1/export/citation/ris?pmid=...` | File `.ris` nạp vào Zotero, Mendeley, EndNote |

---

## 📖 API Documentation

Khi Backend đang chạy, truy cập tài liệu API trực tiếp tại:
- **Swagger UI (Interactive API Docs)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc (Detailed Schema Documentation)**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Các Endpoint API cốt lõi:
```text
GET  /api/v1/health                                 # Kiểm tra trạng thái hệ thống, DB và NCBI
GET  /api/v1/system/stats                          # Thống kê số bản ghi, providers, tỷ lệ thành công
GET  /api/v1/genes/search?q=BRCA1&provider=all     # Tìm kiếm gen đa nguồn kèm fallback
GET  /api/v1/genes/{id}                            # Chi tiết gen, tọa độ genome, protein info
GET  /api/v1/sequence/igv/fasta?accession=...      # Cắt FASTA động cho IGV Genome Browser
POST /api/v1/sequence/analyze                      # Phân tích DNA/RNA/Protein, ORF, codon, GC
POST /api/v1/sequence/blast                        # Gửi và theo dõi tiến trình BLAST
GET  /api/v1/pubmed/search?q=cancer                # Khai phá bài báo khoa học PubMed
GET  /api/v1/workspace/overview                    # Tổng quan tỷ lệ độc lập dữ liệu nội bộ
```

---

## 🎓 Tài liệu Bảo vệ Đồ án / Thesis Defense Guide

Để chuẩn bị tốt nhất cho buổi bảo vệ đồ án tốt nghiệp / hội đồng khoa học, vui lòng xem tài liệu chi tiết:
👉 **[Xem Hướng dẫn Bảo vệ Đồ án Chi tiết (DO_AN_BAO_VE_GUIDE.md)](./DO_AN_BAO_VE_GUIDE.md)**

Nội dung bao gồm:
1. Đánh giá tính khoa học & tính thực tiễn theo chuẩn công cụ nghiên cứu tin sinh học.
2. Kịch bản thuyết trình & Live Demo từng phút (7 - 10 phút).
3. Các ca kiểm thử thực tế với gen ung thư (`BRCA1`, `TP53`), protein UniProt (`P38398`), và trình tự virus.
4. Bộ câu hỏi phản biện chuyên sâu từ Hội đồng và hướng dẫn trả lời kỹ thuật.

---

## 📄 Bản quyền / License
Dự án được phân phối dưới giấy phép **MIT License**.
Mọi thông tin đóng góp và phản hồi xin vui lòng tạo Issue hoặc Pull Request trên kho mã nguồn [GitHub BioLab](https://github.com/pst2/BioLab-).
