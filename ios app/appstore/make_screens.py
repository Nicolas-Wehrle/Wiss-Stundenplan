#!/usr/bin/env python3
"""
App Store screenshots for WISS Stundenplan.

Builds every slide from the real simulator captures in appstore/raw/ (demo account), so the
set can be rebuilt any time the app changes:

    python3 appstore/make_screens.py            # German set  -> appstore/screenshots/de/
    python3 appstore/make_screens.py --lang en  # English set -> appstore/screenshots/en/ (needs raw/en/*)

Slides are laid out at 1320 x 2868 and saved at 1206 x 2622 px (OUT_SIZE).
Also builds the wide header image appstore/screenshots/header.png (5244 x 2950).
Look: dark background with the app's accent glow, small kicker line, two-line headline
(second line in accent), short subline, iPhone with the real screen, and one card from the
screen enlarged so it "pops out" of the phone.
"""
import argparse
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
W, H = 1320, 2868
OUT_SIZE = (1206, 2622)

BG_TOP = (20, 19, 25)
BG_BOTTOM = (10, 10, 13)
ACCENT = (255, 77, 99)          # Standard style accent (#FF4D63)
WHITE = (255, 255, 255)
GREY = (168, 170, 182)

SF = "/System/Library/Fonts/SFNS.ttf"


def font(size, weight="Bold"):
    f = ImageFont.truetype(SF, size)
    f.set_variation_by_name(weight)
    return f


# ---------------------------------------------------------------- text helpers
def text_w(s, f, track=0):
    return sum(f.getlength(c) for c in s) + track * (len(s) - 1)


def draw_text(d, s, f, cy_top, fill, track=0, width=None):
    """centered, manual tracking"""
    x = ((width or W) - text_w(s, f, track)) / 2
    for c in s:
        d.text((x, cy_top), c, font=f, fill=fill)
        x += f.getlength(c) + track


# ---------------------------------------------------------------- background
def background():
    bg = Image.new("RGB", (W, H))
    px = bg.load()
    for y in range(H):
        t = y / H
        c = tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3))
        for x in range(W):
            px[x, y] = c
    # accent glow behind the phone, strongest at the sides (like a light behind the device)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((-380, 1050, 420, 2250), fill=ACCENT + (95,))
    g.ellipse((900, 1050, 1700, 2250), fill=ACCENT + (95,))
    g.ellipse((260, 820, 1060, 1300), fill=ACCENT + (28,))
    glow = glow.filter(ImageFilter.GaussianBlur(220))
    bg = Image.alpha_composite(bg.convert("RGBA"), glow)
    return bg


# ---------------------------------------------------------------- screen prep
def load(name):
    return Image.open(os.path.join(RAW, name)).convert("RGB")


def cut_banner(im, y0, y1, probe_x=60):
    """Remove the 'Demokonto' strip: the first non-background run inside [y0, y1]
    plus the gap after it, so the content below moves up into its place."""
    px = im.load()
    bg = px[probe_x, y0]
    same = lambda a, b: sum(abs(a[i] - b[i]) for i in range(3)) < 12
    y = y0
    while y < y1 and same(px[probe_x, y], bg):
        y += 1
    start = y
    while y < y1 and not same(px[probe_x, y], bg):
        y += 1
    while y < y1 and same(px[probe_x, y], bg):
        y += 1
    end = y
    top = im.crop((0, 0, im.width, start))
    rest = im.crop((0, end, im.width, im.height))
    out = Image.new("RGB", im.size, bg)
    out.paste(top, (0, 0))
    out.paste(rest, (0, start))
    return out, start, end - start


def card_at(im, y_inside, x=None):
    """Bounds of the card that contains row y_inside: walk up/down the column just inside the
    card's left edge until the page background shows. Returns (x0, y0, x1, y1)."""
    px = im.load()
    x = x if x is not None else pt(22)
    bg = px[pt(5), y_inside]
    diff = lambda a: sum(abs(a[i] - bg[i]) for i in range(3))
    y0 = y_inside
    while y0 > 0 and diff(px[x, y0 - 1]) > 6:
        y0 -= 1
    y1 = y_inside
    while y1 < im.height - 1 and diff(px[x, y1 + 1]) > 6:
        y1 += 1
    return (pt(13), y0 - 4, im.width - pt(13), y1 + 5)


