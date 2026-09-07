"""Build the 15-slide Blue Lagos executive presentation.

The archived 30-slide HTML deck remains untouched. This script creates current
maps from the verified September 2026 snapshot and an editable 16:9 PPTX.
"""

from __future__ import annotations

import json
import math
import textwrap
import zipfile
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import Circle as PlotCircle
from PIL import Image, ImageDraw, ImageEnhance
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_THEME_COLOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
GEN = HERE / "generated"
OUT = HERE / "Blue_Lagos_Deputy_Governor_Presentation.pptx"
ASSETS = ROOT / "docs" / "presentation" / "assets"
SNAPSHOT = ROOT / "data" / "presentation-snapshot.json"
SPATIAL = ROOT / "data" / "spatial"
REPORT = ROOT / "docs" / "Blue Lagos Community Baseline Report.docx"

W, H = 13.333333, 7.5
FONT = "Segoe UI"
FONT_DISPLAY = "Segoe UI Semibold"

NAVY = "071C2C"
BLUE = "075D9C"
OCEAN = "0989C5"
TEAL = "1A9C91"
CREAM = "F6F1E7"
WHITE = "FFFFFF"
INK = "132A38"
MUTED = "60717B"
SAND = "D8B47A"
CORAL = "D65C55"
GREEN = "2D8A67"
PALE_BLUE = "DCECF2"
PALE_TEAL = "DDEFEA"
PALE_SAND = "EFE5D4"
LINE = "CCD8DA"


def rgb(value: str) -> RGBColor:
    return RGBColor.from_string(value)


def set_fill(shape, color: str, transparency: int = 0) -> None:
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(color)
    shape.fill.transparency = transparency


def set_background(slide, color: str) -> None:
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = rgb(color)


def set_line(shape, color: str | None = None, width: float = 0.8, transparency: int = 0) -> None:
    if color is None:
        shape.line.fill.background()
        return
    shape.line.color.rgb = rgb(color)
    shape.line.width = Pt(width)
    shape.line.transparency = transparency


def add_rect(slide, x, y, w, h, fill, line=None, radius=False, transparency=0):
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    shape = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    set_fill(shape, fill, transparency)
    set_line(shape, line)
    if radius:
        shape.adjustments[0] = 0.08
    return shape


def add_text(
    slide,
    text,
    x,
    y,
    w,
    h,
    size=20,
    color=INK,
    bold=False,
    font=FONT,
    align=PP_ALIGN.LEFT,
    valign=MSO_ANCHOR.TOP,
    margin=0,
    fit=False,
    rotation=0,
):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    box.rotation = rotation
    tf = box.text_frame
    tf.clear()
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Inches(margin)
    tf.vertical_anchor = valign
    tf.word_wrap = True
    if fit:
        tf.fit_text(font_family=font, max_size=Pt(size))
    p = tf.paragraphs[0]
    p.alignment = align
    p.space_after = Pt(0)
    r = p.add_run()
    r.text = text
    r.font.name = font
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = rgb(color)
    return box


def add_rich_text(slide, runs, x, y, w, h, size=20, color=INK, valign=MSO_ANCHOR.TOP, align=PP_ALIGN.LEFT):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = valign
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    p.space_after = Pt(0)
    for item in runs:
        r = p.add_run()
        r.text = item[0]
        r.font.name = item[4] if len(item) > 4 else FONT
        r.font.size = Pt(item[1] if len(item) > 1 else size)
        r.font.bold = item[2] if len(item) > 2 else False
        r.font.color.rgb = rgb(item[3] if len(item) > 3 else color)
    return box


def add_title(slide, kicker, title, subtitle=None, dark=False, number=None):
    main = WHITE if dark else INK
    dim = "BFD1D9" if dark else MUTED
    accent = "67D6CF" if dark else TEAL
    add_text(slide, kicker.upper(), 0.72, 0.36, 4.0, 0.25, 10, accent, True)
    add_text(slide, title, 0.72, 0.74, 11.85, 0.82, 29, main, True, FONT_DISPLAY)
    if subtitle:
        add_text(slide, subtitle, 0.74, 1.54, 11.45, 0.48, 14.5, dim)
    if number is not None:
        add_text(slide, f"{number:02d}", 12.05, 0.34, 0.55, 0.25, 9.5, dim, True, align=PP_ALIGN.RIGHT)


def add_footer(slide, source, number, dark=False):
    line_color = "315161" if dark else LINE
    color = "BFD1D9" if dark else MUTED
    line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.72), Inches(7.12), Inches(11.86), Inches(0.012))
    set_fill(line, line_color)
    set_line(line, None)
    add_text(slide, source, 0.72, 7.17, 10.9, 0.19, 9.4, color)
    add_text(slide, f"BLUE LAGOS  |  {number:02d}", 11.15, 7.17, 1.43, 0.19, 9.4, color, True, align=PP_ALIGN.RIGHT)


def add_notes(slide, main, say, technical):
    notes = (
        f"MAIN MESSAGE\n{main}\n\n"
        f"SAY THIS\n{say}\n\n"
        f"TECHNICAL BACKUP\n{technical}"
    )
    slide.notes_slide.notes_text_frame.text = notes


def add_picture_crop(slide, path, x, y, w, h, darken=0.0, name=None):
    image = Image.open(path)
    iw, ih = image.size
    target = w / h
    source = iw / ih
    if source > target:
        crop_w = int(ih * target)
        left = (iw - crop_w) // 2
        crop = (left, 0, left + crop_w, ih)
    else:
        crop_h = int(iw / target)
        top = (ih - crop_h) // 2
        crop = (0, top, iw, top + crop_h)
    image = image.crop(crop)
    if darken:
        image = ImageEnhance.Brightness(image).enhance(1 - darken)
    temp = GEN / f"crop_{Path(path).stem}_{int(x*100)}_{int(y*100)}_{int(w*100)}_{int(h*100)}.jpg"
    image.convert("RGB").save(temp, quality=92)
    pic = slide.shapes.add_picture(str(temp), Inches(x), Inches(y), Inches(w), Inches(h))
    if name:
        pic.name = name
    return pic


def add_logo(slide, x, y, w, dark=False):
    path = GEN / "blue_lagos_logo.png"
    pic = slide.shapes.add_picture(str(path), Inches(x), Inches(y), width=Inches(w))
    pic.name = "Official Blue Lagos logo extracted from baseline report"
    return pic


def add_stat(slide, value, label, x, y, w, h, color=BLUE, dark=False, note=None):
    bg = "0D2D42" if dark else WHITE
    title = WHITE if dark else INK
    dim = "BFD1D9" if dark else MUTED
    card = add_rect(slide, x, y, w, h, bg, "27495A" if dark else LINE, True)
    add_text(slide, value, x + 0.22, y + 0.18, w - 0.44, 0.55, 28, color if not dark else "67D6CF", True, FONT_DISPLAY)
    add_text(slide, label, x + 0.22, y + 0.78, w - 0.44, 0.36, 12.5, title, True)
    if note:
        add_text(slide, note, x + 0.22, y + 1.17, w - 0.44, h - 1.31, 10.5, dim)
    return card


