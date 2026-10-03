import zipfile
import xml.etree.ElementTree as ET

docx_path = r"C:\Users\Admin\Downloads\23020229_BaocaoDoanTotnghiep.docx"
out_path = r"f:\python_vscode\bio_project\extracted_report_latest.txt"

ns = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "m": "http://schemas.openxmlformats.org/officeDocument/2006/math"
}

with zipfile.ZipFile(docx_path) as z:
    xml_content = z.read("word/document.xml")

tree = ET.fromstring(xml_content)

elements = []
body = tree.find(".//w:body", ns)
if body is None:
    body = tree

w_tag = f"{{{ns['w']}}}"
m_tag = f"{{{ns['m']}}}"

for child in body:
    tag = child.tag
    if tag.endswith("p"):
        style_elem = child.find(".//w:pStyle", ns)
        style = style_elem.attrib.get(f"{w_tag}val", "") if style_elem is not None else ""
        
        parts = []
        for n in child.iter():
            if (n.tag == f"{w_tag}t" or n.tag == f"{m_tag}t") and n.text:
                parts.append(n.text)
        text = "".join(parts).strip()
        if text:
            elements.append({"type": "p", "style": style, "text": text})
    elif tag.endswith("tbl"):
        rows = []
        for tr in child.findall(".//w:tr", ns):
            row_cells = []
            for tc in tr.findall(".//w:tc", ns):
                cell_parts = []
                for p in tc.findall(".//w:p", ns):
                    p_parts = []
                    for n in p.iter():
                        if (n.tag == f"{w_tag}t" or n.tag == f"{m_tag}t") and n.text:
                            p_parts.append(n.text)
                    pt = "".join(p_parts).strip()
                    if pt:
                        cell_parts.append(pt)
                row_cells.append(" ".join(cell_parts))
            if any(row_cells):
                rows.append(row_cells)
        if rows:
            elements.append({"type": "table", "rows": rows})

with open(out_path, "w", encoding="utf-8") as f:
    for el in elements:
        if el["type"] == "p":
            prefix = f"[{el['style']}] " if el["style"] else ""
            f.write(f"{prefix}{el['text']}\n")
        elif el["type"] == "table":
            f.write(f"\n--- TABLE ({len(el['rows'])} rows) ---\n")
            for r in el["rows"]:
                f.write(" | ".join(r) + "\n")
            f.write("--- END TABLE ---\n\n")

print(f"Extraction with math complete: {len(elements)} items saved.")
