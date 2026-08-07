"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";

export type Language = "vi" | "en";
export type Theme = "light" | "dark" | "system";
export type Translate = (key: string) => string;

const STORAGE_KEY = "biolab:language";
const THEME_STORAGE_KEY = "biolab:theme";

const dictionary: Record<Language, Record<string, string>> = {
  vi: {
    "language.vi": "Tiếng Việt",
    "language.en": "English",
    "language.toggle": "Ngôn ngữ",
    "workspace": "Không gian BioLab",
    "tab.dashboard": "Dashboard",
    "tab.search": "Tìm kiếm gene",
    "tab.sequence": "Phân tích sequence",
    "tab.api": "API Explorer",
    "tab.settings": "Cài đặt",
    "status.online": "Online",
    "status.offline": "Offline",
    "status.checking": "Đang kiểm tra",
    "status.idle": "Chưa kiểm tra",
    "sidebar.subtitle": "Nghiên cứu hệ gene",
    "sidebar.newAnalysis": "Phân tích mới",
    "sidebar.autoFallback": "Tự động fallback",
    "dashboard.badge": "Không gian làm việc Tin sinh học",
    "dashboard.title": "Tìm kiếm gene, xem FASTA và trực quan hóa dữ liệu sinh học.",
    "dashboard.desc": "UI tối giản nhưng vẫn giữ FastAPI backend, Next proxy, multi-provider fallback, sequence analysis và trang chi tiết gene.",
    "metric.genesIndexed": "Số gen đã lập chỉ mục",
    "metric.providers": "Nhà cung cấp hoạt động",
    "metric.successRate": "Tỷ lệ thành công",
    "metric.queriesToday": "Truy vấn hôm nay",
    "metric.monthGrowth": "+{percent}% tháng này",
    "dashboard.sub.localFirst": "Ưu tiên cục bộ trước",
    "dashboard.sub.realtime": "Truy vấn thời gian thực",
    "dashboard.startSearch": "Bắt đầu tìm gen",
    "dashboard.analyzeSequence": "Phân tích trình tự",
    "dashboard.quickTargets": "Mục tiêu nhanh",
    "dashboard.quickTargetsSub": "Các mục tiêu gen ung thư thường tra cứu",
    "dashboard.searchViaBackend": "Tìm qua backend",
    "feature.search.title": "Tìm kiếm gene",
    "feature.search.text": "Tìm theo symbol, accession, ID, organism và provider.",
    "feature.visualization.title": "Trực quan hóa",
    "feature.visualization.text": "GC content, nucleotide composition và metadata sequence.",
    "feature.fallback.title": "Dữ liệu fallback",
    "feature.fallback.text": "Tự động thử nhiều provider và dữ liệu local/bundled.",
    "search.badge": "Công cụ tìm kiếm gene",
    "search.title": "Tra cứu gene, accession và FASTA metadata",
    "search.desc": "Nhập gene/accession, dùng bộ lọc nâng cao khi cần, và để backend xử lý local cache hoặc multi-provider fallback.",
    "search.placeholder": "BRCA1, TP53, EGFR, ENSG00000012048...",
    "search.filters": "Bộ lọc",
    "search.advancedFilters": "Bộ lọc nâng cao",
    "search.button": "Tìm kiếm",
    "search.dataType": "Loại dữ liệu",
    "search.searchBy": "Tìm theo",
    "search.mode": "Chế độ",
    "search.provider": "Nguồn dữ liệu",
    "search.organism": "Lọc organism",
    "search.organismPlaceholder": "Homo sapiens, Arabidopsis thaliana...",
    "search.fallbackFlow": "Tự động fallback: NCBI → Ensembl → UniProt → BV-BRC → Phytozome → dữ liệu local",
    "search.failed": "Tìm kiếm thất bại",
    "search.backendResponse": "Phản hồi backend",
    "search.emptyTitle": "Chưa có kết quả hiển thị",
    "search.emptyMessage": "Nhập gene hoặc accession ID rồi bấm Tìm kiếm. Bộ lọc nâng cao được thu gọn để giao diện gọn hơn.",
    "select.gene": "Gene",
    "select.nucleotide": "Nucleotide",
    "select.protein": "Protein",
    "select.name": "Tên / Symbol",
    "select.accession": "Accession",
    "select.id": "ID",
    "select.localFirst": "Ưu tiên local",
    "select.localOnly": "Chỉ local",
    "select.externalRefresh": "Làm mới external",
    "select.autoFallback": "Tự động fallback",
    "geneCard.accession": "Accession",
    "geneCard.organism": "Organism",
    "geneCard.external": "External",
    "geneCard.viewDetail": "Xem chi tiết",
    "geneCard.noDescription": "Chưa có mô tả.",
    "sequence.badge": "Phân tích sequence",
    "sequence.title": "Phân tích DNA sequence",
    "sequence.desc": "Gửi sequence đến backend và trực quan hóa length, GC content, nucleotide composition, reverse complement và RNA transcript.",
    "sequence.button": "Phân tích sequence",
    "sequence.metrics": "Chỉ số genome",
    "sequence.outputs": "Kết quả tạo ra",
    "sequence.copyReverse": "Copy reverse complement",
    "sequence.reverse": "Reverse complement",
    "sequence.rna": "RNA transcript",
    "sequence.emptyTitle": "Chưa chạy phân tích",
    "sequence.emptyMessage": "Dán chuỗi DNA vào khung bên trái để xem GC content và nucleotide composition.",
    "sequence.length": "Độ dài",
    "sequence.validBases": "Base hợp lệ",
    "blast.subtabAnalyze": "Thành phần & Chỉ số",
    "blast.subtabBlast": "Tìm kiếm tương đồng BLAST",
    "blast.badge": "NCBI / EBI / UniProt Alignment",
    "blast.title": "Tìm kiếm tương đồng BLAST",
    "blast.desc": "Gửi trình tự tới máy chủ BLAST từ xa với cơ chế tự động chuyển đổi nguồn (failover).",
    "blast.seqType": "Loại trình tự",
    "blast.seqTypeAuto": "Tự động phát hiện",
    "blast.seqTypeDna": "DNA / Nucleotide",
    "blast.seqTypeProtein": "Protein / Axit amin",
    "blast.provider": "Nguồn thực thi",
    "blast.providerAuto": "Tự động chọn",
    "blast.providerEbi": "EBI NCBI-BLAST",
    "blast.providerUniprot": "UniProt BLAST",
    "blast.databaseFilter": "Bộ lọc CSDL",
    "blast.databasePlaceholder": "VD: em_std, uniprotkb_swissprot",
    "blast.placeholder": "Dán trình tự FASTA hoặc DNA/Protein thô...",
    "blast.submit": "Gửi yêu cầu tìm kiếm BLAST",
    "blast.submitting": "Đang gửi...",
    "blast.reset": "Đặt lại mẫu",
    "blast.inProgress": "Đang thực thi tìm kiếm BLAST...",
    "blast.jobId": "Mã công việc",
    "blast.status": "Trạng thái",
    "blast.polling": "Đang truy vấn...",
    "blast.failed": "Tìm kiếm BLAST thất bại",
    "blast.retry": "Thử lại công việc BLAST",
    "blast.emptyTitle": "Không tìm thấy căn gióng phù hợp",
    "blast.emptyDesc": "Không có trình tự nào vượt qua ngưỡng ý nghĩa cho truy vấn này. Hãy thử chọn cơ sở dữ liệu rộng hơn.",
    "blast.alignmentsFound": "Căn gióng tìm thấy",
    "blast.identity": "Tương đồng",
    "blast.eValue": "Chỉ số E-value",
    "blast.coverage": "Độ phủ",
    "blast.details": "Chi tiết",
    "blast.sampleDna": "Tải mẫu DNA",
    "blast.sampleProtein": "Tải mẫu Protein",
    "blast.elapsed": "Thời gian chạy",
    "api.title": "API Explorer",
    "api.desc": "Khu vực kiểm thử nhanh các endpoint đang dùng trong frontend cũ.",
    "api.loading": "Đang tải...",
    "api.empty": "Chạy một endpoint để xem JSON tại đây.",
    "settings.runtime": "Runtime Safety",
    "settings.runtimeDesc": "Toàn bộ lỗi API được bắt và hiển thị thân thiện. Nếu backend trả về 403 (NCBI rate-limit) hoặc timeout, frontend sẽ fallback sang cache local.",
    "settings.data": "Chiến lược dữ liệu",
    "settings.dataDesc": "Hệ thống ưu tiên cache local trước, sau đó gọi NCBI → Ensembl → UniProt → BV-BRC → Phytozome theo thứ tự. Dữ liệu bundled đảm bảo fallback offline.",
    "settings.ux": "Bioinformatics UX",
    "settings.uxDesc": "Line-numbered FASTA viewer, GC donut SVG, nucleotide composition bars, tag hệ thống theo loại gene và organism, skeleton loading placeholder.",
    "settings.snapshot": "Backend snapshot",
    "settings.snapshotEmpty": "Bấm system status ở header để lấy health data.",
    "detail.geneOverview": "Tổng quan gene",
    "common.unknown": "Không rõ",
    "common.notAvailable": "Không có dữ liệu",
    "detail.back": "Quay lại",
    "detail.breadcrumbSearch": "Tìm kiếm gene",
    "detail.breadcrumbDetail": "Chi tiết gene",
    "detail.refresh": "Làm mới",
    "detail.providerWarning": "Cảnh báo provider",
    "detail.loadingTitle": "Đang tải bản ghi gene...",
    "detail.loadingDesc": "Đang lấy dữ liệu chi tiết từ endpoint backend hiện tại.",
    "detail.overview": "Tổng quan",
    "detail.sequence": "Sequence",
    "detail.visualization": "Trực quan hóa",
    "detail.metadata": "Metadata",
    "detail.cached": "Dữ liệu cache",
    "detail.verified": "Bản ghi đã xác thực",
    "detail.refreshing": "Đang làm mới",
    "detail.organism": "Organism",
    "detail.source": "Nguồn",
    "detail.export": "Xuất dữ liệu",
    "detail.sequenceLength": "Độ dài sequence",
    "detail.gcContent": "GC Content",
    "detail.highConfidence": "Annotation độ tin cậy cao",
    "detail.copy": "Copy",
    "detail.copied": "Đã copy",
    "detail.wrapText": "Xuống dòng",
    "detail.sequenceAvailable": "Có sequence",
    "detail.noSequence": "Chưa có sequence",
    "detail.notFoundTitle": "Không tìm thấy dữ liệu chi tiết",
    "detail.notFoundMessage": "Backend không trả về bản ghi usable cho gene ID này.",
    "detail.retry": "Thử lại",
    "detail.id": "ID",
    "detail.descriptionUnavailable": "Chưa có mô tả.",
    "detail.summaryUnavailable": "Chưa có tóm tắt.",
    "detail.gcRatio": "Tỷ lệ GC",
    "detail.nucleotideComposition": "Thành phần nucleotide",
    "detail.length": "Độ dài",
    "detail.atContent": "AT Content",
    "detail.sequenceFasta": "Sequence FASTA",
    "detail.fastaUnavailable": "Chưa có FASTA. Hãy thử làm mới dữ liệu external hoặc mở một accession được hỗ trợ.",
    "detail.functionalDomains": "Vùng chức năng",
    "detail.feature": "Đặc điểm",
    "detail.providerFeatureAnnotation": "Chú thích đặc điểm từ provider",
    "detail.noDomains": "Chưa có domain protein hoặc chú thích transcript feature.",
    "detail.metadataSourceContext": "Metadata và ngữ cảnh nguồn",
    "detail.providerAnnotation": "Chú thích từ provider",
    "detail.providerAnnotationFallback": "Bản ghi này được ánh xạ từ phản hồi backend/provider hiện tại. Dữ liệu fallback/local sẽ được đánh dấu khi backend trả về.",
    "detail.database": "Cơ sở dữ liệu",
    "detail.assembly": "Assembly",
    "detail.geneSummary": "Tóm tắt gene",
    "detail.symbol": "Symbol",
    "detail.name": "Tên",
    "detail.accession": "Accession",
    "detail.lastSynced": "Đồng bộ lần cuối",
    "detail.chromosomeLocation": "Vị trí nhiễm sắc thể",
    "detail.strand": "Mạch",
    "detail.transcriptExonStructure": "Cấu trúc transcript / exon",
    "detail.transcript": "Transcript",
    "detail.unknownBiotype": "Biotype không rõ",
    "detail.exons": "exon",
    "detail.noTranscript": "Provider hiện tại chưa trả về cấu trúc transcript/exon.",
    "detail.proteinInformation": "Thông tin protein",
    "detail.proteinNameUnavailable": "Chưa có tên protein.",
    "detail.noProtein": "Provider hiện tại chưa trả về thông tin protein.",
    "detail.noProteinFeatures": "Chưa có chú thích feature/domain protein.",
    "detail.aliases": "Tên gọi khác",
    "detail.noAliases": "Chưa có alias.",
    "detail.viewOn": "Xem trên {provider}",
    "detail.truncated": "... đã rút gọn trong giao diện ({count} ký tự tổng cộng)",
    "detail.unknownOrganism": "Organism không rõ",
    "detail.ncbiGeneId": "NCBI Gene ID",
    "detail.ensemblGeneId": "Ensembl Gene ID",
    "detail.uniprotAccession": "UniProt Accession",
    "detail.bvbrcFeatureId": "BV-BRC Feature ID",
    "detail.localGeneId": "Local Gene ID",
    "detail.sourceId": "Source ID",
    "detail.loadFailed": "Không thể tải chi tiết gene.",
    "detail.showingCache": "Đang hiển thị tạm dữ liệu cache từ trình duyệt.",
    "detail.proteinLength": "Độ dài protein",
    "detail.molecularWeight": "Khối lượng phân tử",
    "detail.estimatedFromSequence": "Ước tính từ sequence",
    "detail.aminoAcidComposition": "Thành phần amino acid",
    "detail.uniqueAminoAcids": "Amino acid khác nhau",
    "detail.noAminoAcidComposition": "Chưa có sequence protein để tính thành phần amino acid.",
    "detail.nucleotideOutputs": "Kết quả nucleotide",
    "detail.reverseComplement": "Reverse complement",
    "detail.rnaTranscript": "RNA transcript",
    "detail.noNucleotideSequence": "Chưa có sequence nucleotide để tạo dữ liệu này.",
    "detail.uniprotAnnotation": "Chú thích UniProt",
    "detail.proteinFasta": "FASTA protein",
    "detail.nucleotideFasta": "FASTA nucleotide",
    "theme.light": "Sáng",
    "theme.dark": "Tối",
    "theme.system": "Hệ thống",
    "theme.toggle": "Chuyển giao diện",
    "toast.copied": "Đã sao chép!",
    "toast.copyFasta": "Đã sao chép FASTA",
    "toast.copySequence": "Đã sao chép trình tự",
    "toast.searchSuccess": "Tìm thấy kết quả",
    "toast.searchEmpty": "Không tìm thấy kết quả nào",
    "toast.analysisComplete": "Phân tích hoàn tất",
    "toast.serverOnline": "Server đang hoạt động",
    "toast.serverOffline": "Không thể kết nối server",
    "toast.rateLimited": "Quá nhiều yêu cầu. Vui lòng chờ.",
    "toast.usingCache": "Đang dùng dữ liệu đã lưu",
    "toast.showAll": "Hiện tất cả",
    "toast.showLess": "Thu gọn",
    "detail.aaPropertyBasic": "Bazơ",
    "detail.aaPropertyAcidic": "Axit",
    "detail.aaPropertyPolar": "Phân cực",
    "detail.aaPropertyHydrophobic": "Kỵ nước",
    "detail.aaDistribution": "Phân bố theo tính chất",
  },
  en: {
    "language.vi": "Tiếng Việt",
    "language.en": "English",
    "language.toggle": "Language",
    "workspace": "BioLab workspace",
    "tab.dashboard": "Dashboard",
    "tab.search": "Gene Search",
    "tab.sequence": "Sequence Analysis",
    "tab.api": "API Explorer",
    "tab.settings": "Settings",
    "status.online": "Online",
    "status.offline": "Offline",
    "status.checking": "Checking",
    "status.idle": "Not checked",
    "sidebar.subtitle": "Genomic Research",
    "sidebar.newAnalysis": "New analysis",
    "sidebar.autoFallback": "Auto fallback",
    "dashboard.badge": "Bioinformatics workspace",
    "dashboard.title": "Search genes, inspect FASTA and visualize biological data.",
    "dashboard.desc": "A minimal UI that keeps your FastAPI backend, Next proxy, multi-provider fallback, sequence analysis and gene detail page.",
    "metric.genesIndexed": "Genes Indexed",
    "metric.providers": "Providers Active",
    "metric.successRate": "Success Rate",
    "metric.queriesToday": "Queries Today",
    "metric.monthGrowth": "+{percent}% this month",
    "dashboard.sub.localFirst": "Local-first fallback",
    "dashboard.sub.realtime": "Real-time queries",
    "dashboard.startSearch": "Start gene search",
    "dashboard.analyzeSequence": "Analyze sequence",
    "dashboard.quickTargets": "Quick Targets",
    "dashboard.quickTargetsSub": "Frequently searched cancer and oncogene targets",
    "dashboard.searchViaBackend": "Search via backend",
    "feature.search.title": "Gene search",
    "feature.search.text": "Search by symbol, accession, ID, organism and provider.",
    "feature.visualization.title": "Visualization",
    "feature.visualization.text": "GC content, nucleotide composition and sequence metadata.",
    "feature.fallback.title": "Fallback data",
    "feature.fallback.text": "Auto provider fallback with local/bundled reference support.",
    "search.badge": "Gene search engine",
    "search.title": "Search genes, accessions and FASTA metadata",
    "search.desc": "Enter a gene/accession, open advanced filters when needed, and let the backend handle local cache or multi-provider fallback.",
    "search.placeholder": "BRCA1, TP53, EGFR, ENSG00000012048...",
    "search.filters": "Filters",
    "search.advancedFilters": "Advanced filters",
    "search.button": "Search",
    "search.dataType": "Data type",
    "search.searchBy": "Search by",
    "search.mode": "Mode",
    "search.provider": "Provider",
    "search.organism": "Organism filter",
    "search.organismPlaceholder": "Homo sapiens, Arabidopsis thaliana...",
    "search.fallbackFlow": "Auto fallback: NCBI → Ensembl → UniProt → BV-BRC → Phytozome → local reference",
    "search.failed": "Search failed",
    "search.backendResponse": "Backend response",
    "search.emptyTitle": "No results yet",
    "search.emptyMessage": "Enter a gene or accession ID and press Search. Advanced filters stay collapsed to keep the UI clean.",
    "select.gene": "Gene",
    "select.nucleotide": "Nucleotide",
    "select.protein": "Protein",
    "select.name": "Name / Symbol",
    "select.accession": "Accession",
    "select.id": "ID",
    "select.localFirst": "Local first",
    "select.localOnly": "Local only",
    "select.externalRefresh": "External refresh",
    "select.autoFallback": "Auto fallback",
    "geneCard.accession": "Accession",
    "geneCard.organism": "Organism",
    "geneCard.external": "External",
    "geneCard.viewDetail": "View Detail",
    "geneCard.noDescription": "No description available.",
    "sequence.badge": "Sequence analysis",
    "sequence.title": "Analyze DNA sequence",
    "sequence.desc": "Send the sequence to the backend and visualize length, GC content, nucleotide composition, reverse complement and RNA transcript.",
    "sequence.button": "Analyze sequence",
    "sequence.metrics": "Genome metrics",
    "sequence.outputs": "Generated outputs",
    "sequence.copyReverse": "Copy reverse complement",
    "sequence.reverse": "Reverse complement",
    "sequence.rna": "RNA transcript",
    "sequence.emptyTitle": "No analysis yet",
    "sequence.emptyMessage": "Paste a DNA sequence on the left to view GC content and nucleotide composition.",
    "sequence.length": "Length",
    "sequence.validBases": "Valid bases",
    "blast.subtabAnalyze": "Composition & Metrics",
    "blast.subtabBlast": "BLAST Similarity Search",
    "blast.badge": "NCBI / EBI / UniProt Alignment",
    "blast.title": "BLAST Similarity Search",
    "blast.desc": "Submit sequence to remote BLAST server with automatic provider failover.",
    "blast.seqType": "Sequence Type",
    "blast.seqTypeAuto": "Auto-detect",
    "blast.seqTypeDna": "DNA / Nucleotide",
    "blast.seqTypeProtein": "Protein / Amino Acid",
    "blast.provider": "Provider",
    "blast.providerAuto": "Auto-select",
    "blast.providerEbi": "EBI NCBI-BLAST",
    "blast.providerUniprot": "UniProt BLAST",
    "blast.databaseFilter": "Database Filter",
    "blast.databasePlaceholder": "e.g. em_std, uniprotkb_swissprot",
    "blast.placeholder": "Paste FASTA or raw DNA/Protein sequence...",
    "blast.submit": "Submit BLAST Search",
    "blast.submitting": "Submitting...",
    "blast.reset": "Reset Form",
    "blast.inProgress": "BLAST Search in Progress...",
    "blast.jobId": "Job ID",
    "blast.status": "Status",
    "blast.polling": "Polling...",
    "blast.failed": "BLAST Search Failed",
    "blast.retry": "Retry BLAST Job",
    "blast.emptyTitle": "No Alignments Found",
    "blast.emptyDesc": "No matching sequences exceeded the significance threshold for this query. Try choosing a broader database or selecting auto-detect sequence type.",
    "blast.alignmentsFound": "Alignments Found",
    "blast.identity": "Identity",
    "blast.eValue": "E-value",
    "blast.coverage": "Coverage",
    "blast.details": "Details",
    "blast.sampleDna": "Load Sample DNA",
    "blast.sampleProtein": "Load Sample Protein",
    "blast.elapsed": "Elapsed time",
    "api.title": "API Explorer",
    "api.desc": "Quick playground for endpoints used by the previous frontend.",
    "api.loading": "Loading...",
    "api.empty": "Run an endpoint to inspect JSON here.",
    "settings.runtime": "Runtime Safety",
    "settings.runtimeDesc": "All API errors are caught and displayed in a human-readable format. 403 (NCBI rate-limit) and timeout errors gracefully fall back to local cache.",
    "settings.data": "Data Strategy",
    "settings.dataDesc": "The system prioritizes local cache, then cascades through NCBI → Ensembl → UniProt → BV-BRC → Phytozome. Bundled reference data guarantees offline fallback.",
    "settings.ux": "Bioinformatics UX",
    "settings.uxDesc": "Line-numbered FASTA viewer, GC donut SVG, nucleotide composition bars, type-aware gene tags, organism tagging, and skeleton loading placeholders.",
    "settings.snapshot": "Backend snapshot",
    "settings.snapshotEmpty": "Click system status in the header to fetch health data.",
    "detail.geneOverview": "Gene Overview",
    "common.unknown": "Unknown",
    "common.notAvailable": "Not available",
    "detail.back": "Back",
    "detail.breadcrumbSearch": "Gene Search",
    "detail.breadcrumbDetail": "Gene Details",
    "detail.refresh": "Refresh",
    "detail.providerWarning": "Provider warning",
    "detail.loadingTitle": "Loading genomic record...",
    "detail.loadingDesc": "Fetching detail data from your existing backend endpoint.",
    "detail.overview": "Overview",
    "detail.sequence": "Sequence",
    "detail.visualization": "Visualization",
    "detail.metadata": "Metadata",
    "detail.cached": "Cached stability",
    "detail.verified": "Verified record",
    "detail.refreshing": "Refreshing",
    "detail.organism": "Organism",
    "detail.source": "Source",
    "detail.export": "Export data",
    "detail.sequenceLength": "Sequence Length",
    "detail.gcContent": "GC Content",
    "detail.highConfidence": "High confidence annotation",
    "detail.copy": "Copy",
    "detail.copied": "Copied",
    "detail.wrapText": "Wrap Text",
    "detail.sequenceAvailable": "Sequence available",
    "detail.noSequence": "No sequence returned",
    "detail.notFoundTitle": "No detailed data was found",
    "detail.notFoundMessage": "The backend did not return a usable record for this gene ID.",
    "detail.retry": "Retry",
    "detail.id": "ID",
    "detail.descriptionUnavailable": "No description available.",
    "detail.summaryUnavailable": "No summary available.",
    "detail.gcRatio": "GC Ratio",
    "detail.nucleotideComposition": "Nucleotide Composition",
    "detail.length": "Length",
    "detail.atContent": "AT Content",
    "detail.sequenceFasta": "Sequence FASTA",
    "detail.fastaUnavailable": "FASTA is not available yet. Try external refresh or reopen a supported accession.",
    "detail.functionalDomains": "Functional Domains",
    "detail.feature": "Feature",
    "detail.providerFeatureAnnotation": "Provider feature annotation",
    "detail.noDomains": "No protein domains or transcript feature annotations available.",
    "detail.metadataSourceContext": "Metadata & Source Context",
    "detail.providerAnnotation": "Provider annotation",
    "detail.providerAnnotationFallback": "This record is mapped from the current backend/provider response. Fallback/local records are marked when returned by the backend.",
    "detail.database": "Database",
    "detail.assembly": "Assembly",
    "detail.geneSummary": "Gene Summary",
    "detail.symbol": "Symbol",
    "detail.name": "Name",
    "detail.accession": "Accession",
    "detail.lastSynced": "Last synced",
    "detail.chromosomeLocation": "Chromosome Location",
    "detail.strand": "strand",
    "detail.transcriptExonStructure": "Transcript / Exon Structure",
    "detail.transcript": "Transcript",
    "detail.unknownBiotype": "Unknown biotype",
    "detail.exons": "exons",
    "detail.noTranscript": "No transcript/exon structure available from the current provider response.",
    "detail.proteinInformation": "Protein Information",
    "detail.proteinNameUnavailable": "Protein name unavailable.",
    "detail.noProtein": "No protein information available from the current provider response.",
    "detail.noProteinFeatures": "No protein feature/domain annotations available.",
    "detail.aliases": "Aliases",
    "detail.noAliases": "No aliases available.",
    "detail.viewOn": "View on {provider}",
    "detail.truncated": "... truncated in UI ({count} characters total)",
    "detail.unknownOrganism": "Unknown organism",
    "detail.ncbiGeneId": "NCBI Gene ID",
    "detail.ensemblGeneId": "Ensembl Gene ID",
    "detail.uniprotAccession": "UniProt Accession",
    "detail.bvbrcFeatureId": "BV-BRC Feature ID",
    "detail.localGeneId": "Local Gene ID",
    "detail.sourceId": "Source ID",
    "detail.loadFailed": "Unable to load gene details.",
    "detail.showingCache": "Showing temporarily cached browser data.",
    "detail.proteinLength": "Protein Length",
    "detail.molecularWeight": "Molecular Weight",
    "detail.estimatedFromSequence": "Estimated from sequence",
    "detail.aminoAcidComposition": "Amino Acid Composition",
    "detail.uniqueAminoAcids": "Unique amino acids",
    "detail.noAminoAcidComposition": "No protein sequence is available to calculate amino acid composition.",
    "detail.nucleotideOutputs": "Nucleotide outputs",
    "detail.reverseComplement": "Reverse Complement",
    "detail.rnaTranscript": "RNA Transcript",
    "detail.noNucleotideSequence": "No nucleotide sequence is available to generate this output.",
    "detail.uniprotAnnotation": "UniProt Annotation",
    "detail.proteinFasta": "Protein FASTA",
    "detail.nucleotideFasta": "Nucleotide FASTA",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.system": "System",
    "theme.toggle": "Toggle theme",
    "toast.copied": "Copied!",
    "toast.copyFasta": "FASTA copied",
    "toast.copySequence": "Sequence copied",
    "toast.searchSuccess": "Results found",
    "toast.searchEmpty": "No results found",
    "toast.analysisComplete": "Analysis complete",
    "toast.serverOnline": "Server is online",
    "toast.serverOffline": "Cannot connect to server",
    "toast.rateLimited": "Too many requests. Please wait.",
    "toast.usingCache": "Using cached data",
    "toast.showAll": "Show all",
    "toast.showLess": "Show less",
    "detail.aaPropertyBasic": "Basic",
    "detail.aaPropertyAcidic": "Acidic",
    "detail.aaPropertyPolar": "Polar",
    "detail.aaPropertyHydrophobic": "Hydrophobic",
    "detail.aaDistribution": "Distribution by property",
  }
};

