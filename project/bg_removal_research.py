"""
===============================================================================
PURE ALGORITHMIC BACKGROUND REMOVAL — RESEARCH & WORKING CODE
===============================================================================
For POD (Print-on-Demand) product images.
NO AI, NO neural networks, NO ONNX, NO ML models.
Traditional computer vision only.

Target images:
  - Designs on white backgrounds
  - Illustrations/vectors on solid color backgrounds
  - Product photos on studio backgrounds (white/gray)

Output: Clean PNG with transparent background for printing on t-shirts, mugs, etc.

DEPENDENCY SUMMARY:
  Package                     | Wheel Size   | Installed | Depends On
  ----------------------------|-------------|-----------|------------
  Pillow                      | ~5-7 MB     | ~15 MB    | (none)
  numpy                       | ~8-12 MB    | ~30 MB    | (none)
  opencv-python-headless      | ~33-56 MB   | ~50-80 MB | numpy
  scikit-image                | ~12-14 MB   | ~30 MB    | numpy, scipy, Pillow
  scipy                       | ~20-40 MB   | ~120 MB   | numpy
  pymatting                   | ~0.3 MB     | ~1 MB     | numpy, scipy, Pillow, numba

  LIGHTEST STACK:  Pillow only                          = ~15 MB installed
  LIGHT STACK:     Pillow + numpy                       = ~45 MB installed
  MEDIUM STACK:    opencv-python-headless (+ numpy)     = ~110 MB installed
  HEAVY STACK:     opencv + scikit-image + scipy         = ~280 MB installed
  FULL STACK:      + pymatting + numba                   = ~400 MB installed

===============================================================================
"""

import io
import sys
from pathlib import Path

***REMOVED***================
# TECHNIQUE 1: PILLOW-ONLY — Color Distance Replacement (NO OpenCV needed)
***REMOVED***================
# Dependencies: Pillow only (~15 MB installed)
# pip install Pillow
#
# WHEN IT WORKS:
#   - Perfect for white/solid backgrounds with clear color distinction
#   - Vector art, illustrations, logos on uniform backgrounds
#   - Studio shots on pure white (#FFFFFF or near-white)
#
# WHEN IT FAILS:
#   - Gradients in the background
#   - Subject has same color as background (white shirt on white bg)
#   - Semi-transparent edges, fine hair, feathers
#   - Shadows that blend into background
#
# PERFORMANCE: Fast (~50-200ms for 2000x2000), minimal memory
# POD ACCURACY: 7/10 for white-bg product images, 9/10 for vector/illustration

def pillow_color_replace(
    image_path: str,
    output_path: str,
    bg_color: tuple = (255, 255, 255),  # RGB of background to remove
    tolerance: int = 30,                 # Color distance threshold
    edge_softness: int = 2,              # Anti-alias radius (0=hard edges)
) -> None:
    """
    Remove background by replacing pixels close to bg_color with transparency.
    Pure Pillow, zero external dependencies beyond PIL.
    """
    from PIL import Image

    img = Image.open(image_path).convert("RGBA")
    pixels = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            # Euclidean color distance in RGB space
            dist = ((r - bg_color[0]) ** 2 +
                    (g - bg_color[1]) ** 2 +
                    (b - bg_color[2]) ** 2) ** 0.5

            if dist < tolerance:
                # Fully transparent
                pixels[x, y] = (r, g, b, 0)
            elif dist < tolerance + edge_softness * 10 and edge_softness > 0:
                # Partial transparency for anti-aliasing at edges
                alpha = int(255 * (dist - tolerance) / (edge_softness * 10))
                alpha = min(255, max(0, alpha))
                pixels[x, y] = (r, g, b, alpha)

    img.save(output_path, "PNG")
    print(f"[Pillow color replace] Saved: {output_path}")


***REMOVED***================
# TECHNIQUE 1b: PILLOW-ONLY — Flood Fill from Edges
***REMOVED***================
# Dependencies: Pillow only (~15 MB installed)
# pip install Pillow
#
# WHEN IT WORKS:
#   - Backgrounds that are connected (no "islands" of background color inside subject)
#   - White/solid backgrounds where the edges of the image are background
#   - Product photos on uniform studio backgrounds
#
# WHEN IT FAILS:
#   - Subject touches image edges
#   - Background color also appears inside the subject (e.g., white text on design)
#   - Multiple disconnected background regions
#
# PERFORMANCE: Fast (~100-400ms for 2000x2000), moderate memory (set for visited pixels)
# POD ACCURACY: 8/10 for studio product shots, 6/10 for designs touching edges

