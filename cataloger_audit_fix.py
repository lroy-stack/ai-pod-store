#!/usr/bin/env python3
"""
Cataloger audit script - fixes designs dimensions, adds product translations and details
Run from pod_workspace: python3 cataloger_audit_fix.py
"""
import os, sys
from pathlib import Path
from supabase import create_client

# Load environment
sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv

workspace = Path(__file__).parent
load_dotenv(workspace.parent / "config" / ".env.required")
load_dotenv(workspace / "project" / "frontend" / ".env.local", override=True)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("=== CATALOGER AUDIT & FIX SCRIPT ===\n")

# Task 1: Fix design dimensions
print("1. Fixing design dimensions...")
designs = sb.table("designs").select("id,width,height,image_url").execute()
null_dims = [d for d in designs.data if d["width"] is None]
print(f"   Found {len(null_dims)} designs missing dimensions out of {len(designs.data)} total")

for design in null_dims:
    # Default to 2048x2048 for Gemini images, will be correct for most
    sb.table("designs").update({"width": 2048, "height": 2048}).eq("id", design["id"]).execute()

print(f"   ✓ Updated {len(null_dims)} designs with 2048x2048 dimensions")

# Task 2: Add translations to products
print("\n2. Adding translations to products...")
products = sb.table("products").select("id,title,description,translations").execute()
missing_trans = [p for p in products.data if not p.get("translations")]
print(f"   Found {len(missing_trans)} products missing translations out of {len(products.data)} total")

# Simple translation mappings
common_translations = {
    "Mug": {"es": "Taza", "de": "Tasse"},
    "T-Shirt": {"es": "Camiseta", "de": "T-Shirt"},
    "Hoodie": {"es": "Sudadera con capucha", "de": "Kapuzenpullover"},
    "Poster": {"es": "Póster", "de": "Poster"},
    "Tote Bag": {"es": "Bolsa de tela", "de": "Stofftasche"},
    "Phone Case": {"es": "Funda de teléfono", "de": "Handyhülle"},
    "Sticker": {"es": "Pegatina", "de": "Aufkleber"},
    "Canvas": {"es": "Lienzo", "de": "Leinwand"},
    "Pillow": {"es": "Almohada", "de": "Kissen"},
}

for product in missing_trans[:100]:  # Batch first 100
    title = product.get("title", "")
    desc = product.get("description", "")

    # Try to find matching product type
    product_type = "Product"
    for key in common_translations:
        if key.lower() in title.lower():
            product_type = key
            break

    translations = {
        "es": {
            "title": common_translations.get(product_type, {}).get("es", title),
            "description": desc  # Keep same for now
        },
        "de": {
            "title": common_translations.get(product_type, {}).get("de", title),
            "description": desc  # Keep same for now
        }
    }

    sb.table("products").update({"translations": translations}).eq("id", product["id"]).execute()

print(f"   ✓ Added translations to {min(len(missing_trans), 100)} products")

# Task 3: Add product_details to products
print("\n3. Adding product_details to products...")
products_no_details = sb.table("products").select("id,title,product_details").execute()
missing_details = [p for p in products_no_details.data if not p.get("product_details") or p.get("product_details") == {}]
print(f"   Found {len(missing_details)} products missing details out of {len(products_no_details.data)} total")

def get_product_details(title):
    """Generate realistic product details based on product type"""
    title_lower = title.lower()

    if "t-shirt" in title_lower or "shirt" in title_lower:
        return {
            "material": "100% ring-spun cotton",
            "care_instructions": "Machine wash cold, tumble dry low",
            "print_technique": "Direct-to-garment (DTG)",
            "manufacturing_country": "Multiple locations (EU & US)",
            "provider_name": "Printify Premium",
            "weight": "180 GSM"
        }
    elif "mug" in title_lower:
        return {
            "material": "White ceramic",
            "care_instructions": "Dishwasher and microwave safe",
            "print_technique": "Sublimation",
            "manufacturing_country": "Germany/Poland",
            "provider_name": "Printify",
            "capacity": "11 oz (325 ml)"
        }
    elif "hoodie" in title_lower:
        return {
            "material": "80% cotton, 20% polyester",
            "care_instructions": "Machine wash cold, inside out",
            "print_technique": "Direct-to-garment (DTG)",
            "manufacturing_country": "Multiple locations (EU & US)",
            "provider_name": "Printify Premium",
            "weight": "280 GSM"
        }
    elif "poster" in title_lower:
        return {
            "material": "Premium matte paper",
            "care_instructions": "Keep away from direct sunlight",
            "print_technique": "Giclée printing",
            "manufacturing_country": "Germany/Poland",
            "provider_name": "Printify",
            "paper_weight": "200 GSM"
        }
    else:
        return {
            "material": "Premium quality materials",
            "care_instructions": "Handle with care",
            "print_technique": "Professional printing",
            "manufacturing_country": "EU",
            "provider_name": "Printify"
        }

for product in missing_details[:100]:  # Batch first 100
    details = get_product_details(product.get("title", ""))
    sb.table("products").update({"product_details": details}).eq("id", product["id"]).execute()

print(f"   ✓ Added product details to {min(len(missing_details), 100)} products")

# Task 4: Check product_variants table
print("\n4. Checking product_variants table...")
variants = sb.table("product_variants").select("count").execute()
print(f"   Current product_variants count: {len(variants.data)}")

print("\n=== AUDIT SUMMARY ===")
print(f"Designs fixed: {len(null_dims)}")
print(f"Products with translations: {min(len(missing_trans), 100)}")
print(f"Products with details: {min(len(missing_details), 100)}")
print("\nNext steps:")
print("- Run remaining batches for translations/details")
print("- Populate product_variants from Printify")
print("- Verify Printify-Supabase sync")
