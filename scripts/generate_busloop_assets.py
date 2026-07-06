from pathlib import Path
from base64 import b64encode

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\adity\Downloads\ChatGPT Image Jul 6, 2026, 03_29_32 PM.png")

APPS = [
    ROOT / "busnow-user-app",
    ROOT / "busnow-staff-app",
]

ANDROID_ICON_SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def extract_mark():
    image = Image.open(SOURCE).convert("RGBA")
    # Keep only the figure above the wordmark/tagline.
    crop = image.crop((292, 145, 948, 748))

    pixels = crop.load()
    for y in range(crop.height):
        for x in range(crop.width):
            r, g, b, a = pixels[x, y]
            # Remove the white/off-white background from the generated logo.
            if r > 238 and g > 238 and b > 238:
                pixels[x, y] = (255, 255, 255, 0)
            elif r > 225 and g > 225 and b > 225:
                pixels[x, y] = (255, 255, 255, int((238 - min(r, g, b)) * 7))

    bbox = crop.getbbox()
    if bbox:
        crop = crop.crop(bbox)

    return crop


def square_icon(mark, size, padding_ratio=0.12):
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    max_size = int(size * (1 - padding_ratio * 2))
    fitted = ImageOps.contain(mark, (max_size, max_size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
    return canvas


def white_card_icon(mark, size, radius_ratio=0.22):
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    icon = square_icon(mark, size, padding_ratio=0.14)
    canvas.alpha_composite(icon)
    return canvas


def splash_image(mark, width, height):
    bg = Image.new("RGBA", (width, height), (246, 247, 251, 255))
    max_w = int(width * 0.38)
    max_h = int(height * 0.34)
    fitted = ImageOps.contain(mark, (max_w, max_h), Image.Resampling.LANCZOS)
    bg.alpha_composite(fitted, ((width - fitted.width) // 2, (height - fitted.height) // 2))
    return bg.convert("RGB")


def write_public_assets(app, mark):
    public = app / "public"
    public.mkdir(exist_ok=True)

    mark.save(public / "busloop-mark.png")
    square_icon(mark, 192, padding_ratio=0.08).save(public / "busloop-icon-192.png")
    square_icon(mark, 512, padding_ratio=0.08).save(public / "busloop-icon-512.png")
    white_card_icon(mark, 180).save(public / "apple-touch-icon.png")

    png_bytes = (public / "busloop-icon-192.png").read_bytes()
    encoded = b64encode(png_bytes).decode("ascii")
    favicon_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <title>BusLoop</title>
  <image href="data:image/png;base64,{encoded}" width="192" height="192"/>
</svg>
'''
    (public / "favicon.svg").write_text(favicon_svg, encoding="utf-8")


def write_src_vite_svg(app):
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" role="img" aria-labelledby="title">
  <title id="title">BusLoop</title>
  <rect width="192" height="192" rx="44" fill="#fff"/>
  <path d="M119 29a54 54 0 0 1 47 76h-24a34 34 0 0 0-51-40L79 47a54 54 0 0 1 40-18Z" fill="#EF3E42"/>
  <path d="M44 62h56c14 0 25 11 25 25v35c0 14-11 25-25 25H44c-14 0-25-11-25-25V87c0-14 11-25 25-25Z" fill="#101828"/>
  <path d="M39 82h65c5 0 9 4 9 9v26c0 5-4 9-9 9H39c-5 0-9-4-9-9V91c0-5 4-9 9-9Z" fill="#fff"/>
  <path d="M30 126h84v16H30z" fill="#EF3E42"/>
  <path d="M52 71h42c5 0 5 11 0 11H52c-5 0-5-11 0-11Z" fill="#fff"/>
  <path d="M115 108h45c8 0 14 6 14 14v24c0 8-6 14-14 14h-45c-8 0-14-6-14-14v-24c0-8 6-14 14-14Z" fill="#fff" stroke="#101828" stroke-width="8"/>
  <path d="M119 123h13v13h-13zm25 0h13v13h-13zm-25 25h13v13h-13zm25 25h13v-13h-13zm-6-26h7v7h-7zm13 7h7v7h-7zm-20 13h7v7h-7z" fill="#101828"/>
  <circle cx="161" cy="159" r="22" fill="#12B76A"/>
  <circle cx="161" cy="159" r="9" fill="#fff"/>
</svg>
'''
    target = app / "src" / "assets" / "vite.svg"
    if target.exists():
        target.write_text(svg, encoding="utf-8")


def write_android_assets(app, mark):
    res = app / "android" / "app" / "src" / "main" / "res"
    if not res.exists():
        return

    for folder, size in ANDROID_ICON_SIZES.items():
        d = res / folder
        if not d.exists():
            continue
        icon = white_card_icon(mark, size)
        for name in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
            path = d / name
            if path.exists():
                icon.save(path)

    for splash in res.glob("drawable*/splash.png"):
        with Image.open(splash) as existing:
            splash_image(mark, existing.width, existing.height).save(splash)


def main():
    mark = extract_mark()
    for app in APPS:
        write_public_assets(app, mark)
        write_src_vite_svg(app)
        write_android_assets(app, mark)
    preview = ROOT / "busloop-mark-preview.png"
    square_icon(mark, 768, padding_ratio=0.04).save(preview)
    print(preview)


if __name__ == "__main__":
    main()