def add_bar(slide, label, value, x, y, w, color=CORAL, dark=False):
    text_color = WHITE if dark else INK
    track = "294657" if dark else "E3E8E7"
    add_text(slide, label, x, y, w * 0.57, 0.28, 11.5, text_color, True)
    add_rect(slide, x + w * 0.58, y + 0.035, w * 0.31, 0.17, track, None, True)
    add_rect(slide, x + w * 0.58, y + 0.035, w * 0.31 * value / 100, 0.17, color, None, True)
    add_text(slide, f"{value:g}%", x + w * 0.91, y - 0.01, w * 0.09, 0.27, 11.5, text_color, True, align=PP_ALIGN.RIGHT)


def add_chip(slide, text, x, y, w, fill=PALE_TEAL, color=TEAL):
    add_rect(slide, x, y, w, 0.35, fill, None, True)
    add_text(slide, text, x + 0.11, y + 0.07, w - 0.22, 0.18, 9.5, color, True, align=PP_ALIGN.CENTER)


def haversine(a, b):
    lat1, lon1 = math.radians(a["latitude"]), math.radians(a["longitude"])
    lat2, lon2 = math.radians(b["latitude"]), math.radians(b["longitude"])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0088 * 2 * math.asin(math.sqrt(h))


def geometry_lines(geometry):
    kind = geometry["type"]
    coords = geometry["coordinates"]
    if kind == "Polygon":
        for ring in coords:
            yield ring
    elif kind == "MultiPolygon":
        for poly in coords:
            for ring in poly:
                yield ring
    elif kind == "LineString":
        yield coords
    elif kind == "MultiLineString":
        yield from coords


def plot_geo(ax, fc, color, width=0.5, alpha=1.0, fill=None, zorder=1):
    for feature in fc.get("features", []):
        geom = feature.get("geometry")
        if not geom:
            continue
        for ring in geometry_lines(geom):
            xs = [p[0] for p in ring]
            ys = [p[1] for p in ring]
            if fill and geom["type"] in ("Polygon", "MultiPolygon"):
                ax.fill(xs, ys, color=fill, alpha=alpha, linewidth=0, zorder=zorder)
            ax.plot(xs, ys, color=color, linewidth=width, alpha=alpha, zorder=zorder + 1)


def save_map(records, boundaries, waterways, health, marine, context):
    pts = [r for r in records if r.get("latitude") is not None and r.get("longitude") is not None]
    state = {"features": [f for f in boundaries["features"] if f["properties"].get("admin_level") == "ADM1"]}
    lgas = {"features": [f for f in boundaries["features"] if f["properties"].get("admin_level") == "ADM2"]}

    def setup(ax, dark=False):
        ax.set_facecolor("#071C2C" if dark else "#E6F1F1")
        plot_geo(ax, state, "#173A4C" if dark else "#90AAB0", 1.0, 1, "#0A293D" if dark else "#F6F1E7", 1)
        plot_geo(ax, lgas, "#527080" if dark else "#B5C2C2", 0.45, 0.8, None, 2)
        plot_geo(ax, waterways, "#1C779B" if dark else "#8BC7D8", 0.22, 0.45, None, 2)
        ax.set_xlim(2.65, 4.65)
        ax.set_ylim(6.30, 6.85)
        ax.set_aspect("equal", adjustable="box")
        ax.axis("off")

    fig, ax = plt.subplots(figsize=(14, 5.1), dpi=180)
    fig.patch.set_facecolor("#071C2C")
    setup(ax, True)
    ax.scatter([p["longitude"] for p in pts], [p["latitude"] for p in pts], s=23, c="#67D6CF", edgecolors="#FFFFFF", linewidths=0.45, zorder=8)
    ax.text(2.70, 6.80, "93 geolocated communities", color="white", fontsize=13, fontweight="bold")
    ax.text(2.70, 6.755, "within the 134-community field register", color="#BFD1D9", fontsize=9)
    plt.subplots_adjust(0, 0, 1, 1)
    fig.savefig(GEN / "coverage_map.png", bbox_inches="tight", pad_inches=0, facecolor=fig.get_facecolor())
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(12, 6.3), dpi=180)
    fig.patch.set_facecolor("#071C2C")
    setup(ax, True)
    mx = [f["geometry"]["coordinates"] for f in marine["features"]]
    ax.scatter([x[0] for x in mx], [x[1] for x in mx], s=7, c="#D8B47A", alpha=0.52, zorder=4)
    ax.scatter([p["longitude"] for p in pts], [p["latitude"] for p in pts], s=25, c="#67D6CF", edgecolors="white", linewidths=0.45, zorder=8)
    ax.text(2.70, 6.80, "Communities within Lagos's water-shaped access network", color="white", fontsize=12, fontweight="bold")
    ax.text(2.70, 6.755, "communities  •  mapped waterways  •  mapped marine-access points", color="#BFD1D9", fontsize=8.5)
    plt.subplots_adjust(0, 0, 1, 1)
    fig.savefig(GEN / "water_network_map.png", bbox_inches="tight", pad_inches=0, facecolor=fig.get_facecolor())
    plt.close(fig)

    ctx = {c["community_id"]: c for c in context["communities"]}
    access_pts = [(p, ctx.get(p["id"])) for p in pts if ctx.get(p["id"])]
    fig, ax = plt.subplots(figsize=(11, 6.4), dpi=180)
    fig.patch.set_facecolor("#F6F1E7")
    setup(ax, False)
    hx = [f["geometry"]["coordinates"] for f in health["features"]]
    mx = [f["geometry"]["coordinates"] for f in marine["features"]]
    ax.scatter([x[0] for x in hx], [x[1] for x in hx], s=2.5, c="#78949C", alpha=0.28, zorder=3)
    ax.scatter([x[0] for x in mx], [x[1] for x in mx], s=4, c="#0989C5", alpha=0.35, zorder=3)
    for p, c in access_pts:
        d = c["distance_km"]
        col = "#D65C55" if d > 10 else "#D8B47A" if d >= 5 else "#1A9C91"
        ax.scatter(p["longitude"], p["latitude"], s=25, c=col, edgecolors="white", linewidths=0.4, zorder=7)
    ax.text(2.70, 6.80, "Straight-line screening distance to mapped health facilities", color="#132A38", fontsize=12, fontweight="bold")
    ax.text(2.70, 6.755, "teal <5 km   sand 5–10 km   coral >10 km", color="#60717B", fontsize=8.5)
    plt.subplots_adjust(0, 0, 1, 1)
    fig.savefig(GEN / "access_map.png", bbox_inches="tight", pad_inches=0, facecolor=fig.get_facecolor())
    plt.close(fig)

    yegunda = next(r for r in records if (r.get("final_name") or "").lower() == "yegunda")
    nearby = [p for p in pts if haversine(yegunda, p) <= 12]
    fig, ax = plt.subplots(figsize=(7.2, 6.2), dpi=180)
    fig.patch.set_facecolor("#E6F1F1")
    ax.set_facecolor("#E6F1F1")
    plot_geo(ax, waterways, "#4DAAC7", 0.55, 0.6, None, 2)
    ax.scatter([p["longitude"] for p in nearby], [p["latitude"] for p in nearby], s=28, c="#78949C", edgecolors="white", linewidths=0.5, zorder=5)
    ax.scatter([yegunda["longitude"]], [yegunda["latitude"]], s=120, c="#D65C55", edgecolors="white", linewidths=1.5, zorder=7)
    ax.annotate("Yegunda", (yegunda["longitude"], yegunda["latitude"]), xytext=(8, 8), textcoords="offset points", fontsize=11, fontweight="bold", color="#132A38")
    ax.set_xlim(yegunda["longitude"] - 0.13, yegunda["longitude"] + 0.13)
    ax.set_ylim(yegunda["latitude"] - 0.10, yegunda["latitude"] + 0.10)
    ax.set_aspect("equal", adjustable="box")
    ax.axis("off")
    plt.subplots_adjust(0, 0, 1, 1)
    fig.savefig(GEN / "yegunda_map.png", bbox_inches="tight", pad_inches=0, facecolor=fig.get_facecolor())
    plt.close(fig)

    centre = next(r for r in records if r.get("final_name") == "Ito Agan comminity")
    reached = [p for p in pts if haversine(centre, p) <= 5]
    fig, ax = plt.subplots(figsize=(9.5, 6.0), dpi=180)
    fig.patch.set_facecolor("#071C2C")
    ax.set_facecolor("#071C2C")
    plot_geo(ax, waterways, "#167DA3", 0.55, 0.55, None, 2)
    lat_radius = 5 / 111.0
    lon_radius = 5 / (111.0 * math.cos(math.radians(centre["latitude"])))
    ellipse = plt.matplotlib.patches.Ellipse((centre["longitude"], centre["latitude"]), 2 * lon_radius, 2 * lat_radius, facecolor="#1A9C91", alpha=0.17, edgecolor="#67D6CF", linewidth=1.5, zorder=3)
    ax.add_patch(ellipse)
    ax.scatter([p["longitude"] for p in reached], [p["latitude"] for p in reached], s=48, c="#67D6CF", edgecolors="white", linewidths=0.7, zorder=7)
    ax.scatter([centre["longitude"]], [centre["latitude"]], s=170, marker="*", c="#D8B47A", edgecolors="white", linewidths=0.8, zorder=9)
    for p in reached:
        if p["final_name"] in {"Ito Agan comminity", "Nanti", "Irede Onisiwo, Apapa Quays", "Ogogoro Village", "Takwa bay"}:
            ax.annotate(p["final_name"].replace(" comminity", ""), (p["longitude"], p["latitude"]), xytext=(5, 5), textcoords="offset points", fontsize=7.2, color="white")
    ax.set_xlim(centre["longitude"] - 0.075, centre["longitude"] + 0.075)
    ax.set_ylim(centre["latitude"] - 0.060, centre["latitude"] + 0.060)
    ax.set_aspect("equal", adjustable="box")
    ax.axis("off")
    plt.subplots_adjust(0, 0, 1, 1)
    fig.savefig(GEN / "service_cluster.png", bbox_inches="tight", pad_inches=0, facecolor=fig.get_facecolor())
    plt.close(fig)
    return yegunda, centre, reached