def lock_fix(im):
    """Lock screen capture: the simulator shows 'Sat 1. Jan' and 'Carrier' whatever the status bar
    override says. Paint them out (column-wise blend of the wallpaper above/below) and set the
    real date in the system style."""
    im = im.copy()
    px = im.load()

    def fill_v(x0, x1, y0, y1):
        for x in range(x0, x1):
            a, b = px[x, y0 - 1], px[x, y1 + 1]
            for y in range(y0, y1 + 1):
                t = (y - y0) / max(1, y1 - y0)
                px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

    fill_v(pt(135), pt(268), pt(82), pt(111))       # date
    fill_v(pt(40), pt(108), pt(24), pt(44))         # carrier
    fill_v(pt(314), pt(378), pt(42), pt(88))        # lock-screen toggle icon
    fill_v(pt(120), pt(282), pt(806), pt(834))      # "Swipe up to open"
    d = ImageDraw.Draw(im)
    f = font(pt(21), "Semibold")
    s = "Donnerstag, 19. November"
    d.text(((im.width - f.getlength(s)) / 2, pt(85)), s, font=f, fill=(176, 200, 255))
    return im


def cut_rows(im, y0, y1):
    """Remove rows [y0, y1) (for styles with a patterned/gradient page where cut_banner can't probe)."""
    px = im.load()
    out = Image.new("RGB", im.size, px[pt(5), y0 - 2])
    out.paste(im.crop((0, 0, im.width, y0)), (0, 0))
    out.paste(im.crop((0, y1, im.width, im.height)), (0, y0))
    return out


def bottom_fade(canvas, h=460):
    """Phone sinks into the background at the bottom edge."""
    f = Image.new("RGBA", (W, h))
    for y in range(h):
        a = int(255 * (y / h) ** 1.6)
        ImageDraw.Draw(f).line((0, y, W, y), fill=BG_BOTTOM + (a,))
    canvas.alpha_composite(f, (0, H - h))


def rounded_mask(size, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), r, fill=255)
    return m


# ---------------------------------------------------------------- phone
PHONE_W = 1010
BEZEL = 24
BODY_R = 168
SCREEN_R = BODY_R - BEZEL


