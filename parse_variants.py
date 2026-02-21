#!/usr/bin/env python3
import json
import sys

# Read the file
with open('/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/be5a70eb-2202-4128-9e7b-9b649e868e85/tool-results/mcp-printify-printify_get_variants-1771266321626.txt', 'r') as f:
    data = json.load(f)

# Extract variants from the response
if isinstance(data, list) and len(data) > 0:
    text_content = data[0].get('text', '')
    variants_data = json.loads(text_content)

    # Filter for desired colors and sizes
    desired_colors = ['White', 'Black', 'Navy', 'Heather Grey']
    desired_sizes = ['S', 'M', 'L', 'XL', '2XL']

    filtered_variants = []
    for variant in variants_data.get('variants', []):
        options = variant.get('options', {})
        color = options.get('color', '')
        size = options.get('size', '')

        if color in desired_colors and size in desired_sizes:
            filtered_variants.append({
                'id': variant['id'],
                'title': variant['title'],
                'color': color,
                'size': size
            })

    # Sort by color and size
    color_order = {c: i for i, c in enumerate(desired_colors)}
    size_order = {s: i for i, s in enumerate(desired_sizes)}

    filtered_variants.sort(key=lambda v: (color_order.get(v['color'], 999), size_order.get(v['size'], 999)))

    # Print results
    print(f"Found {len(filtered_variants)} matching variants:")
    for v in filtered_variants:
        print(f"  ID: {v['id']:5d} - {v['color']:15s} - {v['size']:4s}")

    # Print JSON for use in API call
    print("\n\nVariant IDs for API:")
    print(json.dumps([v['id'] for v in filtered_variants]))

    # Print variant configs for API
    print("\n\nVariant configs for API:")
    print(json.dumps([{"id": v['id'], "price": 2999, "is_enabled": True} for v in filtered_variants], indent=2))