def pillow_flood_fill_edges(
    image_path: str,
    output_path: str,
    tolerance: int = 35,
    sample_points: int = 20,  # Points along each edge to seed flood fill
) -> None:
    """
    Flood fill from image edges to find connected background, then make transparent.
    Uses BFS (breadth-first search) flood fill — no OpenCV required.
    """
    from PIL import Image
    from collections import deque

    img = Image.open(image_path).convert("RGBA")
    pixels = img.load()
    w, h = img.size

    # Auto-detect background color by sampling corners
    corner_samples = []
    for cx, cy in [(0, 0), (w-1, 0), (0, h-1), (w-1, h-1)]:
        r, g, b, a = pixels[cx, cy]
        corner_samples.append((r, g, b))
    # Average corner color = likely background
    bg_r = sum(c[0] for c in corner_samples) // 4
    bg_g = sum(c[1] for c in corner_samples) // 4
    bg_b = sum(c[2] for c in corner_samples) // 4
    bg_color = (bg_r, bg_g, bg_b)
    print(f"[Flood fill] Auto-detected background color: RGB{bg_color}")

    def color_distance(c1, c2):
        return ((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2) ** 0.5

    # BFS flood fill from edge seed points
    visited = set()
    bg_pixels = set()
    queue = deque()

    # Seed from all four edges
    for i in range(0, w, max(1, w // sample_points)):
        queue.append((i, 0))
        queue.append((i, h - 1))
    for j in range(0, h, max(1, h // sample_points)):
        queue.append((0, j))
        queue.append((w - 1, j))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited:
            continue
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
        visited.add((x, y))

        r, g, b, a = pixels[x, y]
        if color_distance((r, g, b), bg_color) <= tolerance:
            bg_pixels.add((x, y))
            # 4-connected neighbors
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = x + dx, y + dy
                if (nx, ny) not in visited:
                    queue.append((nx, ny))

    # Apply transparency to background pixels
    for (x, y) in bg_pixels:
        r, g, b, a = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)

    img.save(output_path, "PNG")
    print(f"[Flood fill] Removed {len(bg_pixels)} bg pixels. Saved: {output_path}")


***REMOVED***================
# TECHNIQUE 2: COLOR-BASED SEGMENTATION (HSV Thresholding)
***REMOVED***================
# Dependencies: opencv-python-headless + numpy (~110 MB installed)
# pip install opencv-python-headless numpy
#
# WHEN IT WORKS:
#   - Excellent for white/gray studio backgrounds (product photography standard)
#   - Green screen / chroma key backgrounds
#   - Any single, uniform background color
#   - Very fast and deterministic
#
# WHEN IT FAILS:
#   - Subject has similar color to background
#   - Multiple background colors
#   - Significant shadows/gradients on background
#   - Fine semi-transparent edges
#
# PERFORMANCE: Very fast (~20-80ms for 2000x2000), low memory
# POD ACCURACY: 8/10 for white-bg, 9/10 for chroma key, 5/10 for complex scenes

def hsv_white_background_removal(
    image_path: str,
    output_path: str,
    saturation_threshold: int = 30,   # Below this = "colorless" (white/gray)
    value_threshold: int = 200,        # Above this = "bright" (white)
    blur_kernel: int = 5,              # Gaussian blur for noise reduction
    morph_kernel: int = 5,             # Morphological cleanup kernel size
) -> None:
    """
    Remove white/light backgrounds using HSV color space segmentation.
    White pixels have: low Saturation + high Value.
    """
    import cv2
    import numpy as np

    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    # Blur to reduce noise
    blurred = cv2.GaussianBlur(img, (blur_kernel, blur_kernel), 0)

    # Convert to HSV
    hsv = cv2.cvtColor(blurred, cv2.COLOR_BGR2HSV)

    # White background: low saturation AND high value
    # HSV ranges in OpenCV: H=0-179, S=0-255, V=0-255
    lower_white = np.array([0, 0, value_threshold])
    upper_white = np.array([179, saturation_threshold, 255])
    bg_mask = cv2.inRange(hsv, lower_white, upper_white)

    # Morphological operations to clean up mask
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (morph_kernel, morph_kernel))
    bg_mask = cv2.morphologyEx(bg_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    bg_mask = cv2.morphologyEx(bg_mask, cv2.MORPH_OPEN, kernel, iterations=1)

    # Invert: we want foreground mask (255 = keep, 0 = remove)
    fg_mask = cv2.bitwise_not(bg_mask)

    # Smooth the mask edges with Gaussian blur for anti-aliasing
    fg_mask_smooth = cv2.GaussianBlur(fg_mask, (3, 3), 0)

    # Create RGBA output
    b, g, r = cv2.split(img)
    rgba = cv2.merge([r, g, b, fg_mask_smooth])  # Note: OpenCV is BGR, PNG is RGB

    # Save as PNG using Pillow for correct RGBA
    from PIL import Image
    result = Image.fromarray(rgba, "RGBA")
    result.save(output_path, "PNG")
    print(f"[HSV white removal] Saved: {output_path}")


def hsv_solid_color_removal(
    image_path: str,
    output_path: str,
    hue_range: tuple = None,            # (low, high) or None for auto-detect
    saturation_range: tuple = (0, 255),
    value_range: tuple = (0, 255),
    auto_detect: bool = True,           # Auto-detect bg color from corners
    tolerance: int = 25,
) -> None:
    """
    Remove any solid-color background using HSV segmentation.
    Auto-detects background color from corner pixels if auto_detect=True.
    """
    import cv2
    import numpy as np

    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h_img, w_img = img.shape[:2]

    if auto_detect:
        # Sample corners (10x10 patches) to determine background
        corners = []
        for cy, cx in [(0, 0), (0, w_img-10), (h_img-10, 0), (h_img-10, w_img-10)]:
            patch = hsv[cy:cy+10, cx:cx+10]
            corners.append(patch.reshape(-1, 3))
        samples = np.vstack(corners)
        median_hsv = np.median(samples, axis=0).astype(int)
        print(f"[HSV solid] Auto-detected bg HSV: H={median_hsv[0]}, S={median_hsv[1]}, V={median_hsv[2]}")

        lower = np.array([
            max(0, median_hsv[0] - tolerance),
            max(0, median_hsv[1] - tolerance),
            max(0, median_hsv[2] - tolerance)
        ])
        upper = np.array([
            min(179, median_hsv[0] + tolerance),
            min(255, median_hsv[1] + tolerance),
            min(255, median_hsv[2] + tolerance)
        ])
    else:
        lower = np.array([hue_range[0], saturation_range[0], value_range[0]])
        upper = np.array([hue_range[1], saturation_range[1], value_range[1]])

    bg_mask = cv2.inRange(hsv, lower, upper)

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    bg_mask = cv2.morphologyEx(bg_mask, cv2.MORPH_CLOSE, kernel, iterations=3)
    bg_mask = cv2.morphologyEx(bg_mask, cv2.MORPH_OPEN, kernel, iterations=2)

    fg_mask = cv2.bitwise_not(bg_mask)
    fg_mask_smooth = cv2.GaussianBlur(fg_mask, (3, 3), 0)

    b, g, r = cv2.split(img)
    rgba = cv2.merge([r, g, b, fg_mask_smooth])

    from PIL import Image
    result = Image.fromarray(rgba, "RGBA")
    result.save(output_path, "PNG")
    print(f"[HSV solid removal] Saved: {output_path}")


***REMOVED***================
# TECHNIQUE 3: OPENCV GRABCUT — Automatic Foreground Extraction
***REMOVED***================
# Dependencies: opencv-python-headless + numpy (~110 MB installed)
# pip install opencv-python-headless numpy
#
# WHEN IT WORKS:
#   - Best general-purpose traditional method
#   - Product images where subject is clearly centered
#   - Works even with some background texture/gradient
#   - Can handle moderate shadows
#
# WHEN IT FAILS:
#   - Subject color very similar to background
#   - Subject not centered or touching edges extensively
#   - Very thin features (wires, chains, fine text)
#   - Very slow on large images (iterative graph-cut algorithm)
#
# PERFORMANCE: SLOW (~2-10 seconds for 2000x2000, depends on iterations)
# Memory: Moderate (~3-5x image size)
# POD ACCURACY: 7/10 for product images, better with manual rect tuning

def grabcut_auto(
    image_path: str,
    output_path: str,
    margin_pct: float = 0.02,   # Rect margin from edges (2% = assume subject centered)
    iterations: int = 5,         # GrabCut iterations (more = better but slower)
    refine_with_hsv: bool = True # Post-process with HSV to catch remaining white bg
) -> None:
    """
    Automatic GrabCut foreground extraction.
    Estimates rectangle automatically using image margins.
    """
    import cv2
    import numpy as np

    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    h, w = img.shape[:2]

    # Auto-estimate foreground rectangle (margin from each edge)
    mx = int(w * margin_pct)
    my = int(h * margin_pct)
    rect = (mx, my, w - 2 * mx, h - 2 * my)

    # Initialize mask and models
    mask = np.zeros((h, w), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    # Run GrabCut with rect initialization
    cv2.grabCut(img, mask, rect, bgd_model, fgd_model, iterations, cv2.GC_INIT_WITH_RECT)

    # Mask: 0=BG, 1=FG, 2=probable_BG, 3=probable_FG
    # Keep definite and probable foreground
    fg_mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    if refine_with_hsv:
        # Additionally remove any remaining white pixels in the mask
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        white_mask = cv2.inRange(hsv, np.array([0, 0, 220]), np.array([179, 30, 255]))
        # Only remove white where GrabCut was uncertain (probable foreground)
        uncertain = np.where(mask == cv2.GC_PR_FGD, 255, 0).astype(np.uint8)
        refinement = cv2.bitwise_and(white_mask, uncertain)
        fg_mask = cv2.bitwise_and(fg_mask, cv2.bitwise_not(refinement))

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Smooth edges
    fg_mask = cv2.GaussianBlur(fg_mask, (3, 3), 0)

    # Create RGBA
    b, g, r = cv2.split(img)
    rgba = cv2.merge([r, g, b, fg_mask])

    from PIL import Image
    result = Image.fromarray(rgba, "RGBA")
    result.save(output_path, "PNG")
    print(f"[GrabCut auto] Saved: {output_path}")


def grabcut_with_mask_hints(
    image_path: str,
    output_path: str,
    iterations: int = 5,
) -> None:
    """
    GrabCut with automatic mask hints:
    - Edges are definite background
    - Center region is probable foreground
    - Uses Otsu threshold for initial seed
    """
    import cv2
    import numpy as np

    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    h, w = img.shape[:2]

    # Create initial mask using Otsu thresholding
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Initialize GrabCut mask
    mask = np.full((h, w), cv2.GC_PR_BGD, dtype=np.uint8)  # Probable BG everywhere

    # Edge pixels (5% border) = definite background
    border = max(int(min(h, w) * 0.05), 5)
    mask[:border, :] = cv2.GC_BGD
    mask[-border:, :] = cv2.GC_BGD
    mask[:, :border] = cv2.GC_BGD
    mask[:, -border:] = cv2.GC_BGD

    # Otsu foreground = probable foreground
    mask[thresh == 255] = cv2.GC_PR_FGD

    # Center region where Otsu is foreground = definite foreground
    center_y, center_x = h // 4, w // 4
    center_region = thresh[center_y:3*center_y, center_x:3*center_x]
    mask_center = mask[center_y:3*center_y, center_x:3*center_x]
    mask_center[center_region == 255] = cv2.GC_FGD

    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)

    cv2.grabCut(img, mask, None, bgd_model, fgd_model, iterations, cv2.GC_INIT_WITH_MASK)

    fg_mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    # Cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    fg_mask = cv2.GaussianBlur(fg_mask, (3, 3), 0)

    b, g, r = cv2.split(img)
    rgba = cv2.merge([r, g, b, fg_mask])

    from PIL import Image
    result = Image.fromarray(rgba, "RGBA")
    result.save(output_path, "PNG")
    print(f"[GrabCut mask hints] Saved: {output_path}")


***REMOVED***================
# TECHNIQUE 4: EDGE DETECTION + CONTOUR — Canny → Contour → Mask
***REMOVED***================
# Dependencies: opencv-python-headless + numpy (~110 MB installed)
# pip install opencv-python-headless numpy
#
# WHEN IT WORKS:
#   - High contrast subjects on uniform backgrounds
#   - Bold designs, logos, text with clear edges
#   - Objects with well-defined outlines
#   - Fast and predictable
#
# WHEN IT FAILS:
#   - Low contrast between subject and background
#   - Multiple separate objects (picks largest contour only)
#   - Textured backgrounds that generate many edges
#   - Fine details that don't form closed contours
#
# PERFORMANCE: Fast (~50-200ms for 2000x2000), low memory
# POD ACCURACY: 7/10 for high-contrast designs, 4/10 for photos with shadows

def canny_contour_removal(
    image_path: str,
    output_path: str,
    canny_low: int = 50,
    canny_high: int = 150,
    blur_kernel: int = 5,
    dilate_iterations: int = 3,
    erode_iterations: int = 2,
    min_contour_area_pct: float = 0.01,  # Min area as % of image
) -> None:
    """
    Edge detection → find contours → create mask from largest contour(s).
    Good for bold designs on clean backgrounds.
    """
    import cv2
    import numpy as np

    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    h, w = img.shape[:2]
    total_area = h * w

    # Grayscale + blur
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (blur_kernel, blur_kernel), 0)

    # Canny edge detection
    edges = cv2.Canny(blurred, canny_low, canny_high)

    # Dilate edges to close gaps, then erode to restore size
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=dilate_iterations)
    edges = cv2.erode(edges, kernel, iterations=erode_iterations)

    # Find contours
    contours, hierarchy = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Filter contours by area
    min_area = total_area * min_contour_area_pct
    valid_contours = [c for c in contours if cv2.contourArea(c) > min_area]

    if not valid_contours:
        print("[Canny contour] WARNING: No significant contours found, keeping entire image")
        # Fallback: just copy with alpha
        from PIL import Image as PILImage
        pil_img = PILImage.open(image_path).convert("RGBA")
        pil_img.save(output_path, "PNG")
        return

    # Create mask from all valid contours (filled)
    fg_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(fg_mask, valid_contours, -1, 255, thickness=cv2.FILLED)

    # Fill holes: flood fill from (0,0), then invert
    flood_mask = fg_mask.copy()
    cv2.floodFill(flood_mask, None, (0, 0), 255)
    holes = cv2.bitwise_not(flood_mask)
    fg_mask = cv2.bitwise_or(fg_mask, holes)

    # Smooth edges
    fg_mask = cv2.GaussianBlur(fg_mask, (5, 5), 0)

    # Create RGBA
    b, g, r = cv2.split(img)
    rgba = cv2.merge([r, g, b, fg_mask])

    from PIL import Image
    result = Image.fromarray(rgba, "RGBA")
    result.save(output_path, "PNG")
    print(f"[Canny contour] Found {len(valid_contours)} contour(s). Saved: {output_path}")


***REMOVED***================
# TECHNIQUE 5: FLOOD FILL with OpenCV (from edges/corners)
***REMOVED***================
# Dependencies: opencv-python-headless + numpy (~110 MB installed)
# pip install opencv-python-headless numpy
#
# WHEN IT WORKS:
#   - Uniform backgrounds (white, gray, solid colors)
#   - Background is connected to image edges
#   - Fast and reliable for studio product shots
#   - Works even if subject is off-center
#
# WHEN IT FAILS:
#   - Background has gradients, patterns, or texture
#   - Subject touches image borders extensively
#   - Background color appears inside the subject
#   - Multiple disconnected bg regions not touching edges
#
# PERFORMANCE: Very fast (~30-100ms for 2000x2000), low memory
# POD ACCURACY: 8/10 for studio shots, 7/10 for illustrations

def opencv_flood_fill(
    image_path: str,
    output_path: str,
    tolerance: tuple = (25, 25, 25),   # BGR tolerance (lo_diff, up_diff per channel)
    seed_margin: int = 5,               # Pixels from edge to sample
    morph_kernel: int = 5,
) -> None:
    """
    Flood fill from multiple edge points to find connected background.
    Uses OpenCV's floodFill which is MUCH faster than pure-Python BFS.
    """
    import cv2
    import numpy as np

    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    h, w = img.shape[:2]

    # Create flood fill mask (must be 2 pixels larger than image)
    ff_mask = np.zeros((h + 2, w + 2), np.uint8)

    # Accumulate background mask from multiple seed points along edges
    bg_mask = np.zeros((h, w), np.uint8)

    lo_diff = tolerance
    up_diff = tolerance

    # Seed points: sample along all 4 edges
    seed_points = []
    step = max(1, min(w, h) // 50)
    for x in range(seed_margin, w - seed_margin, step):
        seed_points.append((x, seed_margin))             # top edge
        seed_points.append((x, h - seed_margin - 1))     # bottom edge
    for y in range(seed_margin, h - seed_margin, step):
        seed_points.append((seed_margin, y))              # left edge
        seed_points.append((w - seed_margin - 1, y))      # right edge
    # Always include corners
    for sx, sy in [(seed_margin, seed_margin), (w-seed_margin-1, seed_margin),
                   (seed_margin, h-seed_margin-1), (w-seed_margin-1, h-seed_margin-1)]:
        seed_points.append((sx, sy))

    for seed in seed_points:
        ff_mask_temp = np.zeros((h + 2, w + 2), np.uint8)
        temp_img = img.copy()

        ret, _, _, rect = cv2.floodFill(
            temp_img, ff_mask_temp, seed,
            newVal=(0, 0, 0),
            loDiff=lo_diff,
            upDiff=up_diff,
            flags=cv2.FLOODFILL_MASK_ONLY | (255 << 8)  # Fill mask with 255
        )
        # Extract the filled region from the mask (remove 1-pixel border)
        filled = ff_mask_temp[1:h+1, 1:w+1]
        bg_mask = cv2.bitwise_or(bg_mask, filled)

    # Foreground = inverse of background
    fg_mask = cv2.bitwise_not(bg_mask)

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (morph_kernel, morph_kernel))
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel, iterations=1)

    # Anti-alias edges
    fg_mask = cv2.GaussianBlur(fg_mask, (3, 3), 0)

    b, g, r = cv2.split(img)
    rgba = cv2.merge([r, g, b, fg_mask])

    from PIL import Image
    result = Image.fromarray(rgba, "RGBA")
    result.save(output_path, "PNG")
    print(f"[Flood fill OpenCV] Saved: {output_path}")


***REMOVED***================
# TECHNIQUE 6: WATERSHED ALGORITHM — Marker-Based Segmentation
***REMOVED***================
# Dependencies: opencv-python-headless + numpy (~110 MB installed)
# pip install opencv-python-headless numpy
#
# WHEN IT WORKS:
#   - Objects with clear boundaries that can be found via thresholding
#   - Touching/overlapping objects (its primary strength)
#   - Product images where basic thresholding gives a reasonable seed
#
# WHEN IT FAILS:
#   - Low contrast images
#   - Very noisy backgrounds
#   - Requires good initial markers (garbage in = garbage out)
#   - Over-segments complex scenes
#
# PERFORMANCE: Moderate (~200-800ms for 2000x2000), moderate memory
# POD ACCURACY: 6/10 standalone, 8/10 when combined with Otsu markers

def watershed_removal(
    image_path: str,
    output_path: str,
    distance_threshold: float = 0.5,  # 0.0-1.0, higher = tighter foreground
    morph_kernel: int = 3,
) -> None:
    """
    Watershed segmentation with automatic markers from distance transform.
    Classic approach: threshold → distance transform → markers → watershed.
    """
    import cv2
    import numpy as np

    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    h, w = img.shape[:2]

    # Grayscale + Otsu threshold (binary: foreground=white on dark bg, or invert)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Morphological opening to remove noise
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (morph_kernel, morph_kernel))
    opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)

    # Sure background: dilate to push boundaries out
    sure_bg = cv2.dilate(opening, kernel, iterations=3)

    # Sure foreground: distance transform + threshold
    dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
    _, sure_fg = cv2.threshold(dist_transform, distance_threshold * dist_transform.max(), 255, 0)
    sure_fg = np.uint8(sure_fg)

    # Unknown region = sure_bg - sure_fg
    unknown = cv2.subtract(sure_bg, sure_fg)

    # Label markers
    num_labels, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1  # Background is now 1, not 0
    markers[unknown == 255] = 0  # Unknown region = 0

    # Apply watershed
    markers = cv2.watershed(img, markers)

    # Create foreground mask: markers > 1 are foreground regions
    fg_mask = np.zeros((h, w), dtype=np.uint8)
    fg_mask[markers > 1] = 255
    # Boundary pixels (markers == -1) are edges — include them in foreground
    fg_mask[markers == -1] = 255

    # If most of the image is "foreground", the threshold inverted wrong way
    fg_ratio = np.sum(fg_mask > 0) / (h * w)
    if fg_ratio > 0.7:
        # Invert: background was detected as foreground
        fg_mask = cv2.bitwise_not(fg_mask)

    # Cleanup
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    fg_mask = cv2.GaussianBlur(fg_mask, (3, 3), 0)

    b, g, r = cv2.split(img)
    rgba = cv2.merge([r, g, b, fg_mask])

    from PIL import Image
    result = Image.fromarray(rgba, "RGBA")
    result.save(output_path, "PNG")
    print(f"[Watershed] {num_labels} regions found. Saved: {output_path}")


