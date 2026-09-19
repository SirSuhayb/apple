#!/usr/bin/env python3
"""Cut the grey studio plinth and product-page fill from Eydeet stills.

Reads public/apple/stills/frame-00.png … frame-09.png and writes RGBA cutouts
to public/apple/cutouts/ with a shared crop so every bite stage sits in the
same frame. Apple flesh (pale yellow) and the stem stay; only near-neutral
backdrop / plinth pixels go transparent.
"""
from __future__ import annotations

import os
from collections import deque

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "public", "apple", "stills")
OUT_DIR = os.path.join(ROOT, "public", "apple", "cutouts")
FRAME_COUNT = 10
OUT_SIZE = 256
PAD_RATIO = 0.08

# Product-page fill from export-apple-stills.mjs; plinth sampled from stills.
BG = (251, 251, 253)
PLINTH = (208, 208, 210)


def dist2(c, t) -> int:
    dr = c[0] - t[0]
    dg = c[1] - t[1]
    db = c[2] - t[2]
    return dr * dr + dg * dg + db * db


def chroma(c) -> int:
    return max(c) - min(c)


def is_backdrop(c) -> bool:
    """Near-white page fill or the grey studio floor — not apple skin/flesh."""
    if chroma(c) > 22:
        return False
    if dist2(c, BG) <= 18 * 18:
        return True
    if dist2(c, PLINTH) <= 22 * 22:
        return True
    luma = (c[0] + c[1] + c[2]) / 3
    return chroma(c) <= 12 and luma >= 190


def flood_backdrop(pixels, w: int, h: int) -> bytearray:
    marked = bytearray(w * h)
    q: deque[int] = deque()

    def try_seed(x: int, y: int) -> None:
        i = y * w + x
        if marked[i]:
            return
        c = pixels[x, y]
        if not is_backdrop(c):
            return
        marked[i] = 1
        q.append(i)

    for x in range(w):
        try_seed(x, 0)
        try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)

    while q:
        i = q.popleft()
        x = i % w
        y = i // w
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            ni = ny * w + nx
            if marked[ni]:
                continue
            if not is_backdrop(pixels[nx, ny]):
                continue
            marked[ni] = 1
            q.append(ni)

    # Plinth is a solid grey disc; catch any interior leftover below the apple.
    y0 = int(h * 0.76)
    for y in range(y0, h):
        for x in range(w):
            i = y * w + x
            if marked[i]:
                continue
            if is_backdrop(pixels[x, y]):
                marked[i] = 1

    return marked


def alpha_for(c, backdrop: bool) -> int:
    if backdrop:
        return 0
    ch = chroma(c)
    d_bg = dist2(c, BG) ** 0.5
    # Anti-aliased halo around the fruit (blend of apple + #fbfbfd).
    if ch < 28 and d_bg < 28:
        t = (d_bg - 8) / 20
        if t <= 0:
            return 0
        if t >= 1:
            return 255
        return int(255 * t)
    return 255


def content_bbox(alpha, w: int, h: int) -> tuple[int, int, int, int]:
    xs: list[int] = []
    ys: list[int] = []
    for y in range(h):
        row = y * w
        for x in range(w):
            if alpha[row + x] > 24:
                xs.append(x)
                ys.append(y)
    if not xs:
        return (0, 0, w - 1, h - 1)
    return (min(xs), min(ys), max(xs), max(ys))


def process_frame(path: str) -> tuple[Image.Image, tuple[int, int, int, int]]:
    src = Image.open(path).convert("RGB")
    w, h = src.size
    pixels = src.load()
    marked = flood_backdrop(pixels, w, h)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dst = out.load()
    alpha = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            c = pixels[x, y]
            a = alpha_for(c, bool(marked[y * w + x]))
            alpha[y * w + x] = a
            if a:
                dst[x, y] = (c[0], c[1], c[2], a)
    return out, content_bbox(alpha, w, h)


def shared_square(boxes: list[tuple[int, int, int, int]], w: int, h: int) -> tuple[int, int, int, int]:
    min_x = min(b[0] for b in boxes)
    min_y = min(b[1] for b in boxes)
    max_x = max(b[2] for b in boxes)
    max_y = max(b[3] for b in boxes)
    bw = max_x - min_x + 1
    bh = max_y - min_y + 1
    side = int(max(bw, bh) * (1 + PAD_RATIO * 2))
    cx = (min_x + max_x) / 2
    cy = (min_y + max_y) / 2
    x0 = int(round(cx - side / 2))
    y0 = int(round(cy - side / 2))
    x0 = max(0, min(x0, w - side))
    y0 = max(0, min(y0, h - side))
    if x0 + side > w:
        side = w - x0
    if y0 + side > h:
        side = h - y0
    return (x0, y0, x0 + side, y0 + side)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    frames: list[Image.Image] = []
    boxes: list[tuple[int, int, int, int]] = []
    for i in range(FRAME_COUNT):
        name = f"frame-{i:02d}.png"
        src = os.path.join(SRC_DIR, name)
        if not os.path.exists(src):
            raise SystemExit(f"missing {src}")
        im, box = process_frame(src)
        frames.append(im)
        boxes.append(box)
        print(f"cut {name} bbox {box}")

    w, h = frames[0].size
    crop = shared_square(boxes, w, h)
    print("shared crop", crop)

    for i, im in enumerate(frames):
        cut = im.crop(crop).resize((OUT_SIZE, OUT_SIZE), Image.Resampling.LANCZOS)
        out = os.path.join(OUT_DIR, f"frame-{i:02d}.png")
        cut.save(out, "PNG", optimize=True)
        print(f"wrote {out} ({os.path.getsize(out)} bytes)")


if __name__ == "__main__":
    main()
