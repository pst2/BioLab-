<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0ea5e9,100:6366f1&height=220&section=header&text=BioLab%20Workspace&fontSize=60&fontColor=ffffff&fontAlignY=38&desc=A%20Modern%20Full-Stack%20Bioinformatics%20%26%20Genomics%20Platform&descAlignY=58&descSize=18&descColor=cbd5e1" width="100%"/>

<br/>

<p>
  <a href="https://github.com/pst2/BioLab-/actions">
    <img src="https://img.shields.io/badge/CI-45%2F45%20Passed-22c55e?style=for-the-badge&logo=githubactions&logoColor=white" />
  </a>
  <a href="https://www.python.org/downloads/">
    <img src="https://img.shields.io/badge/Python-3.10%2B-3776ab?style=for-the-badge&logo=python&logoColor=white" />
  </a>
  <a href="https://fastapi.tiangolo.com/">
    <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  </a>
  <a href="https://nextjs.org/">
    <img src="https://img.shields.io/badge/Next.js-15.5-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
  </a>
  <a href="https://react.dev/">
    <img src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=black" />
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript&logoColor=white" />
  </a>
</p>

<br/>

> **🧬 Multi-Provider Gene Discovery · 🗺️ Interactive IGV.js Genome Browser · 🔬 BLAST Sequence Analysis · 📚 PubMed Literature Mining · 💾 Local-First Architecture**

<br/>

<a href="#-tính-năng-nổi-bật--key-features">Tính năng / Features</a> •
<a href="#-kiến-trúc-hệ-thống--architecture">Kiến trúc / Architecture</a> •
<a href="#-hướng-dẫn-chạy--quick-start">Cài đặt / Quick Start</a> •
<a href="#-tài-liệu-bảo-vệ-đồ-án--thesis-defense-guide">Bảo vệ đồ án / Defense Guide</a> •
<a href="#-api-documentation">API Docs</a>

<br/>

</div>

---

## 🌟 Giới thiệu tổng quan / Overview

**BioLab Workspace** là một nền tảng tin sinh học toàn diện (Full-Stack Bioinformatics Platform) được thiết kế theo triết lý **Local-First & Multi-Tier Caching**. 

Hệ thống cho phép các nhà nghiên cứu, sinh viên và kỹ sư y sinh dễ dàng:
1. **Tìm kiếm và khám phá dữ liệu sinh học** tích hợp đồng thời từ 4 kho dữ liệu quốc tế lớn: **NCBI (Entrez API)**, **Ensembl**, **UniProt**, và **BV-BRC**.
2. **Trực quan hóa hệ gen sống động** với trình duyệt **IGV.js (Integrated Genomics Viewer)** tích hợp sẵn, hỗ trợ trích xuất FASTA slice động và chuẩn hóa tọa độ tự động.
3. **Phân tích trình tự & chạy đối chiếu BLAST** với công cụ đếm bazơ, tính tỷ lệ GC/AT, phát hiện đặc tính acid amin và theo dõi tiến trình BLAST bất đồng bộ.
4. **Khai phá y văn PubMed** với khả năng trích xuất DOI, tác giả, abstract và lưu trữ nghiên cứu vào không gian làm việc cá nhân.

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 QUY TRÌNH TRUY VẤN DỮ LIỆU              │
                  │ Cache (In-Memory) ──► Local DB ──► NCBI Entrez API       │
                  │ ──► Fallback Providers (Ensembl / UniProt) ──► Mock Data │
                  └─────────────────────────────────────────────────────────┘
