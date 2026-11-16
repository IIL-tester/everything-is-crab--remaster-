#!/usr/bin/env python3
"""Generates a crisp 5x7 pixel-art TrueType font (CrabPixel) using only Python stdlib."""
import os
import struct
import zlib

OUT_TTF = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "fonts", "crabpixel.ttf")

# 5x7 bitmap glyphs (rows top-to-bottom, 5 bits wide; optional 2 descender rows for g,j,p,q,y)
# Each string list has 7 rows (cap/ascender to baseline) or 9 rows (with 2 descender rows).
GLYPHS = {
    " ": ["....."] * 7,
    "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
    '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
    "#": [".#.#.", "#####", ".#.#.", ".#.#.", "#####", ".#.#.", "....."],
    "$": ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
    "%": ["##..#", "##.#.", "..#..", ".#...", "#.##.", "#..##", "....."],
    "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
    "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
    "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
    ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
    "*": [".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."],
    "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
    ",": [".....", ".....", ".....", ".....", ".....", "..#..", ".#..."],
    "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
    ".": [".....", ".....", ".....", ".....", ".....", "..#..", "..#.."],
    "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
    "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
    "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "2": [".###.", "#...#", "....#", "..##.", ".#...", "#....", "#####"],
    "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    "4": ["#...#", "#...#", "#...#", "#####", "....#", "....#", "....#"],
    "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
    "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
    ":": [".....", "..#..", "..#..", ".....", "..#..", "..#..", "....."],
    ";": [".....", "..#..", "..#..", ".....", "..#..", "..#..", ".#..."],
    "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
    "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
    ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
    "?": [".###.", "#...#", "....#", "..##.", "..#..", ".....", "..#.."],
    "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."],
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "B": ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    "C": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    "E": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    "F": ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    "G": [".####", "#....", "#....", "#..##", "#...#", "#...#", ".####"],
    "H": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "I": [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
    "J": ["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."],
    "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "L": ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    "N": ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    "Q": [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "S": [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "U": ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "V": ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    "W": ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
    "X": ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    "Z": ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
    "[": [".###.", ".#...", ".#...", ".#...", ".#...", ".#...", ".###."],
    "\\": ["#....", ".#...", ".#...", "..#..", "...#.", "...#.", "....#"],
    "]": [".###.", "...#.", "...#.", "...#.", "...#.", "...#.", ".###."],
    "^": ["..#..", ".#.#.", "#...#", ".....", ".....", ".....", "....."],
    "_": [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
    "`": [".#...", "..#..", ".....", ".....", ".....", ".....", "....."],
    "a": [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
    "b": ["#....", "#....", "####.", "#...#", "#...#", "#...#", "####."],
    "c": [".....", ".....", ".####", "#....", "#....", "#....", ".####"],
    "d": ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
    "e": [".....", ".....", ".###.", "#...#", "#####", "#....", ".####"],
    "f": ["..##.", ".#...", "####.", ".#...", ".#...", ".#...", ".#..."],
    "g": [".....", ".....", ".####", "#...#", "#...#", ".####", "....#", "###.."],
    "h": ["#....", "#....", "####.", "#...#", "#...#", "#...#", "#...#"],
    "i": ["..#..", ".....", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "j": ["...#.", ".....", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
    "k": ["#....", "#....", "#..#.", "#.#..", "##...", "#.#..", "#..#."],
    "l": [".#...", ".#...", ".#...", ".#...", ".#...", ".#...", "..##."],
    "m": [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#...#", "#...#"],
    "n": [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
    "o": [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
    "p": [".....", ".....", "####.", "#...#", "#...#", "####.", "#....", "#...."],
    "q": [".....", ".....", ".####", "#...#", "#...#", ".####", "....#", "....#"],
    "r": [".....", ".....", "#.##.", "##...", "#....", "#....", "#...."],
    "s": [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
    "t": [".#...", ".#...", "####.", ".#...", ".#...", ".#...", "..##."],
    "u": [".....", ".....", "#...#", "#...#", "#...#", "#...#", ".####"],
    "v": [".....", ".....", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    "w": [".....", ".....", "#...#", "#...#", "#.#.#", "##.##", "#...#"],
    "x": [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
    "y": [".....", ".....", "#...#", "#...#", "#...#", ".####", "....#", "###.."],
    "z": [".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"],
    "{": ["..##.", ".#...", ".#...", "#....", ".#...", ".#...", "..##."],
    "|": ["..#..", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "}": [".##..", "...#.", "...#.", "....#", "...#.", "...#.", ".##.."],
    "~": [".....", ".....", ".#.#.", "#.#.#", ".....", ".....", "....."],
    "\u00d7": [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
    "\u2022": [".....", ".....", "..#..", ".###.", "..#..", ".....", "....."],
    "\u2605": ["..#..", "..#..", "#####", ".###.", ".#.#.", "#...#", "....."],
}

NARROW_ADV = {
    "!": 3, "'": 3, ",": 3, ".": 3, ":": 3, ";": 3, "i": 3, "l": 4, "|": 3, " ": 4
}

UNIT = 100


def build_glyf_entry(rows):
    """Convert bitmap rows into horizontal-run rectangle contours (clockwise in TT coords)."""
    contours = []
    # Row 0 is y=600..700 (top of 7-row grid). Row 6 is y=0..100 (baseline). Row 7 is y=-100..0.
    for r_idx, row in enumerate(rows):
        y_top = (7 - r_idx) * UNIT
        y_bot = y_top - UNIT
        x = 0
        while x < len(row):
            if row[x] == "#":
                x0 = x
                while x < len(row) and row[x] == "#":
                    x += 1
                x1 = x
                # Clockwise in y-up: (x0*U, y_bot) -> (x0*U, y_top) -> (x1*U, y_top) -> (x1*U, y_bot)
                contours.append([
                    (x0 * UNIT, y_bot),
                    (x0 * UNIT, y_top),
                    (x1 * UNIT, y_top),
                    (x1 * UNIT, y_bot),
                ])
            else:
                x += 1

    if not contours:
        return b"", 0, 0, (0, 0, 0, 0)

    pts = [pt for c in contours for pt in c]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    xmin, ymin, xmax, ymax = min(xs), min(ys), max(xs), max(ys)

    end_pts = []
    idx = -1
    for c in contours:
        idx += len(c)
        end_pts.append(idx)

    # Flags: 0x01 = on-curve, 0x02 = x-short-vector, 0x10 = positive x-short (or same if 0)
    # Use 16-bit signed deltas (flag = 0x01) for simplicity and zero bugs
    flags = bytes([0x01] * len(pts))
    dx_bytes = bytearray()
    dy_bytes = bytearray()
    px, py = 0, 0
    for x, y in pts:
        dx_bytes += struct.pack(">h", x - px)
        dy_bytes += struct.pack(">h", y - py)
        px, py = x, y

    header = struct.pack(">hhhhh", len(contours), xmin, ymin, xmax, ymax)
    end_pts_bytes = struct.pack(">" + "H" * len(end_pts), *end_pts)
    inst_len = struct.pack(">H", 0)
    raw = header + end_pts_bytes + inst_len + flags + bytes(dx_bytes) + bytes(dy_bytes)
    if len(raw) % 2:
        raw += b"\x00"
    return raw, len(pts), len(contours), (xmin, ymin, xmax, ymax)


def calc_checksum(data: bytes) -> int:
    padded = data + b"\x00" * ((4 - len(data) % 4) % 4)
    total = 0
    for i in range(0, len(padded), 4):
        total = (total + struct.unpack(">I", padded[i:i + 4])[0]) & 0xFFFFFFFF
    return total


def build_ttf():
    # Ordered glyph list: 0 = .notdef, then sorted codepoints
    codepoints = sorted(ord(k) for k in GLYPHS.keys())
    glyph_entries = []  # (cp_or_None, raw_bytes, adv_px, lsb, n_pts, n_contours, bbox)

    # .notdef box
    notdef_rows = ["#####", "#...#", "#...#", "#...#", "#...#", "#...#", "#####"]
    raw, np_, nc, bbox = build_glyf_entry(notdef_rows)
    glyph_entries.append((None, raw, 600, bbox[0], np_, nc, bbox))

    for cp in codepoints:
        ch = chr(cp)
        rows = GLYPHS[ch]
        raw, np_, nc, bbox = build_glyf_entry(rows)
        adv = NARROW_ADV.get(ch, 6) * UNIT
        lsb = bbox[0] if raw else 0
        glyph_entries.append((cp, raw, adv, lsb, np_, nc, bbox))

    num_glyphs = len(glyph_entries)
    max_pts = max(g[4] for g in glyph_entries)
    max_contours = max(g[5] for g in glyph_entries)
    all_bboxes = [g[6] for g in glyph_entries if g[1]]
    g_xmin = min(b[0] for b in all_bboxes)
    g_ymin = min(b[1] for b in all_bboxes)
    g_xmax = max(b[2] for b in all_bboxes)
    g_ymax = max(b[3] for b in all_bboxes)

    # 1. glyf & loca (long format, indexToLocFormat = 1)
    glyf_buf = bytearray()
    loca_offsets = []
    for g in glyph_entries:
        loca_offsets.append(len(glyf_buf))
        glyf_buf += g[1]
    loca_offsets.append(len(glyf_buf))
    loca_buf = struct.pack(">" + "I" * len(loca_offsets), *loca_offsets)

    # 2. hmtx
    hmtx_buf = b"".join(struct.pack(">Hh", g[2], g[3]) for g in glyph_entries)
    adv_max = max(g[2] for g in glyph_entries)

    # 3. head (checkSumAdjustment filled later)
    head_buf = struct.pack(
        ">IIIIHHQQhhhhHHhhh",
        0x00010000, 0x00010000, 0, 0x5F0F3CF5, 0x000B, 1000,
        0, 0, g_xmin, g_ymin, g_xmax, g_ymax, 0, 8, 2, 1, 0
    )

    # 4. hhea
    hhea_buf = struct.pack(
        ">IhhhHhhhhhhhhhhhH",
        0x00010000,  # version
        800,         # ascender
        -200,        # descender
        0,           # lineGap
        adv_max,     # advanceWidthMax
        min(g[3] for g in glyph_entries),
        0,           # minRightSideBearing
        g_xmax,      # xMaxExtent
        1, 0, 0,     # caretSlopeRise, Run, Offset
        0, 0, 0, 0,  # reserved
        0,           # metricDataFormat
        num_glyphs   # numberOfHMetrics
    )

    # 5. maxp (version 1.0, 32 bytes)
    maxp_buf = struct.pack(
        ">IHHHHHHHHHHHHHH",
        0x00010000, num_glyphs, max_pts, max_contours,
        0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0
    )

    # 6. OS/2 (version 4, 96 bytes)
    os2_buf = struct.pack(
        ">HhHHHhhhhhhhhhhh10sIIII4sHHHhhhHHIIhhHHH",
        4,           # version
        600,         # xAvgCharWidth
        400,         # usWeightClass (Regular)
        5,           # usWidthClass (Medium)
        0,           # fsType
        500, 500, 0, 400,  # subscript
        500, 500, 0, 400,  # superscript
        100, 300,    # strikeoutSize, Position
        0,           # sFamilyClass
        b"\x02\x0b\x06\x09\x02\x02\x02\x02\x02\x04",  # panose
        0x00000001, 0, 0, 0,  # ulUnicodeRange1..4
        b"CRAB",     # achVendID
        0x0040,      # fsSelection (REGULAR)
        min(codepoints), max(codepoints),
        800, -200, 0,  # sTypoAscender, sTypoDescender, sTypoLineGap
        800, 200,      # usWinAscent, usWinDescent (both positive!)
        0x00000001, 0, # ulCodePageRange1, 2
        500, 700,      # sxHeight, sCapHeight
        0, 32, 1       # usDefaultChar, usBreakChar, usMaxContext
    )

    # 7. cmap (format 4 subtable shared by platform 0 enc 3 and platform 3 enc 1)
    # Build contiguous segments
    cp_to_gid = {g[0]: idx for idx, g in enumerate(glyph_entries) if g[0] is not None}
    segments = []
    start = end = None
    for cp in codepoints:
        if start is None:
            start = end = cp
        elif cp == end + 1 and cp_to_gid[cp] == cp_to_gid[end] + 1:
            end = cp
        else:
            segments.append((start, end, cp_to_gid[start] - start))
            start = end = cp
    if start is not None:
        segments.append((start, end, cp_to_gid[start] - start))
    segments.append((0xFFFF, 0xFFFF, 1))

    seg_count = len(segments)
    seg_x2 = seg_count * 2
    search_range = 2 * (1 << (seg_count.bit_length() - 1))
    entry_selector = seg_count.bit_length() - 1
    range_shift = seg_x2 - search_range

    end_codes = struct.pack(">" + "H" * seg_count, *[s[1] for s in segments])
    start_codes = struct.pack(">" + "H" * seg_count, *[s[0] for s in segments])
    id_deltas = struct.pack(">" + "h" * seg_count, *[((s[2] + 32768) % 65536 - 32768) for s in segments])
    id_range_offsets = struct.pack(">" + "H" * seg_count, *([0] * seg_count))

    fmt4_body = struct.pack(">HHHH", seg_x2, search_range, entry_selector, range_shift) + end_codes + b"\x00\x00" + start_codes + id_deltas + id_range_offsets
    fmt4 = struct.pack(">HHH", 4, 6 + len(fmt4_body), 0) + fmt4_body

    # 2 encoding records: (0, 3) and (3, 1) pointing to same subtable at offset 4 + 16 = 20
    cmap_buf = struct.pack(">HH", 0, 2) + struct.pack(">HHI", 0, 3, 20) + struct.pack(">HHI", 3, 1, 20) + fmt4

    # 8. name
    names = [
        (1, "CrabPixel"),
        (2, "Regular"),
        (3, "CrabPixel-Regular"),
        (4, "CrabPixel Regular"),
        (5, "Version 1.0"),
        (6, "CrabPixel-Regular"),
    ]
    records = bytearray()
    str_blob = bytearray()
    for nid, text in names:
        enc = text.encode("utf-16-be")
        records += struct.pack(">HHHHHH", 3, 1, 0x0409, nid, len(enc), len(str_blob))
        str_blob += enc
    name_buf = struct.pack(">HHH", 0, len(names), 6 + len(records)) + bytes(records) + bytes(str_blob)

    # 9. post (format 3.0)
    post_buf = struct.pack(">IIhhIIIII", 0x00030000, 0, -100, 100, 0, 0, 0, 0, 0)

    tables = {
        b"OS/2": os2_buf,
        b"cmap": cmap_buf,
        b"glyf": bytes(glyf_buf),
        b"head": head_buf,
        b"hhea": hhea_buf,
        b"hmtx": hmtx_buf,
        b"loca": loca_buf,
        b"maxp": maxp_buf,
        b"name": name_buf,
        b"post": post_buf,
    }

    sorted_tags = sorted(tables.keys())
    num_tables = len(sorted_tags)
    max_pow2 = 1 << (num_tables.bit_length() - 1)
    sfnt_hdr = struct.pack(">IHHHH", 0x00010000, num_tables, max_pow2 * 16, num_tables.bit_length() - 1, num_tables * 16 - max_pow2 * 16)

    offset = 12 + num_tables * 16
    dir_entries = bytearray()
    table_blobs = bytearray()
    head_offset = 0
    for tag in sorted_tags:
        data = tables[tag]
        if tag == b"head":
            head_offset = offset
        csum = calc_checksum(data)
        dir_entries += struct.pack(">4sIII", tag, csum, offset, len(data))
        pad = (4 - len(data) % 4) % 4
        table_blobs += data + b"\x00" * pad
        offset += len(data) + pad

    font_bytes = bytearray(sfnt_hdr + dir_entries + table_blobs)
    whole_csum = calc_checksum(bytes(font_bytes))
    adj = (0xB1B0AFBA - whole_csum) & 0xFFFFFFFF
    struct.pack_into(">I", font_bytes, head_offset + 8, adj)

    os.makedirs(os.path.dirname(OUT_TTF), exist_ok=True)
    with open(OUT_TTF, "wb") as f:
        f.write(font_bytes)
    print(f"Wrote {OUT_TTF} ({len(font_bytes)} bytes, {num_glyphs} glyphs)")


if __name__ == "__main__":
    build_ttf()
    from PIL import Image, ImageDraw, ImageFont
    font = ImageFont.truetype(OUT_TTF, 30)
    img = Image.new("RGB", (1100, 140), (24, 30, 42))
    draw = ImageDraw.Draw(img)
    draw.text((16, 16), "EVERYTHING IS CRAB 0123456789 +12 HP", font=font, fill=(255, 210, 60))
    draw.text((16, 72), "The quick brown fox jumps over the lazy dog! ★ • ×", font=font, fill=(240, 248, 255))
    img.save("/tmp/fontpreview.png")
    print("Saved /tmp/fontpreview.png")
