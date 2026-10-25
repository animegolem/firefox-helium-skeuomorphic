"""Print the Helium palette this theme uses.

Helium (Chromium) derives its colors from a seed color through Material's
dynamic color. The Helium profile this theme copies uses seed #888888 with
the "Neutral" variant, dark mode. This prints the tones the theme takes.

    pip install materialyoucolor
    python3 tools/palette.py
"""
from materialyoucolor.hct import Hct
from materialyoucolor.scheme.scheme_neutral import SchemeNeutral

SEED = 0xFF888888


def hexstr(argb):
    return "#%06x" % (argb & 0xFFFFFF)


scheme = SchemeNeutral(Hct.from_int(SEED), True, 0.0)
primary, neutral = scheme.primary_palette, scheme.neutral_palette

rows = [
    ("--hs-frame", primary, 12, "window frame, sidebar"),
    ("--hs-popup", primary, 17, "open url dropdown"),
    ("--hs-press", primary, 30, "pressed buttons, lines"),
    ("--hs-icon", primary, 80, "toolbar icons"),
    ("--hs-dim", neutral, 80, "secondary text"),
    ("--hs-text", neutral, 90, "text"),
]
seed = Hct.from_int(SEED)
print(f"seed #888888: hue {seed.hue:.1f}, chroma {seed.chroma:.2f}")
for var, palette, tone, use in rows:
    name = "primary" if palette is primary else "neutral"
    print(f"{var:12} {hexstr(palette.tone(tone))}  {name} T{tone:<3} {use}")
print("--hs-sheet   #2e3839  omnibox as Helium paints it: drawn at 80% "
      "over the frame (read from a Helium screenshot)")
