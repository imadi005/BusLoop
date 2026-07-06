from pathlib import Path

ROOTS = [
    Path("BusNOW/busnow-user-app"),
    Path("BusNOW/busnow-staff-app"),
]

SUFFIXES = {".jsx", ".js", ".ts", ".tsx", ".css", ".html", ".xml", ".json", ".md"}
SKIP_PARTS = {"node_modules", "dist", "build", ".vercel"}

for root in ROOTS:
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SUFFIXES:
            continue
        if any(part in SKIP_PARTS for part in path.parts):
            continue

        text = path.read_text(encoding="utf-8", errors="ignore")
        updated = text.replace("BusNOW", "BusLoop").replace("BusNow", "BusLoop")
        if updated != text:
            path.write_text(updated, encoding="utf-8")
            print(path)
