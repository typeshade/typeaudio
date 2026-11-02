# Derives the icon files from assets/icon.png, the owner's original:
#   assets/icon-transparent.png  the rounded square alone, on a transparent ground, padded to a square
#   assets/icon-512.png, icon-256.png, icon-64.png  the same, resized
# Usage: python3 scripts/derive-icon.py assets/icon.png assets
# The rounded square is found as the pixels whose darkest channel is under 200; its corner radius is
# fitted from the edge insets near a corner; the mask is drawn at 4x and box-filtered; the edge pixels
# are un-blended from the white ground. Needs Pillow.
import sys
from PIL import Image, ImageDraw
src, outdir = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
w, h = im.size
px = im.load()
# 1. The rounded square: every pixel whose darkest channel is under 200 (the ground and its shadow are near white).
def dark(x, y):
    r, g, b = px[x, y]
    return min(r, g, b) < 200
cols = [x for x in range(w) if any(dark(x, y) for y in range(0, h, 4))]
rows = [y for y in range(h) if any(dark(x, y) for x in range(0, w, 4))]
left, right, top, bottom = min(cols), max(cols), min(rows), max(rows)
# 2. The corner radius: the inset of the first dark pixel on the top row and on the left column, at each corner.
def first(seq):
    for v in seq:
        if v is not None: return v
ests = []
ests.append(first(x - left for x in range(left, right + 1) if dark(x, top)))
ests.append(first(right - x for x in range(right, left - 1, -1) if dark(x, top)))
ests.append(first(x - left for x in range(left, right + 1) if dark(x, bottom)))
ests.append(first(right - x for x in range(right, left - 1, -1) if dark(x, bottom)))
ests.append(first(y - top for y in range(top, bottom + 1) if dark(left, y)))
ests.append(first(bottom - y for y in range(bottom, top - 1, -1) if dark(left, y)))
ests.append(first(y - top for y in range(top, bottom + 1) if dark(right, y)))
ests.append(first(bottom - y for y in range(bottom, top - 1, -1) if dark(right, y)))
ests = [e for e in ests if e is not None]
r = sum(ests) / len(ests)
# A rounded corner of radius r meets its edge r pixels in; the first dark pixel on the edge row sits about
# r*(1 - cos(45deg)) further in than the tangent point when the row clips the arc; so this is a lower bound and
# the mask is refined by the rows near the corner below.
import math
# Refine: fit r so that the arc passes through the measured edge insets (inset at the top row = r - sqrt(r^2 - (r-0.5)^2) ~ small),
# use the row at top + k for several k and solve r from inset(k) = r - sqrt(r^2 - (r - k)^2) = r - sqrt(2 r k - k^2).
fits = []
for k in (10, 20, 40, 80):
    y = top + k
    inset = first(x - left for x in range(left, right + 1) if dark(x, y))
    # inset = r - sqrt(2rk - k^2)  ->  (r - inset)^2 = 2rk - k^2  ->  r^2 - 2r(inset + k) + inset^2 + k^2 = 0
    a, b, c = 1.0, -2.0 * (inset + k), inset * inset + k * k
    disc = b * b - 4 * a * c
    if disc >= 0:
        fits.append((-b + math.sqrt(disc)) / 2)
r_fit = sum(fits) / len(fits) if fits else r
print(f'bbox left={left} top={top} right={right} bottom={bottom} size={right-left+1}x{bottom-top+1}')
print(f'radius: edge estimate {r:.1f}, fitted {r_fit:.1f} from {["%.1f" % f for f in fits]}')
R = r_fit
# 3. The alpha mask at 4x, downsampled.
S = 4
mask = Image.new('L', (w * S, h * S), 0)
d = ImageDraw.Draw(mask)
d.rounded_rectangle([left * S, top * S, (right + 1) * S - 1, (bottom + 1) * S - 1], radius=R * S, fill=255)
alpha = mask.resize((w, h), Image.BOX)
# 4. Un-blend the edge pixels from the white ground, then compose.
out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
op = out.load(); ap = alpha.load()
edge = 0
for y in range(top - 2, bottom + 3):
    for x in range(left - 2, right + 3):
        if not (0 <= x < w and 0 <= y < h): continue
        a = ap[x, y]
        if a == 0: continue
        r_, g_, b_ = px[x, y]
        if a < 255:
            edge += 1
            f = a / 255.0
            r_ = min(255, max(0, round((r_ - (1 - f) * 255) / f)))
            g_ = min(255, max(0, round((g_ - (1 - f) * 255) / f)))
            b_ = min(255, max(0, round((b_ - (1 - f) * 255) / f)))
        op[x, y] = (r_, g_, b_, a)
print('edge pixels un-blended:', edge)
tight = out.crop((left, top, right + 1, bottom + 1))
tw, th = tight.size
side = max(tw, th)
square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
square.paste(tight, ((side - tw) // 2, (side - th) // 2))
square.save(f'{outdir}/icon-transparent.png', optimize=True)
for n in (512, 256, 64):
    square.resize((n, n), Image.LANCZOS).save(f'{outdir}/icon-{n}.png', optimize=True)
q = square.load()
print('tight size', (tw, th), 'square side', side, 'corners alpha',
      [q[0, 0][3], q[side - 1, 0][3], q[0, side - 1][3], q[side - 1, side - 1][3]], 'center', q[side // 2, side // 2])