def extract_logo():
    target = GEN / "blue_lagos_logo.png"
    with zipfile.ZipFile(REPORT) as archive:
        data = archive.read("word/media/image1.png")
    target.write_bytes(data)
    image = Image.open(target).convert("RGBA")
    # Make near-white background transparent while retaining the approved mark.
    px = image.load()
    for yy in range(image.height):
        for xx in range(image.width):
            r, g, b, a = px[xx, yy]
            if r > 244 and g > 244 and b > 244:
                px[xx, yy] = (r, g, b, 0)
    bbox = image.getbbox()
    if bbox:
        image = image.crop(bbox)
    image.save(target)


def add_platform_mockup(slide, map_path):
    add_rect(slide, 0.82, 2.03, 11.7, 4.68, WHITE, "AFC1C4", True)
    add_rect(slide, 0.82, 2.03, 11.7, 0.52, NAVY, None, True)
    add_logo(slide, 1.03, 2.14, 1.05)
    for i, label in enumerate(["Overview", "Community Map", "Priorities", "Scenarios"]):
        color = "67D6CF" if label == "Community Map" else "BFD1D9"
        add_text(slide, label, 4.92 + i * 1.27, 2.20, 1.18, 0.18, 8.5, color, label == "Community Map", align=PP_ALIGN.CENTER)
    add_rect(slide, 1.05, 2.78, 2.25, 3.55, CREAM, LINE, True)
    add_text(slide, "LAYER THE EVIDENCE", 1.28, 3.02, 1.75, 0.22, 9.5, TEAL, True)
    layers = [("Surveyed communities", True), ("LGA boundaries", True), ("Waterways", True), ("Mapped health facilities", True), ("Marine access", False), ("Community priorities", False)]
    for i, (label, on) in enumerate(layers):
        yy = 3.45 + i * 0.43
        add_rect(slide, 1.27, yy, 0.29, 0.17, TEAL if on else WHITE, TEAL, True)
        if on:
            add_text(slide, "✓", 1.29, yy - 0.015, 0.25, 0.18, 8.5, WHITE, True, align=PP_ALIGN.CENTER)
        add_text(slide, label, 1.68, yy - 0.025, 1.37, 0.25, 9.5, INK)
    slide.shapes.add_picture(str(map_path), Inches(3.55), Inches(2.78), Inches(6.58), Inches(3.55))
    add_rect(slide, 10.35, 2.78, 1.85, 3.55, PALE_BLUE, None, True)
    add_text(slide, "COMMUNITY", 10.57, 3.02, 1.41, 0.2, 9.5, BLUE, True)
    add_text(slide, "Yegunda", 10.57, 3.35, 1.41, 0.32, 17, INK, True, FONT_DISPLAY)
    add_text(slide, "Epe\nRoad + water access\nPriority: water, health, education, power, jetty", 10.57, 3.83, 1.38, 1.28, 10, MUTED)
    add_rect(slide, 10.57, 5.56, 1.31, 0.42, BLUE, None, True)
    add_text(slide, "Open profile", 10.65, 5.68, 1.15, 0.16, 8.5, WHITE, True, align=PP_ALIGN.CENTER)
    add_text(slide, "Editable illustration of the current application interface", 0.98, 6.46, 5.0, 0.16, 8.5, MUTED)


