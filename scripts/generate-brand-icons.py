#!/usr/bin/env python3
"""Generate PWA + Android launcher icons from assets/icons/logo-master.jpg."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Install Pillow: pip3 install Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "assets" / "icons" / "logo-master.jpg"
BRAND_GREEN = (0x1E, 0x9E, 0x3E)

ANDROID_LAUNCHER = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
ANDROID_FOREGROUND = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}
PWA = {"icon-180.png": 180, "icon-192.png": 192, "icon-512.png": 512}

SPLASH_PORT = {
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (960, 1600),
    "drawable-port-xxxhdpi": (1280, 1920),
}
SPLASH_LAND = {
    "drawable-land-mdpi": (480, 320),
    "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-land-xxhdpi": (1600, 960),
    "drawable-land-xxxhdpi": (1920, 1280),
}


def fit_square(img: Image.Image, size: int, pad: float = 0.06) -> Image.Image:
    """Scale logo into size×size with optional inset (adaptive icon safe zone)."""
    side = int(size * (1 - pad * 2))
    copy = img.convert("RGBA")
    copy.thumbnail((side, side), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    ox = (size - copy.width) // 2
    oy = (size - copy.height) // 2
    canvas.paste(copy, (ox, oy), copy if copy.mode == "RGBA" else None)
    return canvas


def splash_frame(img: Image.Image, w: int, h: int) -> Image.Image:
    logo_max = int(min(w, h) * 0.42)
    copy = img.convert("RGBA")
    copy.thumbnail((logo_max, logo_max), Image.Resampling.LANCZOS)
    frame = Image.new("RGB", (w, h), BRAND_GREEN)
    ox = (w - copy.width) // 2
    oy = (h - copy.height) // 2
    if copy.mode == "RGBA":
        frame.paste(copy, (ox, oy), copy)
    else:
        frame.paste(copy, (ox, oy))
    return frame


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.save(path, "PNG", optimize=True)


def main() -> None:
    if not MASTER.is_file():
        print(f"Missing {MASTER}", file=sys.stderr)
        sys.exit(1)
    src = Image.open(MASTER)
    icons_dir = ROOT / "assets" / "icons"
    for name, size in PWA.items():
        save_png(fit_square(src, size, pad=0.04), icons_dir / name)
        print(f"  {icons_dir / name} ({size}px)")

    res = ROOT / "android" / "app" / "src" / "main" / "res"
    for folder, size in ANDROID_LAUNCHER.items():
        d = res / folder
        icon = fit_square(src, size, pad=0.04)
        save_png(icon, d / "ic_launcher.png")
        save_png(icon, d / "ic_launcher_round.png")
    for folder, size in ANDROID_FOREGROUND.items():
        save_png(fit_square(src, size, pad=0.08), res / folder / "ic_launcher_foreground.png")

    for folder, (w, h) in {**SPLASH_PORT, **SPLASH_LAND}.items():
        save_png(splash_frame(src, w, h), res / folder / "splash.png")
    save_png(splash_frame(src, 480, 320), res / "drawable" / "splash.png")

    print("Done — PWA icons, Android launcher, and splash screens updated.")


if __name__ == "__main__":
    main()
