"""
Render the Blue Lagos briefing deck.

`deck.tpl.html` carries the slides with `{{img:name}}` placeholders; the
photographs live in `assets/` and are inlined as data URIs at build time, so the
published deck is a single self-contained file with no external image requests.

    python docs/presentation/build.py            # -> docs/presentation/deck.html

Photographs were extracted from the Blue Lagos Community Baseline Report
(August 2026) and resized for screen; the report itself is the source of record.
"""

import base64
import re
from pathlib import Path

HERE = Path(__file__).parent


def main() -> None:
    template = (HERE / "deck.tpl.html").read_text(encoding="utf8")
    out = template
    for key in sorted(set(re.findall(r"\{\{img:([a-z_]+)\}\}", template))):
        image = HERE / "assets" / f"{key}.jpg"
        if not image.exists():
            raise SystemExit(f"missing photograph: {image}")
        encoded = base64.b64encode(image.read_bytes()).decode()
        out = out.replace(f"{{{{img:{key}}}}}", f"data:image/jpeg;base64,{encoded}")
    if "{{img:" in out:
        raise SystemExit("unresolved image placeholder remains")
    target = HERE / "deck.html"
    target.write_text(out, encoding="utf8")
    slides = out.count('<section class="slide"')
    print(f"{target} - {len(out) / 1048576:.2f} MB, {slides} slides")


if __name__ == "__main__":
    main()
