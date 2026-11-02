"""Build the current release amendment while preserving the full historical specification."""
from pathlib import Path
import json
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / 'specifications' / '產科三模組正式發行_變更與驗收規格_v1.2.docx'
MODULES = json.loads((PROJECT / 'src/modules.json').read_text())
doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
sec.top_margin = sec.bottom_margin = Inches(.68)
sec.left_margin = sec.right_margin = Inches(.75)

def font(run, size=10.5, bold=False, color='000000'):
    run.font.name = 'Noto Sans CJK TC'
    run.font.size = Pt(size)
    run.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)
    fonts = run._element.get_or_add_rPr().get_or_add_rFonts()
    for key in ('ascii', 'hAnsi', 'eastAsia', 'cs'):
        fonts.set(qn('w:' + key), 'Noto Sans CJK TC')

for name, size in [('Normal', 10.5), ('Title', 22), ('Subtitle', 11), ('Heading 1', 15), ('Heading 2', 12)]:
    style = doc.styles[name]
    style.font.name = 'Noto Sans CJK TC'
    style.font.size = Pt(size)
    style.font.color.rgb = RGBColor(0, 0, 0)
    style.font.italic = False
    style.paragraph_format.line_spacing = Pt(16 if name == 'Normal' else size + 7)
    style.paragraph_format.space_after = Pt(7)
    style.paragraph_format.widow_control = True
    if name.startswith('Heading'):
        style.paragraph_format.space_before = Pt(12)
        style.paragraph_format.keep_with_next = True

def p(text, style=None):
    return doc.add_paragraph(text, style)

def h(text):
    doc.add_heading(text, 1)

p('產科三模組正式發行規格', 'Title')
p('版本變更與階段驗收  v1.2  更新日期 2026 年 11 月 2 日', 'Subtitle')
p('本次公開網站保留胎位辨識、分娩機轉與胎心率情境觀察，移除四段觸診與胎心監測。原三個練習網址沿用，分別製作下方附中文名稱的 QR code。此規格補充既有七十章完整製作規格；目前公開範圍以本版為準，舊版觸診章節保留作為歷史記錄。')
h('公開模組與網址')
table = doc.add_table(rows=1, cols=2)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.autofit = False
widths = [2.3, 4.7]
for i, width in enumerate(widths):
    table.columns[i].width = Inches(width)
for cell, text in zip(table.rows[0].cells, ['教學名稱', '入口參數']):
    cell.text = text
for module in MODULES:
    cells = table.add_row().cells
    cells[0].text = module['qrName']
    cells[1].text = '?module=' + module['id']
props = table._tbl.tblPr
borders = OxmlElement('w:tblBorders')
for edge in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
    item = OxmlElement('w:' + edge)
    for key, val in [('val', 'single'), ('sz', '5'), ('color', 'D9D9D9')]:
        item.set(qn('w:' + key), val)
    borders.append(item)
props.append(borders)
for row_index, row in enumerate(table.rows):
    row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
    if row_index == 0:
        row._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
    for col_index, cell in enumerate(row.cells):
        cell.width = Inches(widths[col_index])
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        cell_props = cell._tc.get_or_add_tcPr()
        shade = OxmlElement('w:shd')
        shade.set(qn('w:fill'), '243746' if row_index == 0 else ('F2F5F7' if row_index % 2 == 0 else 'FFFFFF'))
        cell_props.append(shade)
        margins = OxmlElement('w:tcMar')
        for edge in ['top', 'bottom', 'start', 'end']:
            margin = OxmlElement('w:' + edge)
            margin.set(qn('w:w'), '110')
            margin.set(qn('w:type'), 'dxa')
            margins.append(margin)
        cell_props.append(margins)
        for paragraph in cell.paragraphs:
            paragraph.paragraph_format.space_after = Pt(2)
            paragraph.paragraph_format.line_spacing = Pt(16)
            for run in paragraph.runs:
                font(run, bold=row_index == 0, color='FFFFFF' if row_index == 0 else '000000')
