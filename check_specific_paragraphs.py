import zipfile, xml.etree.ElementTree as ET

docx_path = r"C:\Users\Admin\Downloads\23020229_BaocaoDoanTotnghiep.docx"
with zipfile.ZipFile(docx_path) as z:
    xml_content = z.read("word/document.xml")

tree = ET.fromstring(xml_content)
w_tag = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
m_tag = "{http://schemas.openxmlformats.org/officeDocument/2006/math}"

results = []
for p in tree.iter(w_tag + "p"):
    parts = []
    for node in p.iter():
        if (node.tag == w_tag + "t" or node.tag == m_tag + "t") and node.text:
            parts.append(node.text)
    full = "".join(parts).strip()
    if any(k in full for k in ["cache_entries ghi nhận tổng cộng", "In-Memory Cache đạt", "thời gian chuyển đổi", "bài kiểm thử đều đạt", "khi truy vấn trực tiếp qua mạng"]):
        results.append(full)

with open("specific_paragraphs.txt", "w", encoding="utf-8") as f:
    for r in results:
        f.write(r + "\n---\n")

print(f"Done, found {len(results)} matches.")