def build():
    GEN.mkdir(parents=True, exist_ok=True)
    extract_logo()
    snapshot = json.loads(SNAPSHOT.read_text(encoding="utf8"))
    records = snapshot["records"]
    boundaries = json.loads((SPATIAL / "lagos-administrative.json").read_text(encoding="utf8"))
    waterways = json.loads((SPATIAL / "processed" / "osm-waterways.geojson").read_text(encoding="utf8"))
    health = json.loads((SPATIAL / "processed" / "osm-health-facilities.geojson").read_text(encoding="utf8"))
    marine = json.loads((SPATIAL / "processed" / "osm-marine-access.geojson").read_text(encoding="utf8"))
    context = json.loads((SPATIAL / "derived" / "community-spatial-context.json").read_text(encoding="utf8"))

    assert snapshot["validation"]["rowCount"] == 134
    assert sum(r["estimated_population"] for r in records) == 502_002
    assert snapshot["validation"]["geolocatedCount"] == 93
    yegunda, centre, reached = save_map(records, boundaries, waterways, health, marine, context)
    assert len(reached) == 11
    reached_population = sum(r["estimated_population"] for r in reached)
    assert reached_population == 75_242

    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)
    blank = prs.slide_layouts[6]

    # 01 Cover
    slide = prs.slides.add_slide(blank)
    set_background(slide, NAVY)
    add_picture_crop(slide, ASSETS / "hero.jpg", 9.08, 0, 4.25, H, darken=0.10)
    add_rect(slide, 8.98, 0, 0.10, H, TEAL, None)
    add_logo(slide, 0.72, 0.55, 2.25)
    add_text(slide, "BLUE LAGOS", 0.72, 2.03, 7.7, 0.74, 35, WHITE, True, FONT_DISPLAY)
    add_text(slide, "From Riverine Communities\nto Better Decisions", 0.74, 2.82, 8.0, 1.06, 25, WHITE, True, FONT_DISPLAY)
    add_rich_text(slide, [("134 communities", 20, True, "67D6CF"), ("  |  ", 18, False, "BFD1D9"), ("502,002 people represented", 20, True, WHITE)], 0.74, 4.22, 8.4, 0.42)
    add_text(slide, "COMMUNITY  •  EVIDENCE  •  ACTION", 0.74, 5.37, 5.55, 0.28, 12, "67D6CF", True)
    add_text(slide, "Blue Lagos Sustainability Initiative", 0.74, 6.32, 4.9, 0.26, 12, "DCE7EA", True)
    add_text(slide, "SEPTEMBER 2026", 6.57, 6.62, 1.92, 0.22, 10, "BFD1D9", True, align=PP_ALIGN.RIGHT)
    add_notes(slide, "Blue Lagos connects direct community engagement, practical action and better planning for riverine Lagos.", "Your Excellency, thank you for the opportunity. Blue Lagos works directly with riverine communities to understand their needs and connect those needs to practical action. Today I will briefly show who we are, what we have done, what the field evidence is telling us, and how Lagos State can use this foundation to plan better interventions.", "The 502,002 figure is the sum of current community-reported population values across all 134 records in the verified field register, updated September 2026.")

    # 02 Who Blue Lagos is
    slide = prs.slides.add_slide(blank)
    set_background(slide, CREAM)
    add_title(slide, "Who we are", "Blue Lagos listens, understands and acts.", "We work with Lagos' riverine communities to turn local evidence into practical action.", False, 2)
    add_picture_crop(slide, ASSETS / "engage.jpg", 0.72, 2.16, 4.34, 4.50)
    pillars = [
        ("LISTEN", "Engage directly with communities and local leadership.", OCEAN, NAVY, WHITE),
        ("UNDERSTAND", "Collect and map community-level evidence.", TEAL, WHITE, INK),
        ("ACT", "Connect needs to interventions and partnerships.", GREEN, PALE_TEAL, INK),
    ]
    for i, (verb, body, accent, bg, color) in enumerate(pillars):
        y = 2.16 + i * 1.31
        add_rect(slide, 5.42, y, 7.16, 1.07, bg, LINE if bg == WHITE else None, True)
        add_text(slide, f"0{i + 1}", 5.71, y + 0.32, 0.50, 0.24, 11, accent, True)
        add_text(slide, verb, 6.34, y + 0.27, 1.64, 0.29, 14, accent if bg != NAVY else "67D6CF", True)
        add_text(slide, body, 8.02, y + 0.23, 4.12, 0.51, 15, color, True)
    add_text(slide, "Our focus is the riverine and coastal communities where access, health, infrastructure, livelihoods and environmental pressure differ from inland Lagos.", 5.44, 6.21, 6.90, 0.43, 12.5, MUTED, True)
    add_footer(slide, "Blue Lagos field engagement photograph, reproduced from the Community Baseline Report.", 2)
    add_notes(slide, "Blue Lagos is a community-facing initiative built around listening, understanding and practical action.", "Before the numbers, it is important to say who we are. Blue Lagos listens by engaging communities and their local leadership. We understand by collecting and mapping community-level evidence, and we act by connecting that evidence to practical interventions and partners. Our focus is riverine and coastal Lagos, where daily realities are different from inland, road-connected communities.", "The initiative's documented work includes community enumeration, direct field engagement, telemedicine facilitation, civic inclusion support, the Yegunda water intervention and the Community Map.")

    # 03 How Blue Lagos works
    slide = prs.slides.add_slide(blank)
    set_background(slide, WHITE)
    add_title(slide, "How Blue Lagos works", "From community relationships to practical response.", "Our role is to stay close enough to communities to understand the need, organize the evidence and help bring the right response together.", False, 3)
    add_picture_crop(slide, ASSETS / "team_water.jpg", 0.72, 2.13, 4.40, 4.52)
    journey = [
        ("COMMUNITY PRESENCE", "Reach communities directly, including places where the journey depends on water.", OCEAN, NAVY, WHITE),
        ("STRUCTURED EVIDENCE", "Turn local knowledge into a register that can be compared community by community.", TEAL, PALE_BLUE, INK),
        ("PRACTICAL RESPONSE", "Work with communities and partners on health, water, civic inclusion and planning.", GREEN, PALE_TEAL, INK),
    ]
    for i, (label, body, accent, bg, color) in enumerate(journey):
        y = 2.13 + i * 1.34
        add_rect(slide, 5.48, y, 7.10, 1.08, bg, LINE if bg != NAVY else None, True)
        add_text(slide, f"0{i + 1}", 5.76, y + 0.31, 0.50, 0.23, 10.5, accent, True)
        add_text(slide, label, 6.38, y + 0.19, 2.15, 0.40, 12.2, accent if bg != NAVY else "67D6CF", True)
        add_text(slide, body, 8.66, y + 0.18, 3.57, 0.62, 13.5, color, True)
    add_rect(slide, 5.48, 6.26, 7.10, 0.39, CREAM, None, True)
    add_text(slide, "Blue Lagos is the bridge from what communities say to what partners and government can act on.", 5.73, 6.35, 6.61, 0.20, 11.5, BLUE, True, align=PP_ALIGN.CENTER)
    add_footer(slide, "Blue Lagos field team photograph, reproduced from the Community Baseline Report.", 3)
    add_notes(slide, "Blue Lagos combines community presence, structured evidence and practical response.", "Blue Lagos begins with relationships, not software. We reach communities directly, including places where access depends on water. We organize what communities tell us into evidence that can be compared and used, then work with communities, partners and government around practical responses. That bridge between local experience and coordinated action is the role Blue Lagos is building.", "The next slides separate the verified register, field findings, delivered activities and planning analysis so that each claim retains its correct source.")

    # 04 What Blue Lagos did
    slide = prs.slides.add_slide(blank)
    set_background(slide, NAVY)
    add_title(slide, "What Blue Lagos did", "We started by going community by community.", "Actual community-level evidence now supports a clearer view of riverine Lagos.", True, 4)
    slide.shapes.add_picture(str(GEN / "coverage_map.png"), Inches(0.72), Inches(2.03), Inches(7.33), Inches(4.08))
    add_stat(slide, "134", "communities enumerated", 8.32, 2.03, 2.00, 1.47, TEAL, True)
    add_stat(slide, "502,002", "people represented", 10.56, 2.03, 2.02, 1.47, TEAL, True)
    add_stat(slide, "18", "communities physically visited", 8.32, 3.74, 4.26, 1.40, SAND, True, "Up to 18 across participating LGAs")
    add_text(slide, "Population  •  Health  •  Water + sanitation  •  Access  •  Infrastructure  •  Livelihoods  •  Flood + erosion  •  Community priorities", 8.34, 5.51, 4.18, 0.75, 11.3, WHITE, True)
    add_chip(slide, "93 currently geolocated", 0.95, 6.34, 2.30, "12384D", "67D6CF")
    add_chip(slide, "7 LGAs in the register", 3.39, 6.34, 2.03, "12384D", "67D6CF")
    add_footer(slide, "Sources: Blue Lagos field register; GRID3 2022 boundaries via geoBoundaries; OSM waterways.", 4, True)
    add_notes(slide, "Blue Lagos built the evidence base community by community and has physically engaged communities across the participating LGAs.", "We did not start by trying to build a dashboard. We started by identifying the communities themselves. Today our structured register covers 134 riverine communities representing 502,002 people, and our team has physically visited up to 18 communities across the participating LGAs. We collected evidence about population, health, water, access, infrastructure, livelihoods, the environment and community priorities.", "The 134 and 502,002 figures come from the verified September 2026 register. Ninety-three records currently have usable coordinates; the physical-visit figure is the current Blue Lagos programme total supplied for this presentation.")

    # 05 What data says
    slide = prs.slides.add_slide(blank)
    set_background(slide, CREAM)
    add_title(slide, "What the data is telling us", "The communities are different, but the same problems keep appearing.", None, False, 5)
    themes = [
        ("HEALTH + WATER", "83.6%", "No formal first-aid point", CORAL),
        ("ACCESS", "80.6%", "Unmotorised boat or no medical evacuation", OCEAN),
        ("ENVIRONMENT", "22.4%", "Reported loss of land or housing to erosion", CORAL),
        ("INFRASTRUCTURE", "93.1%", "No school beyond primary inside the community", TEAL),
        ("LIVELIHOODS", "64.9%", "Fishing is the primary occupation", GREEN),
    ]
    for i, (tag, value, label, color) in enumerate(themes):
        x = 0.72 + i * 2.40
        add_rect(slide, x, 2.19, 2.15, 3.65, WHITE, LINE, True)
        add_text(slide, tag, x + 0.18, 2.47, 1.80, 0.2, 8.8, color, True)
        add_text(slide, value, x + 0.18, 2.95, 1.80, 0.66, 27, color, True, FONT_DISPLAY)
        add_text(slide, label, x + 0.18, 3.76, 1.80, 0.96, 13.2, INK, True)
        add_rect(slide, x + 0.18, 5.12, 1.79, 0.12, "E2E8E7", None, True)
        add_rect(slide, x + 0.18, 5.12, 1.79 * float(value[:-1]) / 100, 0.12, color, None, True)
    add_rect(slide, 0.72, 6.13, 11.86, 0.53, NAVY, None, True)
    add_text(slide, "Different communities carry different combinations, but health, access, environment, infrastructure and livelihoods repeatedly overlap.", 1.05, 6.27, 11.20, 0.25, 12.5, WHITE, True, align=PP_ALIGN.CENTER)
    add_footer(slide, "Source: Blue Lagos Community Baseline Report, August 2026; shares of 134 surveyed communities.", 5)
    add_notes(slide, "The recurring pattern is overlapping pressure across health, access, environment, infrastructure and livelihoods.", "The communities are not identical, but the same broad problems keep appearing in different combinations. We see gaps in health and water, difficult physical access, environmental pressure, missing infrastructure and livelihoods constrained by geography. Fishing remains the primary occupation in almost two-thirds of the surveyed communities, so access and environmental conditions also affect household income.", "Percentages come from fixed-category field responses in the August 2026 baseline report and raw field register. They are shares of the 134 surveyed communities and do not imply that every community has every problem.")

    # 06 Health water emergency
    slide = prs.slides.add_slide(blank)
    set_background(slide, WHITE)
    add_title(slide, "Health, water + emergency access", "Healthcare is not only about having a facility nearby.", None, False, 6)
    slide.shapes.add_picture(str(GEN / "access_map.png"), Inches(7.93), Inches(1.70), Inches(4.65), Inches(3.25))
    add_picture_crop(slide, ASSETS / "boat.jpg", 7.93, 5.10, 4.65, 1.54)
    add_text(slide, "For many communities, the health journey begins at the landing point.", 0.72, 1.84, 6.60, 0.55, 18.5, INK, True, FONT_DISPLAY)
    add_bar(slide, "No formal first-aid point", 83.6, 0.72, 2.68, 6.55, CORAL)
    add_bar(slide, "No motorised medical evacuation", 80.6, 0.72, 3.35, 6.55, CORAL)
    add_bar(slide, "Open or open-water defecation", 81.3, 0.72, 4.02, 6.55, BLUE)
    add_bar(slide, "Well as primary drinking water", 61.9, 0.72, 4.69, 6.55, SAND)
    add_rect(slide, 0.72, 5.55, 6.55, 1.09, PALE_TEAL, None, True)
    add_text(slide, "Planning implication", 0.98, 5.80, 1.52, 0.21, 10, TEAL, True)
    add_text(slide, "Health outreach, safe water and emergency movement need to be planned together.", 2.47, 5.75, 4.43, 0.48, 15, INK, True)
    add_footer(slide, "Sources: baseline report; Blue Lagos spatial context; OSM mapped health facilities. Distances are straight-line.", 6)
    add_notes(slide, "Healthcare access combines facility availability, safe water, sanitation and the practical ability to move a patient.", "A clinic is not truly accessible if a patient cannot get safely from the community to the route. The field evidence shows major gaps in first aid, motorised evacuation, sanitation and drinking water. The map adds straight-line screening distance to the nearest mapped health facility, but the real journey can still be harder because it may depend on water transport.", "The percentages are survey response shares. Facility distances use great-circle distance to OSM-mapped health facilities; they are not travel time and do not verify that a mapped facility is operational.")

    # 07 Access map
    slide = prs.slides.add_slide(blank)
    set_background(slide, CREAM)
    add_title(slide, "Access and the water network", "Water is part of the transport network.", "Communities, waterways and landing points have to be understood together.", False, 7)
    slide.shapes.add_picture(str(GEN / "water_network_map.png"), Inches(0.72), Inches(2.13), Inches(8.08), Inches(4.52))
    add_rect(slide, 9.05, 2.13, 3.53, 4.52, NAVY, None, True)
    add_text(slide, "WATER-RELIANT ACCESS AFFECTS", 9.38, 2.52, 2.83, 0.23, 10, "67D6CF", True)
    impacts = [("Emergency evacuation", CORAL), ("Healthcare", OCEAN), ("Education", TEAL), ("Markets and jobs", SAND), ("Government services", GREEN)]
    for i, (label, color) in enumerate(impacts):
        y = 3.05 + i * 0.57
        add_rect(slide, 9.38, y + 0.04, 0.13, 0.13, color, None, True)
        add_text(slide, label, 9.70, y, 2.30, 0.28, 13, WHITE, True)
    add_text(slide, "Road planning alone cannot explain practical reach.", 9.38, 6.12, 2.70, 0.38, 10.5, "BFD1D9", True)
    add_footer(slide, "Sources: field register; OSM mapped waterways and marine-access points. Navigability is not asserted.", 7)
    add_notes(slide, "Waterways and landing points are part of the service-delivery system for riverine communities.", "For many communities, water is part of the transport network. That affects emergency evacuation, healthcare, education, access to markets and jobs, and even how government teams reach residents. Looking only at roads leaves out a major part of how these communities move.", "The map combines geolocated survey communities with OSM-mapped waterways and marine-access points. These are contextual open-mapping features, not an official jetty register or a verified navigable network.")

    # 08 Environment
    slide = prs.slides.add_slide(blank)
    set_background(slide, NAVY)
    add_title(slide, "Flooding, erosion + environment", "Environmental pressure is already part of daily life.", "Field experience and historical spatial evidence point to pressure on settlement, housing and livelihoods.", True, 8)
    add_rect(slide, 0.72, 2.05, 7.71, 4.54, WHITE, None, True)
    slide.shapes.add_picture(str(ASSETS / "severity.jpg"), Inches(0.86), Inches(2.22), Inches(7.43), Inches(2.81))
    slide.shapes.add_picture(str(ASSETS / "shoreline.jpg"), Inches(0.86), Inches(5.19), Inches(7.43), Inches(1.25))
    add_rect(slide, 8.74, 2.05, 3.84, 4.54, "0D2D42", "315161", True)
    add_text(slide, "22.4%", 9.12, 2.55, 3.05, 0.68, 32, CORAL, True, FONT_DISPLAY)
    add_text(slide, "of surveyed communities reported losing living space or houses to erosion or water encroachment in the previous five years.", 9.12, 3.42, 3.05, 1.30, 15, WHITE, True)
    add_text(slide, "Read the two evidence types separately", 9.12, 5.11, 3.05, 0.26, 10.5, "67D6CF", True)
    add_text(slide, "Community impacts are field-reported. The maps reproduce historical analysis from the August baseline report.", 9.12, 5.51, 3.05, 0.72, 11.5, "BFD1D9")
    add_footer(slide, "Figures reproduced from Blue Lagos Community Baseline Report, sections 3.9 and 5.4.", 8, True)
    add_notes(slide, "Environmental pressure is already experienced as loss of land, housing and livelihood security.", "Communities are not discussing flooding and erosion as distant climate concepts. More than one in five reported losing living space or houses to erosion or water encroachment. These report maps add historical spatial context, while the community impacts remain field evidence.", "The cartography is reproduced from the August 2026 baseline report. It is not presented as a live platform layer or new satellite analysis.")

    # 09 Yegunda dossier
    slide = prs.slides.add_slide(blank)
    set_background(slide, WHITE)
    add_title(slide, "One community", "Every dot on the map has a different story.", "Yegunda Community, Epe", False, 9)
    slide.shapes.add_picture(str(GEN / "yegunda_map.png"), Inches(0.72), Inches(2.07), Inches(4.35), Inches(4.58))
    add_rect(slide, 5.35, 2.07, 7.23, 1.13, NAVY, None, True)
    add_text(slide, "312", 5.69, 2.35, 1.17, 0.51, 27, "67D6CF", True, FONT_DISPLAY)
    add_text(slide, "community-reported population", 6.84, 2.39, 2.65, 0.41, 12, WHITE, True)
    add_text(slide, "Road + water", 9.86, 2.35, 1.54, 0.25, 12.5, SAND, True)
    add_text(slide, "primary visit route", 9.86, 2.65, 1.73, 0.18, 9.5, "BFD1D9")
    dossier = [
        ("HEALTH", "No medical evacuation means recorded; traditional first aid"),
        ("WATER + SANITATION", "Well water; open defecation recorded at baseline"),
        ("ENVIRONMENT", "Flood water reported to stagnate for 1–2 weeks"),
        ("ACCESS", "Wooden landing; no mapped marine access point within 5 km"),
        ("COMMUNITY REQUEST", "Water, health, education, power and a jetty"),
    ]
    for i, (a, b) in enumerate(dossier):
        y = 3.51 + i * 0.58
        add_text(slide, a, 5.56, y, 1.72, 0.18, 9.2, TEAL if i < 4 else CORAL, True)
        add_text(slide, b, 7.36, y - 0.03, 4.78, 0.40, 11.5, INK, True)
    add_text(slide, "Baseline conditions show why a practical water intervention matters here.", 5.56, 6.45, 6.56, 0.22, 12, BLUE, True)
    add_footer(slide, "Sources: Blue Lagos field register and baseline responses; spatial context updated September 2026.", 9)
    add_notes(slide, "The platform can move from the State view to a specific community record without losing context.", "Yegunda is one example. Its baseline combines a road-and-water route, no recorded medical evacuation means, well water, open defecation, prolonged flood stagnation and a wooden landing. Its stated priorities included water, health, education, power and a jetty. The point is not that every community is the same, but that each one can be understood on its own evidence.", "The population is a community-reported estimate and is not a borehole beneficiary count. The marine-access statement is based on OSM-mapped points and straight-line proximity.")

    # 10 Delivered action
    slide = prs.slides.add_slide(blank)
    set_background(slide, CREAM)
    add_title(slide, "What Blue Lagos has already done", "We did not stop at collecting data.", None, False, 10)
    # Telemedicine
    add_rect(slide, 0.72, 1.75, 3.72, 4.67, NAVY, None, True)
    add_picture_crop(slide, ASSETS / "engage.jpg", 0.92, 1.95, 3.32, 1.60)
    add_text(slide, "TELEMEDICINE", 1.02, 3.82, 2.98, 0.22, 10, "67D6CF", True)
    add_text(slide, "120", 1.02, 4.18, 1.25, 0.61, 30, WHITE, True, FONT_DISPLAY)
    add_text(slide, "communities", 2.20, 4.35, 1.57, 0.29, 13, WHITE, True)
    add_text(slide, "Telemedicine support facilitated across riverine communities.", 1.02, 5.08, 2.98, 0.75, 14, WHITE, True)
    # Borehole
    placeholder = add_rect(slide, 4.68, 1.75, 3.72, 4.67, PALE_BLUE, BLUE, True)
    placeholder.name = "REPLACE WITH REAL PHOTO - Solar-powered borehole, Yegunda Community, Epe"
    add_rect(slide, 4.91, 1.98, 3.26, 1.57, WHITE, "9CBCC7", True)
    add_text(slide, "INSERT YEGUNDA SOLAR\nBOREHOLE FIELD PHOTO", 5.24, 2.48, 2.60, 0.56, 12, BLUE, True, align=PP_ALIGN.CENTER)
    add_text(slide, "CLEAN WATER", 5.02, 3.82, 2.98, 0.22, 10, GREEN, True)
    add_text(slide, "Yegunda Community, Epe", 5.02, 4.24, 2.98, 0.52, 17, INK, True, FONT_DISPLAY)
    add_text(slide, "Solar-powered borehole donated or facilitated by Blue Lagos.", 5.02, 5.08, 2.98, 0.69, 13.5, INK, True)
    add_text(slide, "No beneficiary count claimed", 5.02, 6.03, 2.98, 0.18, 9.5, MUTED)
    # PVC support
    add_rect(slide, 8.64, 1.75, 3.94, 4.67, WHITE, LINE, True)
    add_picture_crop(slide, ASSETS / "banner.jpg", 8.84, 1.95, 3.54, 1.60)
    add_text(slide, "CIVIC INCLUSION", 8.98, 3.82, 3.08, 0.22, 10, TEAL, True)
    add_text(slide, "PVC registration support", 8.98, 4.22, 3.08, 0.50, 17, INK, True, FONT_DISPLAY)
    add_text(slide, "Facilitated in selected communities to support fuller participation in civic processes.", 8.98, 5.08, 3.08, 0.85, 13.5, INK, True)
    add_rect(slide, 0.72, 6.56, 11.86, 0.38, NAVY, None, True)
    add_text(slide, "The field register is not just for reporting. It can help direct action.", 1.00, 6.65, 11.30, 0.18, 11.5, WHITE, True, align=PP_ALIGN.CENTER)
    add_footer(slide, "Source: Blue Lagos programme records. No telemedicine, borehole or PVC beneficiary count is inferred beyond the stated facts.", 10)
    add_notes(slide, "Blue Lagos has already connected field evidence to health, water and civic-inclusion action.", "We did not stop at collecting data. Blue Lagos facilitated telemedicine support across 120 riverine communities. In Yegunda Community, Epe, we donated or facilitated a solar-powered borehole, and we have also supported PVC registration activities in selected riverine communities so residents can participate more fully in civic processes. These actions show how a community register can help direct practical response.", "No PVC-registration or borehole beneficiary count is claimed. The telemedicine figure is the corrected programme total of 120 communities supplied for this presentation.")

    # 11 Community Map
    slide = prs.slides.add_slide(blank)
    set_background(slide, CREAM)
    add_title(slide, "From fieldwork to the Community Map", "We needed one place to connect all of this evidence.", None, False, 11)
    for i, label in enumerate(["Communities", "Needs", "Access", "Environment", "Planning"]):
        add_chip(slide, label, 0.82 + i * 2.07, 1.64, 1.82, PALE_TEAL if i % 2 == 0 else PALE_BLUE, TEAL if i != 2 else BLUE)
    add_platform_mockup(slide, GEN / "coverage_map.png")
    add_footer(slide, "Blue Lagos Community Map: current application capabilities shown as an editable presentation mockup.", 11)
    add_notes(slide, "The Blue Lagos Community Map organizes the field evidence without becoming the centre of the story.", "After the fieldwork and interventions, we needed one place to connect the evidence. The Blue Lagos Community Map lets us find communities, open individual profiles, see where needs concentrate, compare health and transport context, view environmental evidence and test possible intervention reach. It is an organizing and planning tool built on the community work, not a replacement for it.", "The interface uses the verified register and reviewed spatial layers. Technical implementation details are deliberately left for questions; open-mapping layers remain clearly sourced and are not described as official registries.")

    # 12 Shared service planning
    slide = prs.slides.add_slide(blank)
    set_background(slide, NAVY)
    add_title(slide, "Planning shared services", "Some interventions can serve several communities together.", "Nearby communities with similar needs can be screened around one possible intervention location.", True, 12)
    slide.shapes.add_picture(str(GEN / "service_cluster.png"), Inches(0.72), Inches(2.08), Inches(7.58), Inches(4.58))
    add_rect(slide, 8.62, 2.08, 3.96, 4.58, "0D2D42", "315161", True)
    add_text(slide, "ACTUAL REGISTER SCREEN", 8.96, 2.40, 2.92, 0.21, 9.5, "67D6CF", True)
    add_text(slide, "11", 8.96, 2.85, 1.10, 0.60, 31, SAND, True, FONT_DISPLAY)
    add_text(slide, "communities within 5 km", 10.01, 2.94, 2.02, 0.42, 13, WHITE, True)
    add_text(slide, "75,242", 8.96, 3.87, 2.52, 0.58, 27, "67D6CF", True, FONT_DISPLAY)
    add_text(slide, "community-reported population in the radius", 8.96, 4.49, 2.92, 0.67, 12, WHITE, True)
    add_text(slide, "Candidate point: Ito Agan community location", 8.96, 5.41, 2.95, 0.47, 10.5, "BFD1D9", True)
    add_text(slide, "Planning analysis only. Final sites require land, engineering and government verification.", 8.96, 6.00, 2.95, 0.42, 9.5, CORAL, True)
    add_footer(slide, "Method: 5 km straight-line radius using community coordinates and current register population. No routing or site approval implied.", 12, True)
    add_notes(slide, "Community grouping can help government and partners compare where one intervention may reach several nearby settlements.", "Some interventions do not have to be planned one settlement at a time. This example screens the Ito Agan community location and finds 11 surveyed communities, representing 75,242 people, within a five-kilometre straight-line radius. It helps compare possible shared health, water or emergency-service options before detailed feasibility work begins.", "The calculation uses Haversine straight-line distance and current register population. It excludes land tenure, engineering suitability, capacity, cost, navigability and travel time, so it is not a final site recommendation.")

    # 13 What more can be done
    slide = prs.slides.add_slide(blank)
    set_background(slide, WHITE)
    add_title(slide, "What more can be done", "The next step is to connect evidence directly to service planning.", None, False, 13)
    items = [
        ("HEALTH", "Riverine care\nEmergency points\nTelemedicine reach", CORAL),
        ("WATER", "Safe water points\nSolar boreholes\nSanitation support", OCEAN),
        ("ACCESS", "Jetties + landings\nEmergency transport\nService connections", TEAL),
        ("ENVIRONMENT", "Flood + erosion monitoring\nShoreline exposure\nRestoration targeting", SAND),
        ("LIVELIHOODS", "Fishing + enterprise\nMarket access\nEnergy + digital services", GREEN),
    ]
    for i, (verb, desc, color) in enumerate(items):
        x = 0.72 + i * 2.40
        add_rect(slide, x, 2.07, 2.15, 3.95, CREAM if i % 2 == 0 else PALE_BLUE, None, True)
        add_rect(slide, x, 2.07, 2.15, 0.10, color, None, True)
        add_text(slide, verb, x + 0.18, 2.48, 1.79, 0.27, 11, color, True)
        add_text(slide, desc, x + 0.18, 3.15, 1.79, 1.62, 13.2, INK, True)
        add_text(slide, "Target with evidence", x + 0.18, 5.43, 1.79, 0.28, 10, MUTED, True)
    add_text(slide, "What the evidence can help government, partners and communities target.", 1.17, 6.38, 11.00, 0.30, 15, BLUE, True, align=PP_ALIGN.CENTER)
    add_footer(slide, "Planning opportunities, not Blue Lagos funding commitments or delivery promises.", 13)
    add_notes(slide, "The evidence can help government, partners and communities target practical interventions across five connected areas.", "The next step is to connect evidence directly to service planning. In health, that can mean riverine access, emergency points and telemedicine. In water, safe water points and sanitation. In access, better landings and emergency transport. The same evidence can support environmental monitoring and livelihood access. Blue Lagos is not claiming it will fund all of this; the value is helping the right actors target it.", "These are planning opportunities derived from the recorded needs and platform capabilities, not approved projects, budgets or Blue Lagos delivery commitments.")

    # 14 KOH proposed agenda
    slide = prs.slides.add_slide(blank)
    set_background(slide, CREAM)
    add_title(slide, "Proposed engagement agenda", "KOH Meets Lagos Riverine Communities", "A proposed agenda for His Excellency Dr. Kadri Obafemi Hamzat to engage the evidence, communities and next steps.", False, 14)
    add_rect(slide, 0.72, 2.02, 7.42, 4.62, WHITE, LINE, True)
    add_text(slide, "PROPOSED AGENDA", 1.03, 2.32, 6.72, 0.22, 10, TEAL, True)
    agenda = [
        ("01", "Hear", "What riverine communities are experiencing"),
        ("02", "See", "The register, maps and community-level evidence"),
        ("03", "Review", "Telemedicine, Yegunda water and PVC-support work"),
        ("04", "Select", "One priority cluster and practical pilot intervention"),
        ("05", "Convene", "Relevant MDAs, partners and community leadership"),
        ("06", "Agree", "A clear validation, delivery and follow-up pathway"),
    ]
    for i, (num, verb, body) in enumerate(agenda):
        y = 2.78 + i * 0.58
        add_text(slide, num, 1.04, y, 0.40, 0.22, 10, TEAL, True)
        add_text(slide, verb, 1.57, y - 0.01, 1.02, 0.27, 12.5, INK, True)
        add_text(slide, body, 2.73, y - 0.01, 4.93, 0.31, 11.7, MUTED, True)
    add_picture_crop(slide, ASSETS / "partner_b.jpg", 8.43, 2.02, 4.15, 1.77, name="Blue Lagos partner engagement photograph")
    add_rect(slide, 8.43, 3.98, 4.15, 2.66, NAVY, None, True)
    add_text(slide, "COLLABORATION MODEL", 8.78, 4.30, 3.42, 0.22, 10, "67D6CF", True)
    add_text(slide, "Communities + leaders\nRelevant Lagos State MDAs\nHealth, water + civic partners\nPrivate and social-impact partners\nResearch + spatial/data support", 8.78, 4.76, 3.35, 1.46, 12.5, WHITE, True)
    add_footer(slide, "KOH refers to Dr. Kadri Obafemi Hamzat. This is a proposed engagement agenda, not an organisation or funding programme.", 14)
    add_notes(slide, "KOH Meets Lagos Riverine Communities is a proposed engagement agenda for Dr. Kadri Obafemi Hamzat, not the name of an organisation.", "This proposed agenda creates a practical route from evidence to action. It would allow His Excellency to hear the community realities, see the field register and maps, review the work already facilitated, select one priority pilot, convene the relevant MDAs and partners, and agree a clear follow-up pathway. The intention is a focused engagement that leads to one coordinated next step.", "KOH refers to Dr. Kadri Obafemi Hamzat, Deputy Governor of Lagos State. No separate KOH organisation, funding envelope or programme ownership is claimed.")

    # 15 Close
    slide = prs.slides.add_slide(blank)
    set_background(slide, NAVY)
    add_picture_crop(slide, ASSETS / "banner.jpg", 9.08, 0, 4.25, H, darken=0.08)
    add_rect(slide, 8.98, 0, 0.10, H, TEAL, None)
    add_logo(slide, 0.72, 0.52, 2.0)
    add_text(slide, "Help us turn this evidence into a repeatable\nLagos riverine planning programme.", 0.72, 1.55, 7.80, 1.22, 24, WHITE, True, FONT_DISPLAY)
    asks = [("CONNECT", "Connect Blue Lagos with relevant MDAs and data owners."), ("PILOT", "Select priority communities for one real intervention."), ("SCALE", "Update data and monitor interventions across riverine Lagos.")]
    for i, (a, b) in enumerate(asks):
        x = 0.72 + i * 2.65
        add_rect(slide, x, 3.26, 2.38, 1.35, "0D2D42", "315161", True, 8)
        add_text(slide, a, x + 0.18, 3.50, 1.98, 0.22, 10.5, "67D6CF", True)
        add_text(slide, b, x + 0.18, 3.86, 1.98, 0.58, 11.5, WHITE, True)
    add_rich_text(slide, [("134", 24, True, "67D6CF"), (" communities", 12, True, WHITE), ("   |   ", 12, False, "BFD1D9"), ("502,002", 24, True, WHITE), (" people", 12, True, WHITE), ("   |   ", 12, False, "BFD1D9"), ("120", 24, True, SAND), (" telemedicine communities", 12, True, WHITE)], 0.74, 5.08, 7.90, 0.58)
    add_text(slide, "The goal is simple: make it easier for riverine communities to be seen, understood and served.", 0.74, 5.70, 7.65, 0.47, 12.5, WHITE, True)
    add_text(slide, "Blue Lagos Sustainability Initiative", 0.74, 6.48, 4.7, 0.22, 11.5, "DCE7EA", True)
    add_notes(slide, "The ask is to connect, pilot and scale a repeatable riverine planning programme.", "Your Excellency, our ask is straightforward. Connect Blue Lagos with the relevant MDAs and data owners. Select priority communities or clusters where this approach can support a real intervention. Then help us build a repeatable framework for updating community data and monitoring delivery across riverine Lagos. The goal is simple: make it easier for riverine communities to be seen, understood and served.", "The closing figures are 134 communities enumerated, 502,002 people represented in the register and telemedicine support facilitated for 120 riverine communities. No funding amount is proposed in this deck.")

    # Core properties and validation.
    prs.core_properties.title = "Blue Lagos: From Riverine Communities to Better Decisions"
    prs.core_properties.subject = "Blue Lagos community evidence, interventions and proposed next steps"
    prs.core_properties.author = "Blue Lagos Sustainability Initiative"
    prs.core_properties.keywords = "Blue Lagos, riverine communities, Lagos State, geospatial planning"
    assert len(prs.slides) == 15
    for i, slide in enumerate(prs.slides, 1):
        assert slide.notes_slide.notes_text_frame.text.strip(), f"Slide {i} has no speaker notes"
    prs.save(OUT)
    print(f"Created {OUT} with {len(prs.slides)} slides")
    print(f"Verified: 134 communities; 502,002 population; 93 geolocated")
    print(f"Shared-service illustration: {len(reached)} communities; {reached_population:,} people")


if __name__ == "__main__":
    build()
