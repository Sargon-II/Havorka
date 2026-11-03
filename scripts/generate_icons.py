import os
import cairosvg
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUBLIC_DIR = os.path.join(ROOT, "public")
RES_DIR = os.path.join(ROOT, "android", "app", "src", "main", "res")

SRC_SVG = os.path.join(PUBLIC_DIR, "icon.svg")

# 1. Generate PWA PNGs
print("Generating public/icon-192.png and public/icon-512.png...")
cairosvg.svg2png(url=SRC_SVG, write_to=os.path.join(PUBLIC_DIR, "icon-192.png"), output_width=192, output_height=192)
cairosvg.svg2png(url=SRC_SVG, write_to=os.path.join(PUBLIC_DIR, "icon-512.png"), output_width=512, output_height=512)

# 2. Generate Favicon
print("Generating public/favicon.ico...")
img512 = Image.open(os.path.join(PUBLIC_DIR, "icon-512.png")).convert("RGBA")
img512.save(
    os.path.join(PUBLIC_DIR, "favicon.ico"),
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)]
)

# 3. Build foreground SVG without background rect, scaled to 66% safe zone circle
FOREGROUND_SVG_CONTENT = """<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <g transform="translate(256, 256) scale(0.72) translate(-256, -264)">
    <!-- Back conversation bubble -->
    <path d="M116 115h214c35 0 58 23 58 58v92c0 35-23 58-58 58h-32l-52 47v-47H116c-35 0-58-23-58-58v-92c0-35 23-58 58-58Z"
          fill="#ffdbca" stroke="#765848" stroke-width="10" stroke-linejoin="round"/>

    <!-- Foreground speech bubble -->
    <path d="M178 154h218c34 0 58 24 58 58v91c0 34-24 58-58 58h-48l-58 52v-52H178c-34 0-58-24-58-58v-91c0-34 24-58 58-58Z"
          fill="#974811" stroke="#974811" stroke-width="8" stroke-linejoin="round"/>

    <!-- Voice waveform -->
    <g fill="none" stroke="#fbf9f9" stroke-width="17" stroke-linecap="round">
      <path d="M190 258v-18 M222 278v-58 M254 299v-99 M286 278v-58 M318 258v-18 M350 278v-58"/>
    </g>
    <path d="M183 319h174" stroke="#ffdbca" stroke-width="7" stroke-linecap="round"/>

    <!-- Small olive accent mark -->
    <circle cx="384" cy="185" r="13" fill="#636032"/>
  </g>
</svg>
"""

TEMP_FG_SVG = os.path.join(ROOT, "public", "temp_fg.svg")
with open(TEMP_FG_SVG, "w", encoding="utf-8") as f:
    f.write(FOREGROUND_SVG_CONTENT)

# Densities for Android
DENSITIES = {
    "mipmap-mdpi": {"fg": 108, "launcher": 48},
    "mipmap-hdpi": {"fg": 162, "launcher": 72},
    "mipmap-xhdpi": {"fg": 216, "launcher": 96},
    "mipmap-xxhdpi": {"fg": 324, "launcher": 144},
    "mipmap-xxxhdpi": {"fg": 432, "launcher": 192},
}

BG_COLOR = (15, 23, 42, 255) # #0f172a

print("Generating Android mipmap icons...")
for folder, sizes in DENSITIES.items():
    target_dir = os.path.join(RES_DIR, folder)
    os.makedirs(target_dir, exist_ok=True)
    
    # 3a. Adaptive foreground
    fg_size = sizes["fg"]
    fg_path = os.path.join(target_dir, "ic_launcher_foreground.png")
    cairosvg.svg2png(url=TEMP_FG_SVG, write_to=fg_path, output_width=fg_size, output_height=fg_size)
    
    # 3b. Legacy square/squircle ic_launcher.png
    l_size = sizes["launcher"]
    # Render foreground scaled to fit nicely on legacy icon (approx 80% of canvas)
    fg_legacy_png = cairosvg.svg2png(url=TEMP_FG_SVG, output_width=l_size, output_height=l_size)
    import io
    fg_img = Image.open(io.BytesIO(fg_legacy_png)).convert("RGBA")
    
    # Base squircle
    base_sq = Image.new("RGBA", (l_size, l_size), (0, 0, 0, 0))
    draw_sq = ImageDraw.Draw(base_sq)
    radius = int(l_size * 0.22)
    draw_sq.rounded_rectangle([0, 0, l_size - 1, l_size - 1], radius=radius, fill=BG_COLOR)
    # Composite foreground
    base_sq.alpha_composite(fg_img)
    base_sq.save(os.path.join(target_dir, "ic_launcher.png"), format="PNG")
    
    # 3c. Legacy round ic_launcher_round.png
    base_rd = Image.new("RGBA", (l_size, l_size), (0, 0, 0, 0))
    draw_rd = ImageDraw.Draw(base_rd)
    draw_rd.ellipse([0, 0, l_size - 1, l_size - 1], fill=BG_COLOR)
    base_rd.alpha_composite(fg_img)
    base_rd.save(os.path.join(target_dir, "ic_launcher_round.png"), format="PNG")

# Clean up temp
if os.path.exists(TEMP_FG_SVG):
    os.remove(TEMP_FG_SVG)

print("All icons generated successfully!")