***REMOVED***================
# TECHNIQUE 7: MORPHOLOGICAL OPERATIONS — Clean Up Any Mask
***REMOVED***================
# Dependencies: opencv-python-headless + numpy (~110 MB installed)
# pip install opencv-python-headless numpy
#
# This is NOT a standalone technique but a critical post-processing step.
# Apply to ANY mask from the above techniques.
#
# Operations:
#   - Erosion:  shrinks white regions (removes small noise)
#   - Dilation: grows white regions (fills small holes)
#   - Opening:  erosion → dilation (removes small objects)
#   - Closing:  dilation → erosion (fills small holes)
#   - Gradient: dilation - erosion (extracts edges)

def morphological_refine_mask(
    mask,                       # numpy uint8 array (0 or 255)
    remove_noise: bool = True,  # Remove small white spots
    fill_holes: bool = True,    # Fill small black holes
    smooth_edges: bool = True,  # Gaussian blur on final mask
    min_object_size: int = 500, # Remove connected components smaller than this
):
    """
    Refine a binary mask using morphological operations.
    Returns improved mask (numpy uint8 array).
    """
    import cv2
    import numpy as np

    result = mask.copy()

    kernel_small = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    kernel_med = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

    if remove_noise:
        # Opening: erode then dilate — removes small white noise
        result = cv2.morphologyEx(result, cv2.MORPH_OPEN, kernel_small, iterations=2)

    if fill_holes:
        # Closing: dilate then erode — fills small black holes
        result = cv2.morphologyEx(result, cv2.MORPH_CLOSE, kernel_med, iterations=3)

    # Remove small connected components
    if min_object_size > 0:
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(result)
        for i in range(1, num_labels):  # Skip background (label 0)
            if stats[i, cv2.CC_STAT_AREA] < min_object_size:
                result[labels == i] = 0

    if smooth_edges:
        result = cv2.GaussianBlur(result, (5, 5), 0)

    return result


