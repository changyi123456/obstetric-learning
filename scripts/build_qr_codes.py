"""Create labelled, print-ready module QR images without a network service.
Requires Pillow and ReportLab. Run from any directory with --output-dir if needed.
"""
from pathlib import Path
import argparse
import json
from urllib.parse import urlsplit
from PIL import Image, ImageDraw, ImageFont, PngImagePlugin
from reportlab.graphics.barcode.qrencoder import QRCode, QRErrorCorrectLevel

MODULES = json.loads((Path(__file__).resolve().parents[1] / 'src' / 'modules.json').read_text())

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='https://changyi123456.github.io/obstetric-learning/')
    parser.add_argument('--output-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'public' / 'qr')
    parser.add_argument('--font', type=Path, default=Path('/Users/USER/Library/Fonts/NotoSansCJKtc-Bold.otf'))
    args = parser.parse_args()
    base = args.base_url.rstrip('/') + '/'
    parsed = urlsplit(base)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.query or parsed.fragment:
        parser.error('--base-url must be an HTTPS site directory without a query or fragment')
    args.output_dir.mkdir(parents=True, exist_ok=True)
    links = [{ 'name': module['qrName'], 'module': module['id'], 'file': module['qrFile'], 'url': base + '?module=' + module['id'] } for module in MODULES]
    codes = []
    for entry in links:
        qr = QRCode(None, QRErrorCorrectLevel.M)
        qr.addData(entry['url'])
        qr.make()
        codes.append(qr)
    version = max(qr.version for qr in codes)
    module_size, quiet, outer = 24, 4, 40
    for entry in links:
        qr = QRCode(version, QRErrorCorrectLevel.M)
        qr.addData(entry['url'])
        qr.make()
        count = qr.getModuleCount()
        width = (count + quiet * 2) * module_size + outer * 2
        image = Image.new('RGB', (width, width + 128), 'white')
        draw = ImageDraw.Draw(image)
        offset = outer + quiet * module_size
        for row in range(count):
            for col in range(count):
                if qr.modules[row][col]:
                    x, y = offset + col * module_size, offset + row * module_size
                    draw.rectangle((x, y, x + module_size - 1, y + module_size - 1), fill='black')
        font = ImageFont.truetype(str(args.font), 58)
        draw.text((width // 2, width + 53), entry['name'], font=font, fill='#142f46', anchor='mm')
        info = PngImagePlugin.PngInfo()
        info.add_text('Title', entry['name'])
        info.add_text('URL', entry['url'])
        image.save(args.output_dir / entry['file'], pnginfo=info, dpi=(300, 300))
    (args.output_dir / 'links.json').write_text(json.dumps(links, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'images': len(links), 'version': version, 'output': str(args.output_dir)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
