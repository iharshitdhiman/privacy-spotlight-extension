from PIL import Image, ImageDraw
import os

BASE_DIR = "/Volumes/Extreme SSD/Google Chrome Extension"
ICON_DIR = os.path.join(BASE_DIR, "icons")
SIZES = (16, 48, 128)
SUPERSAMPLE = 4
BG_COLOR = (0x11, 0x18, 0x27, 255)  # #111827
WHITE = (255, 255, 255)


def make_icon(size):
    big = size * SUPERSAMPLE
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))

    # Dark rounded square filling the full canvas, corner radius 22% of size
    draw = ImageDraw.Draw(canvas)
    radius = round(big * 0.22)
    draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=radius, fill=BG_COLOR)

    center = big / 2

    # Outer white disc at ~25% opacity, diameter 62% of size (composited over background)
    outer_d = big * 0.62
    overlay = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(overlay).ellipse(
        [center - outer_d / 2, center - outer_d / 2,
         center + outer_d / 2, center + outer_d / 2],
        fill=WHITE + (round(255 * 0.25),),
    )
    canvas = Image.alpha_composite(canvas, overlay)

    # Inner solid white disc, diameter 34% of size
    inner_d = big * 0.34
    draw = ImageDraw.Draw(canvas)
    draw.ellipse(
        [center - inner_d / 2, center - inner_d / 2,
         center + inner_d / 2, center + inner_d / 2],
        fill=WHITE + (255,),
    )

    return canvas.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(ICON_DIR, exist_ok=True)
    for size in SIZES:
        path = os.path.join(ICON_DIR, f"icon{size}.png")
        make_icon(size).save(path, "PNG")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
