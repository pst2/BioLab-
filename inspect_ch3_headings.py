import zipfile, xml.etree.ElementTree as ET

docx_path = r"C:\Users\Admin\Downloads\23020229_BaocaoDoanTotnghiep.docx"
with zipfile.ZipFile(docx_path) as z:
    xml_content = z.read("word/document.xml")

tree = ET.fromstring(xml_content)
w_tag = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

results = []
for p in tree.iter(w_tag + "p"):
    pStyle = p.find(f".//{w_tag}pStyle")
    style_val = pStyle.attrib.get(f"{w_tag}val", "") if pStyle is not None else ""
    texts = [n.text for n in p.iter() if n.text and n.tag.endswith("t")]
    txt = "".join(texts).strip()
    if ("3." in txt or "CHƯƠNG 3" in txt) and style_val in ["Heading1", "Heading2", "Heading3"]:
        results.append(f"[{style_val}] {txt}")

with open("ch3_headings.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(results))

print(f"Found {len(results)} headings in Chapter 3.")