```

---

## ✨ Tính năng nổi bật / Key Features

<table>
<tr>
<td width="50%" valign="top">

### 🧬 1. Khám phá Gen & Dữ liệu Sinh học
- **Hỗ trợ 3 loại dữ liệu**: Gene, Nucleotide (DNA/RNA), Protein.
- **Tìm kiếm đa chế độ**: Theo tên ký hiệu (*Symbol*), mã định danh (*ID/Accession*), lọc theo sinh vật học (*Organism*).
- **Phục hồi & Dung lỗi (Fault-Tolerance)**: Tự động chuyển đổi nhà cung cấp dự phòng khi máy chủ NCBI bị nghẽn mạng hoặc quá tải.

### 🗺️ 2. Trình duyệt Hệ gen IGV.js tích hợp
- **Trực quan hóa Locus**: Zoom in/out từ quy mô nhiễm sắc thể xuống từng nucleotide cụ thể.
- **Dynamic FASTA Slicing**: Trích xuất đúng cửa sổ trình tự cần xem kèm đệm (`LOCUS_PADDING = 5,000 bp`), cho phép duyệt các đoạn gen dài hàng chục Mbp mượt mà.
- **Tự động chuẩn hóa tọa độ**: Xử lý hoàn hảo các gen trên strand âm (Minus Strand) với cơ chế đảo chiều tọa độ `start <= end`.

</td>
<td width="50%" valign="top">

### 🔬 3. Phân tích Trình tự & BLAST
- **Phân tích thành phần Nucleotide**: Biểu đồ Donut GC Content, bảng tỷ lệ A, T, G, C, U, N và nhóm acid amin theo tính chất hóa học.
- **Hỗ trợ Bản ghi lớn**: Tự động hiển thị tóm lược `N/A` trực quan cho các bản ghi lớn (> 50 kbp) để tránh làm treo trình duyệt.
- **BLAST Job Runner**: Gửi và kiểm tra kết quả đối chiếu trình tự NCBI / EBI BLAST không đồng bộ.

### 📚 4. Khai phá Y văn PubMed & Song ngữ
- **PubMed Explorer**: Tìm kiếm bài báo khoa học, xem tác giả, DOI, ngày xuất bản và tóm tắt nghiên cứu.
- **Giao diện Song ngữ**: Hỗ trợ chuyển đổi nhanh **Tiếng Việt 🇻🇳** và **Tiếng Anh 🇬🇧**.
- **Giao diện Khoa học**: Dark mode & Light mode chuyên nghiệp, chuẩn responsive.

</td>
</tr>
</table>

---

## 🏛 Kiến trúc Hệ thống / Architecture

```
                          ╔═════════════════════════╗
                          ║   Next.js 15 Frontend   ║
                          ║  (React 19 + TypeScript)║
                          ╚════════════╤════════════╝
                                       │ HTTP / Next.js Proxy
                                       ▼
                          ╔═════════════════════════╗
                          ║     FastAPI Backend     ║
                          ║ Auth · RateLimit · CORS ║
                          ╚════════════╤════════════╝
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
     ┌─────────────┐            ┌──────────────┐          ┌────────────────┐
     │ In-Memory   │            │ SQLite DB    │          │  PubMed &      │
     │ Cache Repos │            │ (SQLAlchemy) │          │  BLAST Service │
     └──────┬──────┘            └──────────────┘          └────────────────┘
            │
            ▼
   ╔══════════════════╗
   ║ Provider         ║
   ║ Orchestrator     ║
   ╚════════╤═════════╝
            │
   ┌────────┼─────────┬──────────┐
   ▼        ▼         ▼          ▼
 NCBI    Ensembl   UniProt     BV-BRC
```

### 3 Chế độ tìm kiếm (Search Modes):
| Chế độ | Mô tả | Ứng dụng thực tế |
| :--- | :--- | :--- |
| `local_first` *(Mặc định)* | Kiểm tra Cache & Database trước, nếu chưa có sẽ tải từ NCBI và tự động lưu lại | Tiết kiệm băng thông, tăng tốc độ 40-60 lần |
| `local_only` *(Offline)* | Chỉ tìm kiếm trong cơ sở dữ liệu nội bộ, không gửi request ra ngoài | Làm việc khi mất mạng hoặc bảo vệ dữ liệu bí mật |
| `external_refresh` *(Force)* | Bắt buộc tải dữ liệu mới nhất từ máy chủ quốc tế và ghi đè dữ liệu cũ | Cập nhật các chú giải hệ gen mới nhất |

---

## 🚀 Hướng dẫn Chạy / Quick Start

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
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Trên Windows (hoặc source .venv/bin/activate trên Linux/macOS)

# Cài đặt thư viện
pip install -r requirements.txt

# Khởi động Backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Bước 2: Khởi động Frontend (Next.js)
```powershell
cd bio_frontend