export function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "vi";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "en" || saved === "vi" ? saved : "vi";
}

export function useLanguage() {
  const [lang, setLangState] = useState<Language>("vi");

  useEffect(() => {
    setLangState(getInitialLanguage());
    const handler = () => setLangState(getInitialLanguage());
    window.addEventListener("biolab:language-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("biolab:language-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (value: Language) => {
    setLangState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, value);
      window.dispatchEvent(new Event("biolab:language-change"));
    }
  };

  const t = useMemo<Translate>(() => (key: string) => dictionary[lang]?.[key] || dictionary.en[key] || key, [lang]);

  return { lang, setLang, t };
}

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className={`inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 shadow-sm ${compact ? "h-9 px-3" : "h-10 gap-2 px-4"}`}
      >
        <span>VI</span>
      </button>
    );
  }

  const next = lang === "vi" ? "en" : "vi";
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      className={`inline-flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 shadow-sm transition hover:border-cyan-300 hover:text-cyan-700 dark:hover:border-cyan-500 dark:hover:text-cyan-400 ${compact ? "h-9 px-3" : "h-10 gap-2 px-4"}`}
      title={t("language.toggle")}
      aria-label={t("language.toggle")}
    >
      <span>{lang === "vi" ? "VI" : "EN"}</span>
      {!compact && <span className="text-slate-300 dark:text-slate-600">/</span>}
      {!compact && <span className="text-slate-400 dark:text-slate-500">{next.toUpperCase()}</span>}
    </button>
  );
}

/* ═══════════════════════════════════════════
   THEME SYSTEM
═══════════════════════════════════════════ */
function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return "system";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const initial = getInitialTheme();
    setThemeState(initial);
    applyTheme(initial);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      const current = getInitialTheme();
      if (current === "system") applyTheme("system");
    };
    mediaQuery.addEventListener("change", onSystemChange);
    return () => mediaQuery.removeEventListener("change", onSystemChange);
  }, []);

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value);
    applyTheme(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    }
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const resolved = prev === "system" ? getSystemTheme() : prev;
      const next = resolved === "dark" ? "light" : "dark";
      applyTheme(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
      return next;
    });
  }, []);

  return { theme, setTheme, toggle };
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button type="button" className="theme-toggle" aria-label="Toggle theme">
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  const resolved = theme === "system" ? (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;

  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-toggle"
      title={t("theme.toggle")}
      aria-label={t("theme.toggle")}
    >
      {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
