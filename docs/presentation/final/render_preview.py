"""Create a raster PDF preview and contact sheets from PowerPoint PNG renders."""

from pathlib import Path

from PIL import Image, ImageDraw, JpegImagePlugin  # noqa: F401


HERE = Path(__file__).resolve().parent
RENDERS = HERE / "renders"
PDF = HERE / "Blue_Lagos_Deputy_Governor_Presentation.pdf"


def slide_number(path: Path) -> int:
    return int(path.stem.removeprefix("Slide"))


slides = sorted(RENDERS.glob("Slide*.PNG"), key=slide_number)
if len(slides) != 15:
    raise SystemExit(f"Expected 15 slide renders, found {len(slides)}")

images = [Image.open(path).convert("RGB") for path in slides]
images[0].save(PDF, save_all=True, append_images=images[1:], resolution=144.0)

thumb_w, thumb_h = 640, 360
for page_index in range(2):
    subset = images[page_index * 8 : (page_index + 1) * 8]
    sheet = Image.new("RGB", (thumb_w * 2 + 72, thumb_h * 4 + 120), "#d9dedf")
    draw = ImageDraw.Draw(sheet)
    for i, image in enumerate(subset):
        slide_idx = page_index * 8 + i + 1
        col, row = i % 2, i // 2
        x, y = 24 + col * (thumb_w + 24), 42 + row * (thumb_h + 26)
        thumb = image.copy()
        thumb.thumbnail((thumb_w, thumb_h))
        sheet.paste(thumb, (x, y))
        draw.text((x, y - 24), f"Slide {slide_idx}", fill="#132a38")
    sheet.save(HERE / f"contact_sheet_{page_index + 1}.jpg", quality=92)

print(f"Created {PDF}")
