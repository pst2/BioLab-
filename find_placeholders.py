import re

with open('extracted_report_latest.txt', encoding='utf-8') as f:
    lines = f.readlines()

out = []
for idx, line in enumerate(lines, 1):
    l = line.strip()
    # Check bracket placeholders
    brackets = re.findall(r'\[(.*?)\]', l)
    for b in brackets:
        if b not in ['Heading1', 'Heading2', 'Heading3', 'ListParagraph', 'TableofFigures', 'Caption'] and not b.isdigit():
            out.append(f"Line {idx} [Bracket]: {l}")
            break
    
    # Check incomplete sentences / missing numbers:
    # e.g. "tổng cộng  bản ghi", "đạt .", "dao động  so với  khi", "trong thời gian [thời gian chuyển đổi]"
    if re.search(r'\b(đạt|cộng|bộ|động|với)\s+\.', l) or re.search(r'cộng\s{2,}bản ghi', l) or re.search(r'bộ\s{2,}bài', l) or re.search(r'dao động\s{2,}so với\s{2,}khi', l):
        out.append(f"Line {idx} [Missing Number/Data]: {l}")

with open('placeholder_issues.txt', 'w', encoding='utf-8') as f:
    for item in out:
        f.write(item + '\n')

print(f"Found {len(out)} placeholder/data gap issues.")
