import re

with open("extracted_report_latest.txt", "r", encoding="utf-8") as f:
    lines = f.readlines()

placeholders = []
known_styles = {'Heading1', 'Heading2', 'Heading3', 'ListParagraph', 'TableofFigures', 'Caption'}

for idx, l in enumerate(lines, 1):
    text = l.strip()
    # Find all [...]
    matches = re.findall(r'\[(.*?)\]', text)
    for m in matches:
        if m in known_styles or m.isdigit():
            continue
        # If it's a citation like [1], [2-5], etc.
        if re.match(r'^\d+(?:[–,-]\d+)*$', m):
            continue
        placeholders.append((idx, m, text))

with open("detected_placeholders.txt", "w", encoding="utf-8") as f:
    for idx, p, t in placeholders:
        f.write(f"Line {idx}: [{p}]\n  Context: {t}\n\n")

print(f"Total placeholders found: {len(placeholders)}")