def phone(screen, width=PHONE_W):
    """iPhone body with the screen inside. Returns RGBA."""
    k = width / PHONE_W
    bez, br, sr = int(BEZEL * k), int(BODY_R * k), int(SCREEN_R * k)
    sw = width - 2 * bez
    sh = round(screen.height * sw / screen.width)
    scr = screen.resize((sw, sh), Image.LANCZOS)
    ph_h = sh + 2 * bez
    body = Image.new("RGBA", (width, ph_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    d.rounded_rectangle((0, 0, width - 1, ph_h - 1), br, fill=(58, 60, 68, 255))           # titanium edge
    d.rounded_rectangle((int(5 * k), int(5 * k), width - 1 - int(5 * k), ph_h - 1 - int(5 * k)),
                        br - int(5 * k), fill=(16, 16, 19, 255))                            # black bezel
    body.paste(scr, (bez, bez), rounded_mask((sw, sh), sr))
    # side buttons
    for (y, h) in ((0.16, 0.035), (0.215, 0.06), (0.29, 0.06)):
        d.rounded_rectangle((-2, int(ph_h * y), int(6 * k), int(ph_h * (y + h))), 3, fill=(58, 60, 68, 255))
    d.rounded_rectangle((width - int(6 * k), int(ph_h * 0.24), width + 2, int(ph_h * 0.33)), 3, fill=(58, 60, 68, 255))
    return body, bez, sw / screen.width


def shadow(img, blur=50, alpha=170, offset=(0, 30)):
    a = img.split()[-1].point(lambda v: v * alpha // 255)
    sh = Image.new("RGBA", (img.width + 4 * blur, img.height + 4 * blur), (0, 0, 0, 0))
    black = Image.new("RGBA", img.size, (0, 0, 0, 255))
    sh.paste(black, (2 * blur + offset[0], 2 * blur + offset[1]), a)
    return sh.filter(ImageFilter.GaussianBlur(blur)), 2 * blur


def paste_with_shadow(canvas, img, x, y, **kw):
    s, pad = shadow(img, **kw)
    canvas.alpha_composite(s, (int(x - pad), int(y - pad)))
    canvas.alpha_composite(img, (int(x), int(y)))


def card(screen, box, radius, scale_to):
    """Cut a card out of the screen, enlarge it to `scale_to` px wide, keep rounded corners."""
    c = screen.crop(box)
    k = scale_to / c.width
    c = c.resize((scale_to, round(c.height * k)), Image.LANCZOS).convert("RGBA")
    c.putalpha(rounded_mask(c.size, int(radius * k)))
    return c


# ---------------------------------------------------------------- slide
HEAD_SIZE = 150
PHONE_TOP = 840


def header(canvas, kicker, line1, line2, sub):
    d = ImageDraw.Draw(canvas)
    draw_text(d, kicker, font(44, "Bold"), 190, ACCENT, track=7)
    hf = font(HEAD_SIZE, "Heavy")
    draw_text(d, line1, hf, 268, WHITE, track=-3)
    draw_text(d, line2, hf, 268 + int(HEAD_SIZE * 1.08), ACCENT, track=-3)
    sf = font(50, "Regular")
    # subline: wrap to 2 lines if needed
    words, lines, cur = sub.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if text_w(t, sf) > W - 160 and cur:
            lines.append(cur)
            cur = w_
        else:
            cur = t
    lines.append(cur)
    y = 268 + int(HEAD_SIZE * 2.16) + 34
    for ln in lines:
        draw_text(d, ln, sf, y, GREY)
        y += 64
    return y


def slide_phone(spec):
    canvas = background()
    header(canvas, *spec["text"])
    scr = spec["screen"]
    body, bez, k = phone(scr)
    px_ = (W - body.width) // 2
    paste_with_shadow(canvas, body, px_, PHONE_TOP, blur=60, alpha=200, offset=(0, 40))
    if spec.get("card"):
        box, radius = spec["card"]
        cw = spec.get("card_w", 1180)
        c = card(scr, box, radius, cw)
        # same vertical centre as on the phone screen
        cy = PHONE_TOP + bez + (box[1] + box[3]) / 2 * k
        paste_with_shadow(canvas, c, (W - c.width) / 2, cy - c.height / 2, blur=40, alpha=190, offset=(0, 34))
    return canvas


# ---------------------------------------------------------------- the set
def pt(v):            # simulator points -> screenshot px (iPhone 17 Pro, @3x)
    return int(round(v * 3))


def build_de():
    sl = []

    # 1 · week — "now" card pops out
    woche, s, _ = cut_banner(load("s-woche.png"), 460, 760)
    sl.append(("01-woche", slide_phone({
        "text": ("DEIN STUNDENPLAN", "Jede Lektion.", "Sofort im Blick.",
                 "Raum, Lehrperson und was als Nächstes kommt."),
        "screen": woche,
        "card": (card_at(woche, s + pt(40)), pt(16)),
    })))

    # 2 · widgets — lock screen + home widget as floating cards
    sl.append(("02-widgets", slide_widgets(
        ("WIDGETS", "Ein Blick.", "Kein Öffnen.",
         "Die nächste Lektion auf dem Home- und Sperrbildschirm."))))

    # 3 · exams — "next exam" card
    pr, s, _ = cut_banner(load("s-pruefungen.png"), 460, 760)
    sl.append(("03-pruefungen", slide_phone({
        "text": ("PRÜFUNGEN", "Keine Prüfung", "verpasst.",
                 "Countdown bis zur nächsten Prüfung, alle Termine mit Zeit und Raum."),
        "screen": pr,
        "card": (card_at(pr, s + pt(40)), pt(16)),
    })))

    # 4 · grades — chart with the tooltip
    no, s, _ = cut_banner(load("s-noten-tip.png"), 460, 760)
    sl.append(("04-noten", slide_phone({
        "text": ("NOTEN", "Dein Schnitt.", "Jederzeit klar.",
                 "Verlauf, Bestnote und jede Modulnote auf einen Blick."),
        "screen": no,
        "card": (card_at(no, s + pt(225)), pt(16)),
    })))

    # 5 · absences — "excuse now" card
    ab, s, _ = cut_banner(load("s-absenzen.png"), 460, 760)
    sl.append(("05-absenzen", slide_phone({
        "text": ("ABSENZEN", "Absenzen", "im Griff.",
                 "Offene Absenzen, Fristen und Anwesenheit – mit Erinnerung."),
        "screen": ab,
        "card": (card_at(ab, s + pt(78)), pt(16)),
    })))

    # 6 · rooms — "free at 14:30"
    ra, s, _ = cut_banner(load("s-raeume.png"), 460, 760)
    sl.append(("06-raeume", slide_phone({
        "text": ("FREIE RÄUME", "Freies Zimmer?", "Sofort gefunden.",
                 "Sieh, welche Räume jetzt oder später frei sind."),
        "screen": ra,
        "card": (card_at(ra, s + pt(256)), pt(16)),
    })))

    # 7 · styles — three phones
    sl.append(("07-stile", slide_styles(
        ("DEIN STIL", "9 Stile.", "Ganz deiner.",
         "Standard, Apple, Nothing, GitHub und mehr – hell oder dunkel, in deiner Farbe."))))
    return sl


def slide_widgets(text):
    """Phone with the lock screen widgets, the home-screen widget pops out over the wallpaper."""
    canvas = background()
    header(canvas, *text)
    lock = lock_fix(load("lock.png"))
    body, bez, k = phone(lock)
    paste_with_shadow(canvas, body, (W - body.width) // 2, PHONE_TOP, blur=60, alpha=200, offset=(0, 40))
    home = load("home2.png")
    c = card(home, (pt(27), pt(291), pt(376), pt(455)), pt(26), 1160)
    cy = PHONE_TOP + bez + pt(430) * k
    paste_with_shadow(canvas, c, (W - c.width) / 2, cy - c.height / 2, blur=44, alpha=200, offset=(0, 34))
    return canvas


def slide_styles(text):
    canvas = background()
    header(canvas, *text)
    shots = [
        cut_rows(load("woche-apple.png"), 402, 585),
        cut_banner(load("s-woche.png"), 460, 760)[0],
        cut_rows(load("woche-nothing.png"), 516, 720),
    ]
    pw = 720
    side = []
    for i, ang, dx, dy in ((0, 8, -360, 1000), (2, -8, 360, 1000)):
        b, _, _ = phone(shots[i], pw)
        r = b.rotate(ang, resample=Image.BICUBIC, expand=True)
        side.append((r, dx, dy))
    for r, dx, dy in side:
        paste_with_shadow(canvas, r, (W - r.width) / 2 + dx, dy, blur=50, alpha=200, offset=(0, 30))
    b, _, _ = phone(shots[1], 800)
    paste_with_shadow(canvas, b, (W - b.width) / 2, 900, blur=60, alpha=220, offset=(0, 40))
    # style names under the phones
    return canvas


def make_header():
    """Wide header 5244 x 2950: app icon + name, big headline, five phones fanned out at the bottom."""
    HW, HH = 5244, 2950
    bg = Image.new("RGB", (HW, HH))
    d = ImageDraw.Draw(bg)
    for y in range(HH):
        t = y / HH
        d.line((0, y, HW, y), fill=tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3)))
    glow = Image.new("RGBA", (HW, HH), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((900, 1500, 4344, 3600), fill=ACCENT + (90,))
    g.ellipse((1700, 300, 3544, 1500), fill=ACCENT + (26,))
    glow = glow.filter(ImageFilter.GaussianBlur(420))
    canvas = Image.alpha_composite(bg.convert("RGBA"), glow)
    d = ImageDraw.Draw(canvas)

    # icon + name
    icon = Image.open(os.path.join(HERE, "..", "Wiss_Stundenplan", "Assets.xcassets", "AppIcon.appiconset",
                                   "AppIcon.png")).convert("RGBA").resize((230, 230), Image.LANCZOS)
    icon.putalpha(rounded_mask(icon.size, 52))
    nf = font(124, "Heavy")
    name = "WISS STUNDENPLAN"
    nw = text_w(name, nf, 22)
    gx = (HW - (230 + 60 + nw)) / 2
    paste_with_shadow(canvas, icon, gx, 210, blur=30, alpha=160, offset=(0, 14))
    x = gx + 230 + 60
    for c in name:
        d.text((x, 252), c, font=nf, fill=WHITE)
        x += nf.getlength(c) + 22

    # headline
    hf = font(400, "Heavy")
    draw_text(d, "Dein Schulalltag.", hf, 540, WHITE, track=-8, width=HW)
    draw_text(d, "Auf einen Blick.", hf, 980, ACCENT, track=-8, width=HW)

    # phones: Prüfungen, Noten, Woche (centre), Absenzen, Räume
    shots = [cut_banner(load(n), 460, 760)[0] for n in
             ("s-pruefungen.png", "s-noten-tip.png", "s-woche.png", "s-absenzen.png", "s-raeume.png")]
    layout = [(0, 920, 11, -2020, 2020), (4, 920, -11, 2020, 2020),
              (1, 1040, 5, -1080, 1760), (3, 1040, -5, 1080, 1760),
              (2, 1180, 0, 0, 1580)]
    for i, w_, ang, dx, y in layout:
        b, _, _ = phone(shots[i], w_)
        if ang:
            b = b.rotate(ang, resample=Image.BICUBIC, expand=True)
        paste_with_shadow(canvas, b, (HW - b.width) / 2 + dx, y, blur=80, alpha=210, offset=(0, 50))

    f = Image.new("RGBA", (HW, 520))
    fd = ImageDraw.Draw(f)
    for y in range(520):
        fd.line((0, y, HW, y), fill=BG_BOTTOM + (int(255 * (y / 520) ** 1.6),))
    canvas.alpha_composite(f, (0, HH - 520))
    return canvas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="de")
    a = ap.parse_args()
    out = os.path.join(HERE, "screenshots", a.lang)
    os.makedirs(out, exist_ok=True)
    for name, img in build_de():
        bottom_fade(img)
        p = os.path.join(out, name + ".png")
        img = img.convert("RGB").resize(OUT_SIZE, Image.LANCZOS)
        img.save(p, optimize=True)
        print(p, img.size)
    p = os.path.join(HERE, "screenshots", "header.png")
    make_header().convert("RGB").save(p, optimize=True)
    print(p)


if __name__ == "__main__":
    main()
