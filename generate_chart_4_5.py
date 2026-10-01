import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

# Set font family to Segoe UI / Arial for crisp rendering with Vietnamese diacritics
plt.rcParams['font.sans-serif'] = ['Segoe UI', 'Arial', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# Data directly from Table 4.4 in the graduation report
labels = [
    '200 OK',
    '401 Unauthorized',
    '404 Not Found',
    '500 Internal Error',
    '502 Bad Gateway',
    '503 Service Unavailable',
    '429 Rate Limit',
    '405 Method Not Allowed'
]
counts = [771, 16, 9, 9, 8, 3, 2, 2]
percentages = [93.9, 1.9, 1.1, 1.1, 1.0, 0.4, 0.2, 0.2]
descriptions = [
    'Xử lý thành công hoàn toàn',
    'Kiểm thử thiếu/sai API Key',
    'Kiểm thử ID/route không tồn tại',
    'Kiểm thử sanitized error/giấu traceback',
    'Giả lập sự cố kết nối tới NCBI',
    'Giả lập provider tạm thời gián đoạn',
    'Kiểm thử giới hạn tần suất truy cập',
    'Kiểm thử sai phương thức HTTP'
]

# Create high-resolution figure with two subplots (1x2)
fig = plt.figure(figsize=(16, 8.5), dpi=300, facecolor='#ffffff')

# GridSpec for balanced layout
gs = fig.add_gridspec(1, 2, width_ratios=[1.05, 1.35], wspace=0.25)

# ----------------- SUBPLOT 1: DONUT CHART -----------------
ax1 = fig.add_subplot(gs[0])
ax1.set_facecolor('#ffffff')

# Color palette matching BioLab design system
colors_pie = [
    '#06b6d4', # 200 OK (cyan)
    '#8b5cf6', # 401 (purple)
    '#3b82f6', # 404 (blue)
    '#ef4444', # 500 (red)
    '#f97316', # 502 (orange)
    '#f59e0b', # 503 (amber)
    '#eab308', # 429 (yellow)
    '#64748b'  # 405 (slate)
]

explode = (0.03, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20, 0.22)

wedges, texts = ax1.pie(
    counts,
    explode=explode,
    colors=colors_pie,
    startangle=140,
    wedgeprops=dict(width=0.42, edgecolor='white', linewidth=2.0)
)

# Center circle callout
ax1.text(0, 0.14, '821', ha='center', va='center', fontsize=32, fontweight='bold', color='#0f172a')
ax1.text(0, -0.04, 'TỔNG REQUESTS', ha='center', va='center', fontsize=10, fontweight='bold', color='#64748b')
ax1.text(0, -0.22, '771 Thành công (93.9%)\n50 Kiểm thử lỗi (6.1%)', ha='center', va='center', fontsize=10, color='#0891b2', linespacing=1.4, fontweight='600')

ax1.set_title('(A) Phân bố tổng thể mã trạng thái HTTP\n(Tập mẫu 821 requests thu thập trong BioLab)', fontsize=13, fontweight='bold', color='#0f172a', pad=18)

# Legend for pie chart
legend_labels = [f'{l}: {c} ({p}%)' for l, c, p in zip(labels, counts, percentages)]
ax1.legend(wedges, legend_labels, loc='center left', bbox_to_anchor=(-0.16, -0.16), ncol=2, fontsize=9, frameon=True, facecolor='#f8fafc', edgecolor='#e2e8f0', handlelength=1.4)

# ----------------- SUBPLOT 2: HORIZONTAL BAR CHART (ERROR BREAKDOWN) -----------------
ax2 = fig.add_subplot(gs[1])
ax2.set_facecolor('#ffffff')

# Focus on the 50 error/testing requests
err_labels = labels[1:]
err_counts = counts[1:]
err_pcts = percentages[1:]
err_descs = descriptions[1:]
err_colors = colors_pie[1:]

y_pos = np.arange(len(err_labels))[::-1]  # top to bottom

# Add horizontal light bars background
ax2.barh(y_pos, [22]*len(y_pos), color='#f1f5f9', height=0.68, zorder=1)

bars = ax2.barh(y_pos, err_counts, color=err_colors, height=0.68, edgecolor='white', linewidth=1.5, zorder=3)

# Add grid lines
ax2.grid(axis='x', linestyle='--', alpha=0.6, color='#cbd5e1', zorder=0)
ax2.set_axisbelow(True)

# Spines styling
for spine in ['top', 'right', 'left']:
    ax2.spines[spine].set_visible(False)
ax2.spines['bottom'].set_color('#94a3b8')

ax2.set_yticks(y_pos)
ax2.set_yticklabels(err_labels, fontsize=10.5, fontweight='bold', color='#1e293b')
ax2.set_xlabel('Số lượng requests ghi nhận', fontsize=10.5, fontweight='bold', color='#475569', labelpad=10)
ax2.set_xlim(0, 22)
ax2.set_xticks(range(0, 21, 4))

# Add value callout and explanation label
for bar, count, pct, desc in zip(bars, err_counts, err_pcts, err_descs):
    width = bar.get_width()
    # Number badge inside or next to bar
    ax2.text(width + 0.45, bar.get_y() + bar.get_height()/2,
             f'{count} req ({pct}%)   —   {desc}',
             va='center', ha='left', fontsize=9, color='#334155', fontweight='500', zorder=5)

ax2.set_title('(B) Chi tiết 50 requests kiểm thử dung lỗi & ngoại lệ\n(Phân tích nguyên nhân và mục đích kỹ thuật kiểm thử)', fontsize=13, fontweight='bold', color='#0f172a', pad=18)

# Overall figure header / caption
fig.suptitle('Hình 4.5. Biểu đồ phân bố các mã trạng thái HTTP trong 821 request\n(Phân tích nhật ký hoạt động hệ thống qua bảng request_metrics)', 
             fontsize=15, fontweight='bold', color='#0f172a', y=0.99)

# Save chart to high-resolution JPEG and PNG
plt.subplots_adjust(top=0.86, bottom=0.18, left=0.06, right=0.96)

out_brain = r'C:\Users\Admin\.gemini\antigravity\brain\f1be0bf5-0b55-41c0-a099-597462c211af\hinh_4_5_http_status_distribution.jpg'
out_project = r'F:\python_vscode\bio_project\Hinh_4_5_Phan_Bo_HTTP_Status.jpg'
out_downloads = r'C:\Users\Admin\Downloads\Hinh_4_5_Phan_Bo_HTTP_Status.jpg'

# Also save with 4.4 naming in case user references it as 4.4
out_project_44 = r'F:\python_vscode\bio_project\Hinh_4_4_Phan_Bo_HTTP_Status.jpg'
out_downloads_44 = r'C:\Users\Admin\Downloads\Hinh_4_4_Phan_Bo_HTTP_Status.jpg'

fig.savefig(out_brain, dpi=300, bbox_inches='tight', facecolor='#ffffff')
fig.savefig(out_project, dpi=300, bbox_inches='tight', facecolor='#ffffff')
fig.savefig(out_downloads, dpi=300, bbox_inches='tight', facecolor='#ffffff')
fig.savefig(out_project_44, dpi=300, bbox_inches='tight', facecolor='#ffffff')
fig.savefig(out_downloads_44, dpi=300, bbox_inches='tight', facecolor='#ffffff')

print('Generated all output images successfully!')