p('正式網站 https://changyi123456.github.io/obstetric-learning/').paragraph_format.space_before = Pt(8)
p('模組總覽沿用 ?module=all。網站導覽、入口清單與 QR 名稱共用 src/modules.json。')
h('移除範圍與相容處理')
p('首頁與頂端導覽只顯示三個主題。移除觸診頁面、專用互動程式、樣式、Blender 重建腳本、觸診模型及第四張公開 QR，不讓撤下內容繼續出現在發行包。胎心率情境仍使用自己的產房模型與人物來源。')
p('舊 ?module=palpation 與未知模組值改為 ?module=all，顯示三模組總覽；保留其餘三個深層網址與胎心率曲線入口。撤下動作不刪除瀏覽器內的學習紀錄。')
h('製作資料保存')
p('觸診專用資料封存在本機新版資料夾內的「封存_四段觸診_2026-11-02」，保留原路徑結構與 SHA-256 校驗。Git 既有歷史與完整規格 v1.1 保留；封存內容不隨本次網站發行。')

doc.add_page_break()
h('階段製作與驗收流程')
for text in [
    '第一階段 核對撤下範圍。先封存觸診專用原始碼、模型、來源清冊與舊 QR；逐檔比對校驗，再從公開來源移除。保留三個現有模組的模型與學習內容。',
    '第二階段 修改入口。首頁、頂端導覽及說明改為三模組；舊觸診網址改回總覽。檢查深層連結、重新整理、首頁切換與學習進度，避免連到已移除頁面。',
    '第三階段 本機驗證。執行現有相關單元測試、TypeScript 與 GitHub Pages 子目錄建置。檢查產物不含觸診程式、模型或第四張 QR；瀏覽器確認三個模型載入，主要按鈕可操作，主控台沒有相關錯誤。',
    '第四階段 上架 GitHub。推送既有 main，由既有 GitHub Actions 執行測試、建置及 Pages 部署。使用 /obstetric-learning/ 作為 base；確認部署成功後，逐一開啟正式三入口及舊觸診網址。',
    '第五階段 QR 交付。依目前三入口產生 PNG 與網址清單，逐張用獨立解碼器比對完整 HTTPS 網址，檢視中文名稱與留白，再交付三張原圖、總覽及 ZIP。正式網址不變時可沿用相同 QR 內容。',
]:
    p(text)
h('QR 圖片規格')
p('每個教學主題一張白底黑碼 PNG，下方標示「胎位辨識」「分娩機轉」「胎心率情境觀察」。採 M 錯誤更正、至少四個 QR 小方格寬的安全區、整數像素方格與 300 DPI 中繼資料；目前原圖為 1160 × 1288 像素。名稱需完整置中，不能裁掉字或把裝飾壓到方格。')
p('public/qr/links.json 僅保留三筆網址，圖片只含這三個入口。舊四張套件保留作歷史資料；本次交付檔案明確標示三模組，避免誤發已撤下的第四張圖。')
h('回歸範圍與後續維護')
p('胎位辨識需能切換教學與探索；分娩機轉需能操作播放與暫停；胎心率需能進入動態床邊情境及曲線練習。桌面與窄版檢查入口數量、可讀性、橫向溢出及模型載入；瀏覽器模擬不取代手機或平板實機試教。')
p('本次僅更新 GitHub Pages；原 Sites 網址保留先前版本，未與本次 GitHub 發行同步。若未來改帳號、儲存庫或模組參數，須重新產生及解碼核對 QR。重新啟用觸診時，應先從本機封存或 Git 歷史取回，再做獨立內容與操作驗收。')
OUT.parent.mkdir(parents=True, exist_ok=True)
for root in (doc.styles.element, doc.element):
    for border in list(root.iter(qn('w:pBdr'))):
        border.getparent().remove(border)
doc.save(OUT)
print(OUT)
