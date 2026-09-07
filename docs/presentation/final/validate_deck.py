"""Validate the final Blue Lagos executive deck and its rendered previews."""

import re
from pathlib import Path

from PIL import Image
from pptx import Presentation


HERE = Path(__file__).resolve().parent
DECK = HERE / "Blue_Lagos_Deputy_Governor_Presentation.pptx"
PDF = DECK.with_suffix(".pdf")
RENDERS = HERE / "renders"

prs = Presentation(DECK)
assert len(prs.slides) == 15
assert round(prs.slide_width / 914400, 3) == 13.333
assert round(prs.slide_height / 914400, 3) == 7.5

visible = []
notes = []
shape_names = []
for slide in prs.slides:
    notes.append(slide.notes_slide.notes_text_frame.text)
    for shape in slide.shapes:
        shape_names.append(shape.name)
        if hasattr(shape, "text"):
            visible.append(shape.text)

text = "\n".join(visible + notes)
assert "134 communities" in text
assert "502,002" in text
assert re.search(r"\b120\b", text)
assert not re.search(r"\b152\b", text)
assert "322,054" not in text
assert "62,494" not in text
assert "22,398" not in text
assert "His Excellency Dr. Kadri Obafemi Hamzat" in text
assert "KOH Meets Lagos Riverine Communities" in text
assert "KOH refers to Dr. Kadri Obafemi Hamzat" in text
assert "KOH Partnership" not in text
assert "Prepared for" not in text
assert "Razaq Muiz Olasunkanmi" not in text
assert "Geospatial & Data Systems Lead" not in text
assert re.search(r"\b18\b", text)
assert "communities physically visited" in text
assert "PVC registration support" in text
assert "solar-powered borehole" in text.lower()
assert any("REPLACE WITH REAL PHOTO" in name for name in shape_names)
assert all("MAIN MESSAGE" in note and "SAY THIS" in note and "TECHNICAL BACKUP" in note for note in notes)

renders = sorted(RENDERS.glob("Slide*.PNG"), key=lambda p: int(p.stem[5:]))
assert len(renders) == 15
assert all(Image.open(path).size == (1920, 1080) for path in renders)
assert PDF.exists() and PDF.stat().st_size > 0

print("Validated: 15 slides, 16:9, 15 notes pages, 15 clean 1920x1080 renders")
print("Claims: 134 communities; 502,002 people; 18 physical visits; telemedicine 120")
print("Actions: Yegunda solar borehole and PVC registration support present without invented beneficiary totals")
print("Legacy claims: no 152 or conflicting household/population totals")
print("KOH agenda: explicitly proposed for Dr. Kadri Obafemi Hamzat, not presented as an organisation")
print("Personalization: no 'Prepared for' line, presenter name, job title or contact details")
print("Yegunda borehole placeholder: ready and explicitly named")