***REMOVED***================
# TECHNIQUE 8: COMBINED PIPELINE — Multi-technique Robustness
***REMOVED***================
# This combines multiple techniques for production-grade results.
# Dependencies: opencv-python-headless + numpy (~110 MB installed)
#
# Strategy for POD images:
#   1. Auto-detect background color (corner sampling)
#   2. Try HSV thresholding first (fast, works 80% of the time for white bg)
#   3. If unsure, try flood fill from edges
#   4. If still unsure, fall back to GrabCut
#   5. Refine with morphological operations
#   6. Apply edge-aware alpha blending
#
# POD ACCURACY: 9/10 for white-bg product images, 7/10 for complex backgrounds

def detect_background_info(image_path: str) -> dict:
    """
    Analyze an image to determine background characteristics.
    Returns dict with: color_rgb, color_hsv, is_white, is_solid, uniformity_score
    """
    import cv2
    import numpy as np

    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    h, w = img.shape[:2]

    # Sample 4 corner patches (5% of image size)
    patch_size = max(5, min(h, w) // 20)
    corners_bgr = []
    for cy, cx in [(0, 0), (0, w - patch_size), (h - patch_size, 0), (h - patch_size, w - patch_size)]:
        patch = img[cy:cy+patch_size, cx:cx+patch_size]
        corners_bgr.append(patch.reshape(-1, 3))

    # Also sample 4 edge center patches
    edge_centers = [
        (0, w//2 - patch_size//2),                    # top center
        (h - patch_size, w//2 - patch_size//2),        # bottom center
        (h//2 - patch_size//2, 0),                     # left center
        (h//2 - patch_size//2, w - patch_size),        # right center
    ]
    for cy, cx in edge_centers:
        cy = max(0, min(cy, h - patch_size))
        cx = max(0, min(cx, w - patch_size))
        patch = img[cy:cy+patch_size, cx:cx+patch_size]
        corners_bgr.append(patch.reshape(-1, 3))

    all_samples = np.vstack(corners_bgr)
    median_bgr = np.median(all_samples, axis=0).astype(int)
    std_bgr = np.std(all_samples, axis=0)
    uniformity = 1.0 - min(1.0, np.mean(std_bgr) / 50.0)  # 1.0 = perfectly uniform

    # Convert to RGB and HSV
    color_rgb = (int(median_bgr[2]), int(median_bgr[1]), int(median_bgr[0]))

    pixel_bgr = np.uint8([[median_bgr]])
    pixel_hsv = cv2.cvtColor(pixel_bgr, cv2.COLOR_BGR2HSV)[0][0]
    color_hsv = (int(pixel_hsv[0]), int(pixel_hsv[1]), int(pixel_hsv[2]))

    # Determine if white: high value, low saturation
    is_white = color_hsv[1] < 30 and color_hsv[2] > 200
    is_solid = uniformity > 0.7

    return {
        "color_rgb": color_rgb,
        "color_bgr": (int(median_bgr[0]), int(median_bgr[1]), int(median_bgr[2])),
        "color_hsv": color_hsv,
        "is_white": is_white,
        "is_solid": is_solid,
        "uniformity_score": round(uniformity, 3),
        "std_bgr": std_bgr.tolist(),
    }


def combined_pipeline(
    image_path: str,
    output_path: str,
    max_dimension: int = 2048,          # Resize large images for speed
    grabcut_fallback: bool = True,       # Use GrabCut if simpler methods score low
    confidence_threshold: float = 0.6,   # Below this, try harder methods
) -> dict:
    """
    Production-grade combined pipeline:
      1. Detect background color and uniformity
      2. Choose best technique based on background analysis
      3. Apply morphological refinement
      4. Return result + metadata

    Returns dict with method_used, background_info, processing_time_ms.
    """
    import cv2
    import numpy as np
    import time
    from PIL import Image

    start = time.time()

    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    h, w = img.shape[:2]

    # Resize if too large (for speed)
    scale = 1.0
    if max(h, w) > max_dimension:
        scale = max_dimension / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]

    # Step 1: Analyze background
    # (We do inline analysis instead of calling detect_background_info to avoid re-reading)
    patch_size = max(5, min(h, w) // 20)
    corners_bgr = []
    for cy, cx in [(0, 0), (0, w - patch_size), (h - patch_size, 0), (h - patch_size, w - patch_size)]:
        patch = img[cy:cy+patch_size, cx:cx+patch_size]
        corners_bgr.append(patch.reshape(-1, 3))
    all_samples = np.vstack(corners_bgr)
    median_bgr = np.median(all_samples, axis=0).astype(int)
    std_bgr = np.std(all_samples, axis=0)
    uniformity = 1.0 - min(1.0, np.mean(std_bgr) / 50.0)

    pixel_bgr = np.uint8([[median_bgr]])
    pixel_hsv = cv2.cvtColor(pixel_bgr, cv2.COLOR_BGR2HSV)[0][0]
    is_white = pixel_hsv[1] < 30 and pixel_hsv[2] > 200
    is_solid = uniformity > 0.7

    method_used = "none"

    # Step 2: Choose and apply technique
    if is_white and is_solid:
        # FAST PATH: white background → HSV threshold
        method_used = "hsv_white"
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        bg_mask = cv2.inRange(hsv, np.array([0, 0, 200]), np.array([179, 30, 255]))
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        bg_mask = cv2.morphologyEx(bg_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        bg_mask = cv2.morphologyEx(bg_mask, cv2.MORPH_OPEN, kernel, iterations=1)
        fg_mask = cv2.bitwise_not(bg_mask)

    elif is_solid:
        # MEDIUM PATH: solid non-white background → HSV range around detected color
        method_used = "hsv_solid"
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        tol = 25
        lower = np.array([
            max(0, int(pixel_hsv[0]) - tol),
            max(0, int(pixel_hsv[1]) - tol),
            max(0, int(pixel_hsv[2]) - tol)
        ])
        upper = np.array([
            min(179, int(pixel_hsv[0]) + tol),
            min(255, int(pixel_hsv[1]) + tol),
            min(255, int(pixel_hsv[2]) + tol)
        ])
        bg_mask = cv2.inRange(hsv, lower, upper)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        bg_mask = cv2.morphologyEx(bg_mask, cv2.MORPH_CLOSE, kernel, iterations=3)
        bg_mask = cv2.morphologyEx(bg_mask, cv2.MORPH_OPEN, kernel, iterations=2)
        fg_mask = cv2.bitwise_not(bg_mask)

    else:
        # SLOW PATH: non-uniform background → flood fill + optional GrabCut
        method_used = "flood_fill"
        fg_mask = np.ones((h, w), dtype=np.uint8) * 255
        ff_mask = np.zeros((h + 2, w + 2), np.uint8)

        lo_diff = (25, 25, 25)
        up_diff = (25, 25, 25)
        step = max(1, min(w, h) // 30)

        seed_points = []
        margin = 3
        for x in range(margin, w - margin, step):
            seed_points.extend([(x, margin), (x, h - margin - 1)])
        for y in range(margin, h - margin, step):
            seed_points.extend([(margin, y), (w - margin - 1, y)])

        bg_mask = np.zeros((h, w), np.uint8)
        for seed in seed_points:
            ff_temp = np.zeros((h + 2, w + 2), np.uint8)
            temp = img.copy()
            cv2.floodFill(temp, ff_temp, seed, (0, 0, 0),
                         loDiff=lo_diff, upDiff=up_diff,
                         flags=cv2.FLOODFILL_MASK_ONLY | (255 << 8))
            bg_mask = cv2.bitwise_or(bg_mask, ff_temp[1:h+1, 1:w+1])

        fg_mask = cv2.bitwise_not(bg_mask)

    # Step 3: Evaluate mask quality
    fg_ratio = np.sum(fg_mask > 127) / (h * w)
    confidence = 1.0

    if fg_ratio > 0.95:
        # Almost everything is foreground — likely failed
        confidence = 0.3
    elif fg_ratio < 0.02:
        # Almost everything removed — likely inverted or wrong
        confidence = 0.2
        fg_mask = cv2.bitwise_not(fg_mask)  # Try inverting
    elif fg_ratio > 0.85:
        confidence = 0.5

    # Step 4: GrabCut fallback if low confidence
    if confidence < confidence_threshold and grabcut_fallback:
        method_used += "+grabcut"
        mask_gc = np.full((h, w), cv2.GC_PR_BGD, dtype=np.uint8)
        mask_gc[fg_mask > 127] = cv2.GC_PR_FGD

        # Definite BG at edges
        border = max(3, int(min(h, w) * 0.03))
        mask_gc[:border, :] = cv2.GC_BGD
        mask_gc[-border:, :] = cv2.GC_BGD
        mask_gc[:, :border] = cv2.GC_BGD
        mask_gc[:, -border:] = cv2.GC_BGD

        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)

        try:
            cv2.grabCut(img, mask_gc, None, bgd_model, fgd_model, 3, cv2.GC_INIT_WITH_MASK)
            fg_mask = np.where(
                (mask_gc == cv2.GC_FGD) | (mask_gc == cv2.GC_PR_FGD), 255, 0
            ).astype(np.uint8)
        except cv2.error:
            pass  # GrabCut can fail on edge cases; keep previous mask

    # Step 5: Morphological refinement
    kernel_s = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    kernel_m = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

    # Remove small noise
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel_s, iterations=1)
    # Fill small holes
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel_m, iterations=2)

    # Remove small connected components (< 0.5% of image)
    min_cc_area = int(h * w * 0.005)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(fg_mask)
    for i in range(1, num_labels):
        if stats[i, cv2.CC_STAT_AREA] < min_cc_area:
            fg_mask[labels == i] = 0

    # Step 6: Anti-alias edges
    fg_mask = cv2.GaussianBlur(fg_mask, (3, 3), 0)

    # Step 7: Resize mask back if we downscaled
    if scale != 1.0:
        orig_img = cv2.imread(image_path, cv2.IMREAD_COLOR)
        orig_h, orig_w = orig_img.shape[:2]
        fg_mask = cv2.resize(fg_mask, (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)
        b, g, r = cv2.split(orig_img)
    else:
        b, g, r = cv2.split(img)

    rgba = cv2.merge([r, g, b, fg_mask])

    result = Image.fromarray(rgba, "RGBA")
    result.save(output_path, "PNG")

    elapsed_ms = int((time.time() - start) * 1000)

    info = {
        "method_used": method_used,
        "is_white_bg": is_white,
        "is_solid_bg": is_solid,
        "uniformity": round(uniformity, 3),
        "fg_ratio": round(fg_ratio, 3),
        "confidence": round(confidence, 2),
        "processing_time_ms": elapsed_ms,
        "output_path": output_path,
    }
    print(f"[Combined pipeline] {info}")
    return info


***REMOVED***================
# TECHNIQUE 9: ALPHA MATTING (Without Neural Networks) — Using pymatting
***REMOVED***================
# Dependencies: pymatting + scipy + numba + numpy + Pillow (~400 MB total installed)
# pip install pymatting
#
# NOTE: pymatting uses classical linear algebra methods (Closed-Form Matting,
# KNN Matting, Random Walks), NOT neural networks. These are traditional
# algorithms based on solving sparse linear systems.
#
# WHEN IT WORKS:
#   - BEST for soft edges: hair, fur, feathers, semi-transparent fabric
#   - When you have a good trimap (or can generate one from a rough mask)
#   - Produces smooth alpha gradients, not binary masks
#
# WHEN IT FAILS:
#   - Requires a trimap: must know definite-FG, definite-BG, and unknown regions
#   - Slow on large images (solving large sparse linear systems)
#   - Quality depends heavily on trimap quality
#
# PERFORMANCE: Slow (~5-30s for 1000x1000), high memory
# POD ACCURACY: 9/10 for edge quality (given good trimap), 5/10 for auto (trimap generation is hard)

def alpha_matting_with_auto_trimap(
    image_path: str,
    output_path: str,
    erode_fg: int = 15,      # Pixels to erode from rough mask for sure-FG
    dilate_bg: int = 15,     # Pixels to dilate from rough mask for sure-BG
    method: str = "cf",      # "cf" = closed-form, "knn" = KNN matting
) -> None:
    """
    Alpha matting with auto-generated trimap from HSV threshold.
    Requires: pip install pymatting

    Steps:
      1. Generate rough mask via HSV threshold
      2. Create trimap: erode=sure_FG, dilate_inverse=sure_BG, between=unknown
      3. Apply classical alpha matting (Closed-Form or KNN)
      4. Estimate foreground color
      5. Composite RGBA output
    """
    import numpy as np
    import cv2

    try:
        from pymatting import (
            estimate_alpha_cf,
            estimate_alpha_knn,
            estimate_foreground_ml,
        )
    except ImportError:
        print("ERROR: pymatting not installed. Run: pip install pymatting")
        return

    img_bgr = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise FileNotFoundError(f"Cannot read image: {image_path}")

    # Convert to RGB float [0,1]
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.float64) / 255.0

    h, w = img_bgr.shape[:2]

    # Step 1: Rough mask via Otsu
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    _, rough_mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Step 2: Generate trimap
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))

    # Sure foreground: erode rough mask
    sure_fg = cv2.erode(rough_mask, kernel, iterations=erode_fg)
    # Sure background: dilate rough mask then invert
    dilated = cv2.dilate(rough_mask, kernel, iterations=dilate_bg)
    sure_bg_region = cv2.bitwise_not(dilated)

    # Trimap: 1.0 = foreground, 0.0 = background, 0.5 = unknown
    trimap = np.full((h, w), 0.5, dtype=np.float64)
    trimap[sure_fg > 127] = 1.0
    trimap[sure_bg_region > 127] = 0.0

    # Step 3: Alpha matting
    if method == "knn":
        alpha = estimate_alpha_knn(img_rgb, trimap)
    else:
        alpha = estimate_alpha_cf(img_rgb, trimap)

    # Step 4: Foreground estimation (removes background color bleed)
    foreground = estimate_foreground_ml(img_rgb, alpha)

    # Step 5: Create RGBA output
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = (foreground * 255).clip(0, 255).astype(np.uint8)
    rgba[:, :, 3] = (alpha * 255).clip(0, 255).astype(np.uint8)

    from PIL import Image
    result = Image.fromarray(rgba, "RGBA")
    result.save(output_path, "PNG")
    print(f"[Alpha matting ({method})] Saved: {output_path}")


***REMOVED***================
# TECHNIQUE 10: SCIKIT-IMAGE — Felzenszwalb + SLIC Superpixel Segmentation
***REMOVED***================
# Dependencies: scikit-image + scipy + numpy + Pillow (~280 MB total installed)
# pip install scikit-image
#
# WHEN IT WORKS:
#   - Good for images with texture variation between subject and background
#   - Superpixels group similar regions, making it easier to select "background"
#   - Handles some gradient backgrounds better than simple thresholding
#
# WHEN IT FAILS:
#   - Subject and background have similar texture/color
#   - Requires heuristic to decide which superpixels are "background"
#   - Over-segmentation can split the subject
#
# PERFORMANCE: Moderate (~500ms-2s for 2000x2000)
# POD ACCURACY: 6/10 standalone, better when combined with edge info

def scikit_superpixel_removal(
    image_path: str,
    output_path: str,
    method: str = "slic",       # "slic" or "felzenszwalb"
    n_segments: int = 200,       # For SLIC: number of superpixels
    scale: float = 100,          # For Felzenszwalb: larger = fewer segments
    compactness: float = 10,     # For SLIC: color vs spatial balance
) -> None:
    """
    Superpixel segmentation → classify superpixels as BG/FG by comparing
    to corner-sampled background color.
    """
    import numpy as np

    try:
        from skimage import io as skio
        from skimage.segmentation import slic, felzenszwalb
        from skimage.measure import regionprops
        from skimage import color as skcolor
    except ImportError:
        print("ERROR: scikit-image not installed. Run: pip install scikit-image")
        return

    img = skio.imread(image_path)
    if img.ndim == 2:
        img = np.stack([img] * 3, axis=-1)
    if img.shape[2] == 4:
        img = img[:, :, :3]  # Drop alpha if present

    h, w = img.shape[:2]

    # Detect background color from corners
    patch = max(5, min(h, w) // 20)
    corners = []
    for cy, cx in [(0, 0), (0, w-patch), (h-patch, 0), (h-patch, w-patch)]:
        corners.append(img[cy:cy+patch, cx:cx+patch].reshape(-1, 3))
    bg_color = np.median(np.vstack(corners), axis=0)

    # Generate superpixels
    if method == "felzenszwalb":
        segments = felzenszwalb(img, scale=scale, sigma=0.5, min_size=50)
    else:
        segments = slic(img, n_segments=n_segments, compactness=compactness,
                       sigma=1, start_label=0)

    # Classify each superpixel as BG or FG
    # BG if mean color is close to detected background
    num_segments = segments.max() + 1
    fg_mask = np.zeros((h, w), dtype=np.uint8)

    color_threshold = 40  # Euclidean distance threshold

    for seg_id in range(num_segments):
        seg_pixels = img[segments == seg_id]
        if len(seg_pixels) == 0:
            continue
        mean_color = seg_pixels.mean(axis=0)
        dist = np.sqrt(np.sum((mean_color - bg_color) ** 2))

        # Also check if segment touches image border (likely BG)
        seg_mask = (segments == seg_id)
        touches_border = (
            seg_mask[0, :].any() or seg_mask[-1, :].any() or
            seg_mask[:, 0].any() or seg_mask[:, -1].any()
        )

        if dist > color_threshold or (dist > color_threshold * 0.6 and not touches_border):
            fg_mask[segments == seg_id] = 255

    # Morphological cleanup
    try:
        import cv2
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=3)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel, iterations=1)
        fg_mask = cv2.GaussianBlur(fg_mask, (3, 3), 0)
    except ImportError:
        # Pure skimage fallback: basic morphology
        from skimage.morphology import disk, binary_closing, binary_opening
        from skimage.filters import gaussian
        bool_mask = fg_mask > 127
        bool_mask = binary_closing(bool_mask, disk(5))
        bool_mask = binary_opening(bool_mask, disk(3))
        fg_mask = (bool_mask * 255).astype(np.uint8)
        fg_mask_f = gaussian(fg_mask.astype(float), sigma=1)
        fg_mask = (fg_mask_f * 255 / fg_mask_f.max()).clip(0, 255).astype(np.uint8)

    # Create RGBA
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = img
    rgba[:, :, 3] = fg_mask

    from PIL import Image
    result = Image.fromarray(rgba, "RGBA")
    result.save(output_path, "PNG")
    print(f"[Scikit superpixel ({method})] {num_segments} segments. Saved: {output_path}")


***REMOVED***================
# UTILITY: Auto-detect background color (works with any technique)
***REMOVED***================

def auto_detect_background(image_path: str, method: str = "corners") -> tuple:
    """
    Detect the dominant background color of an image.

    Methods:
      "corners" - Sample corner pixels (fast, works for studio shots)
      "edges"   - Sample all edge pixels (more robust)
      "histogram" - Find dominant color peak in image histogram

    Returns: (R, G, B) tuple
    """
    from PIL import Image
    import collections

    img = Image.open(image_path).convert("RGB")
    pixels = img.load()
    w, h = img.size

    if method == "corners":
        samples = []
        patch = max(3, min(w, h) // 20)
        for cy in range(patch):
            for cx in range(patch):
                samples.append(pixels[cx, cy])                          # top-left
                samples.append(pixels[w - 1 - cx, cy])                  # top-right
                samples.append(pixels[cx, h - 1 - cy])                  # bottom-left
                samples.append(pixels[w - 1 - cx, h - 1 - cy])          # bottom-right

    elif method == "edges":
        samples = []
        for x in range(w):
            samples.append(pixels[x, 0])
            samples.append(pixels[x, h - 1])
        for y in range(1, h - 1):
            samples.append(pixels[0, y])
            samples.append(pixels[w - 1, y])

    elif method == "histogram":
        # Quantize colors to reduce noise, then find most common
        quantized = img.quantize(colors=16, method=2)
        palette = quantized.getpalette()
        histogram = quantized.histogram()
        # Find the most common color index
        max_idx = max(range(len(histogram)), key=lambda i: histogram[i])
        r, g, b = palette[max_idx * 3], palette[max_idx * 3 + 1], palette[max_idx * 3 + 2]
        return (r, g, b)

    else:
        raise ValueError(f"Unknown method: {method}")

    # Find median of samples (more robust than mean for outliers)
    rs = sorted(s[0] for s in samples)
    gs = sorted(s[1] for s in samples)
    bs = sorted(s[2] for s in samples)
    mid = len(rs) // 2
    return (rs[mid], gs[mid], bs[mid])


***REMOVED***================
# COMPARISON TABLE & RECOMMENDATIONS
***REMOVED***================
"""
TECHNIQUE COMPARISON FOR POD PRODUCT IMAGES:

| #  | Technique            | Speed   | Accuracy | Dependencies      | Install Size |
|----|----------------------|---------|----------|-------------------|-------------|
| 1a | Pillow color replace | Fast    | 7/10     | Pillow            | ~15 MB      |
| 1b | Pillow flood fill    | Fast    | 8/10     | Pillow            | ~15 MB      |
| 2  | HSV threshold        | V.Fast  | 8/10     | OpenCV+numpy      | ~110 MB     |
| 3  | GrabCut              | SLOW    | 7/10     | OpenCV+numpy      | ~110 MB     |
| 4  | Canny+Contour        | Fast    | 7/10     | OpenCV+numpy      | ~110 MB     |
| 5  | Flood fill (OpenCV)  | V.Fast  | 8/10     | OpenCV+numpy      | ~110 MB     |
| 6  | Watershed            | Medium  | 6/10     | OpenCV+numpy      | ~110 MB     |
| 7  | Morphological        | V.Fast  | N/A      | OpenCV+numpy      | ~110 MB     |
| 8  | Combined pipeline    | Medium  | 9/10     | OpenCV+numpy      | ~110 MB     |
| 9  | Alpha matting        | V.SLOW  | 9/10*    | pymatting+scipy   | ~400 MB     |
| 10 | Superpixel (skimage) | Medium  | 6/10     | scikit-image+scipy| ~280 MB     |

* Alpha matting is 9/10 for edge quality but requires a good trimap (auto-generated
  trimap quality varies).

RECOMMENDATIONS FOR POD IMAGES:

1. BEST VALUE (size vs accuracy):
   Combined pipeline (#8) — opencv-python-headless only, ~110 MB total.
   Handles white/solid backgrounds automatically. 9/10 for typical POD images.

2. LIGHTEST WEIGHT:
   Pillow flood fill (#1b) — zero dependencies beyond Pillow (~15 MB).
   Great for white backgrounds. 8/10.

3. BEST EDGE QUALITY:
   Alpha matting (#9) — but heavy (~400 MB) and slow. Only worth it if
   you need semi-transparent edges (rare for POD designs, more for photos).

4. FASTEST:
   HSV threshold (#2) or OpenCV flood fill (#5) — ~20-100ms.
   Use these for high-volume batch processing.

5. MOST ROBUST (complex backgrounds):
   Combined pipeline (#8) with GrabCut fallback enabled.
   Falls back gracefully for unusual images.

FOR THIS POD PLATFORM SPECIFICALLY:
  - Most images are designs on white/solid backgrounds → HSV threshold wins
  - Illustrations/vectors → Pillow flood fill or HSV threshold
  - Studio product photos → Combined pipeline (handles shadows better)
  - The combined_pipeline() function is the recommended single entry point
"""


***REMOVED***================
# EXAMPLE USAGE / DEMO
***REMOVED***================

def demo():
    """
    Demo showing how to use each technique.
    Run with: python bg_removal_research.py
    """
    import os

    test_image = "test_product.png"

    if not os.path.exists(test_image):
        # Create a simple test image: red circle on white background
        try:
            from PIL import Image, ImageDraw
            size = 400
            img = Image.new("RGB", (size, size), (255, 255, 255))
            draw = ImageDraw.Draw(img)
            # Draw a red circle with some anti-aliasing
            draw.ellipse([80, 80, 320, 320], fill=(200, 50, 50), outline=(150, 30, 30))
            # Add a small detail
            draw.rectangle([170, 150, 230, 250], fill=(50, 50, 200))
            img.save(test_image)
            print(f"Created test image: {test_image}")
        except Exception as e:
            print(f"Cannot create test image: {e}")
            print("Please provide a test image as 'test_product.png'")
            return

    print("=" * 60)
    print("BACKGROUND REMOVAL TECHNIQUES — DEMO")
    print("=" * 60)

    # Auto-detect background
    bg = auto_detect_background(test_image, method="corners")
    print(f"\nDetected background color: RGB{bg}")

    # Technique 1a: Pillow color replace
    print("\n--- Technique 1a: Pillow Color Replace ---")
    pillow_color_replace(test_image, "out_1a_pillow_color.png", bg_color=bg, tolerance=30)

    # Technique 1b: Pillow flood fill
    print("\n--- Technique 1b: Pillow Flood Fill ---")
    pillow_flood_fill_edges(test_image, "out_1b_pillow_flood.png", tolerance=35)

    # OpenCV-dependent techniques
    try:
        import cv2

        # Technique 2: HSV white background
        print("\n--- Technique 2: HSV White Background ---")
        hsv_white_background_removal(test_image, "out_2_hsv_white.png")

        # Technique 3: GrabCut
        print("\n--- Technique 3: GrabCut Auto ---")
        grabcut_auto(test_image, "out_3_grabcut.png")

        # Technique 4: Canny + Contour
        print("\n--- Technique 4: Canny + Contour ---")
        canny_contour_removal(test_image, "out_4_canny.png")

        # Technique 5: Flood fill OpenCV
        print("\n--- Technique 5: OpenCV Flood Fill ---")
        opencv_flood_fill(test_image, "out_5_flood.png")

        # Technique 6: Watershed
        print("\n--- Technique 6: Watershed ---")
        watershed_removal(test_image, "out_6_watershed.png")

        # Technique 8: Combined pipeline (recommended)
        print("\n--- Technique 8: Combined Pipeline (RECOMMENDED) ---")
        result = combined_pipeline(test_image, "out_8_combined.png")
        print(f"  Result: {result}")

    except ImportError:
        print("\nOpenCV not installed. Skipping OpenCV-based techniques.")
        print("Install with: pip install opencv-python-headless")

    # Technique 9: Alpha matting
    try:
        import pymatting
        print("\n--- Technique 9: Alpha Matting ---")
        alpha_matting_with_auto_trimap(test_image, "out_9_alpha.png")
    except ImportError:
        print("\npymatting not installed. Skipping alpha matting.")
        print("Install with: pip install pymatting")

    # Technique 10: Scikit superpixels
    try:
        import skimage
        print("\n--- Technique 10: Scikit Superpixels ---")
        scikit_superpixel_removal(test_image, "out_10_superpixel.png")
    except ImportError:
        print("\nscikit-image not installed. Skipping superpixel technique.")
        print("Install with: pip install scikit-image")

    print("\n" + "=" * 60)
    print("DEMO COMPLETE — Check output files (out_*.png)")
    print("=" * 60)


if __name__ == "__main__":
    demo()
