# BioLab Frontend (Next.js 15 + React 19)

Modern, high-performance web interface for the BioLab bioinformatics and genomics workspace.

## 🚀 Technologies

- **Framework**: Next.js 15.5 (App Router, Server & Client Components)
- **UI Library**: React 19 + TypeScript 5
- **Styling**: Tailwind CSS + Lucide Icons + Custom Modern Dark/Light themes
- **Genomics Visualizer**: IGV.js (`igv`) for interactive genome track browsing
- **Proxy**: Next.js Route Handler Proxy (`/api/backend/*`) with automatic backend host failover

## 🧬 Key Modules

- **Multi-Provider Gene Search**: Search genes, nucleotides, and proteins across NCBI, Ensembl, UniProt, BV-BRC, and Phytozome with filter chips and fallback toggles.
- **Interactive IGV.js Genome Browser**: Chromosome zoom, dynamic locus FASTA slicing, and exon track display.
- **Sequence & Protein Analysis Panel**:
  - Nucleotide Donut charts & base composition tables
  - Codon usage frequency & GC sliding windows
  - Physicochemical protein properties: pI, Molecular Weight, GRAVY hydropathy, Instability Index
  - 6-Frame Open Reading Frame (ORF) visualizer
- **Async BLAST Search**: Real-time polling with visual Query-Subject alignment viewer.
- **PubMed Literature Explorer**: Direct search with BibTeX / RIS citation download buttons.
- **FAIR Data Exports**: 1-click download buttons for FASTA, GenBank (.gb), BED, and JSON.

## 🛠 Local Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## ⚙️ Environment Configuration

Configuration in `.env.local`:
```env
BACKEND_INTERNAL_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_KEY=dev-key-1
```
