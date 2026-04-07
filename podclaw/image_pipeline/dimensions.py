"""Dimensiones de generación y targets de impresión por tipo de producto."""

from __future__ import annotations

# product_type: (gen_width, gen_height, print_width, print_height, ratio_name)
PRODUCT_DIMENSIONS: dict[str, tuple[int, int, int, int, str]] = {
    "t-shirt":    (1024, 1365, 4500, 5400, "3:4"),
    "hoodie":     (1024, 1365, 4500, 5400, "3:4"),
    "tank-top":   (1024, 1365, 4500, 5400, "3:4"),
    "mug":        (1365, 568,  2700, 1125, "12:5"),
    "mug-single": (1024, 1024, 1050, 1050, "1:1"),
    "tote-bag":   (1024, 1024, 3600, 3600, "1:1"),
    "phone-case": (768,  1536, 1200, 2400, "1:2"),
    "poster":     (1024, 1365, 5400, 7200, "3:4"),
    "canvas":     (1024, 1365, 4800, 6000, "4:5"),
    "sticker":    (1024, 1024, 2000, 2000, "1:1"),
    "pillow":     (1024, 1024, 3600, 3600, "1:1"),
    "blanket":    (1365, 1024, 5400, 4050, "4:3"),
}

DEFAULT_PRODUCT = "t-shirt"


def get_generation_size(product_type: str) -> dict[str, int]:
    """Return generation dimensions for fal.ai (width, height)."""
    dims = PRODUCT_DIMENSIONS.get(product_type, PRODUCT_DIMENSIONS[DEFAULT_PRODUCT])
    return {"width": dims[0], "height": dims[1]}


def get_print_target(product_type: str) -> tuple[int, int]:
    """Return target print dimensions in pixels (width, height)."""
    dims = PRODUCT_DIMENSIONS.get(product_type, PRODUCT_DIMENSIONS[DEFAULT_PRODUCT])
    return dims[2], dims[3]


def get_upscale_factor(product_type: str) -> int:
    """Calculate required upscale factor (2 or 4)."""
    dims = PRODUCT_DIMENSIONS.get(product_type, PRODUCT_DIMENSIONS[DEFAULT_PRODUCT])
    gen_w = dims[0]
    target_w = dims[2]
    factor = target_w / gen_w
    if factor <= 2.5:
        return 2
    return 4
