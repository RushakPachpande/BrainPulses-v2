from pathlib import Path

p = Path(r"d:\Code\BrainPulses v2.0\participant\src\App.handoff.tsx")
t = p.read_text(encoding="utf-8")
old_btn = (
    '<button className="icon-btn" aria-label="Notifications" '
    "onClick={() => setToast('You are all caught up.')}><Bell size={18} /></button>"
)
old_import = "Bell, "
if old_btn not in t:
    raise SystemExit("button not found")
if old_import not in t:
    raise SystemExit("import not found")
t = t.replace(old_btn, "", 1).replace(old_import, "", 1)
p.write_text(t, encoding="utf-8")
print("ok")