# Cài đặt dependencies
npm install

# Khởi động dev server
npm run dev
```

Mở trình duyệt tại [http://localhost:3000](http://localhost:3000).

---

## 🧪 Kiểm thử Tự động / Testing Suite

Dự án được bảo vệ bởi bộ kiểm thử tự động toàn diện trên Backend và Frontend:

```bash
# Chạy toàn bộ 45 bài kiểm thử Backend
cd backend_scaffold
pytest -v
```

```text
============================= test session starts =============================
collected 45 items

tests\test_exceptions.py ....                                            [  8%]
tests\test_health.py ....                                                [ 17%]
tests\test_ncbi_client.py .....                                          [ 28%]
tests\test_rate_limit.py ..                                              [ 33%]
tests\test_search_services.py .......                                    [ 48%]
tests\test_security.py .....                                             [ 60%]
tests\test_sequence.py .......                                           [ 75%]
tests\test_system.py ....                                                [ 84%]
tests\test_validators.py .......                                         [100%]

============================= 45 passed in 7.61s ==============================
```

```bash
# Kiểm tra build Frontend Next.js 15
cd bio_frontend
npm run build
```

---

## 🎓 Tài liệu Bảo vệ Đồ án / Thesis Defense Guide

Để chuẩn bị tốt nhất cho buổi bảo vệ đồ án tốt nghiệp / bảo vệ đề tài, vui lòng xem tài liệu chi tiết:
👉 **[Xem Tài liệu Hướng dẫn Bảo vệ Đồ án Chi tiết (DO_AN_BAO_VE_GUIDE.md)](./DO_AN_BAO_VE_GUIDE.md)**

Tài liệu bao gồm:
1. Phân tích chi tiết tính cấp thiết và giải pháp kỹ thuật.
2. Kịch bản thuyết trình & Live Demo từng phút (7 - 10 phút).
3. 5 kịch bản demo mẫu kèm từ khóa sinh học thực tế (`BRCA1`, `OZ477478`, `P38398`,...).
4. Bộ 15+ câu hỏi phản biện chuyên sâu từ Hội đồng và đáp án kỹ thuật chuẩn xác.

---

## 📖 API Documentation

Khi Backend đang chạy, bạn có thể truy cập hệ thống tài liệu API tương tác trực tiếp:
- **Swagger UI (Interactive API Docs)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc (Detailed Schema Documentation)**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Các Endpoint API chính:
| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Kiểm tra trạng thái sức khỏe hệ thống, database và kết nối NCBI |
| `GET` | `/api/v1/genes/search` | Tìm kiếm bản ghi sinh học (Gene, Nucleotide, Protein) với bộ lọc |
| `GET` | `/api/v1/genes/{id}` | Lấy chi tiết bản ghi gen, thông tin tọa độ hệ gen và cấu trúc protein |
| `GET` | `/api/v1/sequence/igv/fasta` | Trích xuất lát cắt FASTA phục vụ trực quan hóa IGV Genome Browser |
| `POST` | `/api/v1/sequence/analyze` | Phân tích trình tự FASTA, đếm tỷ lệ GC/AT và nucleotide |
| `GET` | `/api/v1/literature/search` | Tìm kiếm bài báo khoa học trên cổng PubMed |
| `GET` | `/api/v1/system/stats` | Thống kê số lượng bản ghi đã lưu, số lượt truy vấn và tỷ lệ cache hit |

---

## 📄 Bản quyền / License
Dự án được phân phối dưới giấy phép **MIT License**.
Mọi thông tin đóng góp và phản hồi xin vui lòng tạo Issue hoặc Pull Request trên kho mã nguồn [GitHub BioLab](https://github.com/pst2/BioLab-).
