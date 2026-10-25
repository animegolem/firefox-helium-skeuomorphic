"""Regression check: drive a running Firefox (started with --marionette
-remote-allow-system-access) through every layout via the Tab Layout menu,
measure the active-tab joint and toolbar geometry, and save screenshots.

    python3 tools/check.py [--port 2931] [--out DIR]

Exit status is non-zero if any check fails, so this can gate CI.
"""
import argparse, base64, json, os, sys, time

sys.path.insert(0, os.path.dirname(__file__))
from mn import M

MEASURE = r"""
const r = e => { if (!e) return null; const b = e.getBoundingClientRect();
  return {l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width}; };
const q = s => document.querySelector(s);
const tabs = q('#tabbrowser-tabs');
const nav = [...q('#nav-bar-customization-target').children]
  .filter(e => e.getBoundingClientRect().width > 0)
  .map(e => ({id: e.id || e.localName, ...r(e)}));
return {
  layout: document.documentElement.getAttribute('hs-layout'),
  orient: tabs.getAttribute('orient'),
  expanded: tabs.hasAttribute('expanded'),
  sel: r(gBrowser.selectedTab.querySelector('.tab-background')),
  tabbox: r(q('#tabbrowser-tabbox')),
  navbar: r(q('#nav-bar')),
  tabstrip: r(q('#TabsToolbar')),
  url: r(q('#urlbar-container')),
  buttonbox: r(q('#TabsToolbar .titlebar-buttonbox-container')),
  nav,
};
"""

PICK = r"""
const [layout] = arguments;
const item = document.querySelector(
  `#view-hs-layout-menu menuitem[hs-value="${layout}"]`);
if (!item) return 'no menu item';
item.doCommand();
return 'ok';
"""


def close(a, b, tol=0.6):
    return a is not None and b is not None and abs(a - b) <= tol


def check(layout, m):
    fails = []
    sel, box = m["sel"], m["tabbox"]
    if m["layout"] != layout:
        fails.append(f"hs-layout is {m['layout']!r}")
    if layout == "vertical":
        if m["orient"] != "vertical":
            fails.append("tabs not vertical")
        if not close(sel["r"], box["l"]):
            fails.append(f"active tab right {sel['r']} != page left {box['l']}")
    else:
        if m["orient"] != "horizontal":
            fails.append("tabs not horizontal")
        below = box["t"] if layout == "compact" else m["navbar"]["t"]
        if not close(sel["b"], below):
            fails.append(f"active tab bottom {sel['b']} != {below}")
    if layout == "compact":
        strip, url = m["tabstrip"], m["url"]
        if not close(m["navbar"]["t"], strip["t"]) or not close(m["navbar"]["b"], strip["b"]):
            fails.append("tab strip not on the nav bar row")
        if sel["w"] < 60 or sel["l"] < strip["l"] - 0.6 or sel["r"] > strip["r"] + 0.6:
            fails.append(f"active tab not fully visible in the strip ({sel['l']}-{sel['r']} in {strip['l']}-{strip['r']})")
        if strip["w"] < 0.4 * m["navbar"]["w"]:
            fails.append(f"tab strip only {strip['w']}px wide")
        if url and strip["l"] < url["r"] - 0.6:
            fails.append(f"tab strip starts {strip['l']} inside url field (ends {url['r']})")
        after = [n for n in m["nav"] if n["l"] >= strip["l"] and n["id"] != "urlbar-container"
                 and not n["id"].startswith("customizableui-special-spring")]
        if after and strip["r"] > min(n["l"] for n in after) + 0.6:
            fails.append("tab strip overlaps toolbar buttons")
    # no two visible nav-bar items may overlap (the squeeze bug)
    items = sorted(m["nav"], key=lambda n: n["l"])
    for a, b in zip(items, items[1:]):
        if a["r"] > b["l"] + 0.6:
            fails.append(f"nav items overlap: {a['id']} / {b['id']}")
    return fails


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=2931)
    ap.add_argument("--out", default="/tmp/hs-check")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    mn = M(args.port)
    mn.cmd("WebDriver:NewSession", {"capabilities": {}})
    mn.cmd("Marionette:SetContext", {"value": "chrome"})

    failed = False
    results = {}
    for layout in ("classic", "compact", "vertical"):
        res = mn.js(PICK, [layout])
        if res != "ok":
            print(f"{layout}: FAIL ({res})")
            failed = True
            continue
        time.sleep(1.5)
        m = mn.js(MEASURE)
        fails = check(layout, m)
        shot = mn.cmd("WebDriver:TakeScreenshot", {"full": False})["value"]
        path = os.path.join(args.out, f"{layout}.png")
        with open(path, "wb") as f:
            f.write(base64.b64decode(shot))
        with open(os.path.join(args.out, f"{layout}.json"), "w") as f:
            json.dump(m, f, indent=1)
        print(f"{layout}: {'ok' if not fails else 'FAIL'}  ({path})")
        for msg in fails:
            print("   -", msg)
        failed |= bool(fails)
        results[layout] = m

    # The toolbar buttons after the url field must not migrate between
    # layouts: same order, same distance from the window's right edge.
    def corner(m):
        url = next((n for n in m["nav"] if n["id"] == "urlbar-container"), None)
        return [(n["id"], round(m["navbar"]["r"] - n["l"], 1)) for n in m["nav"]
                if url and n["l"] >= url["r"] and not n["id"].startswith("customizableui-special-spring")]
    base = corner(results.get("vertical", {"nav": [], "navbar": {}})) if "vertical" in results else []
    for layout in ("classic", "compact"):
        if layout in results and base and corner(results[layout]) != base:
            print(f"controls moved in {layout}: {corner(results[layout])} vs vertical {base}")
            failed = True
    if base:
        print(f"controls pinned to the right edge in every layout: {[i for i, _ in base]}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
