#!/usr/bin/env python3
"""Extract variant IDs from the saved Printify variants response."""
import json
import sys

# Read the variants file for blueprint 6, provider 26
file_path = '/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/be5a70eb-2202-4128-9e7b-9b649e868e85/tool-results/mcp-printify-printify_get_variants-1771266321626.txt'

try:
    with open(file_path, 'r') as f:
        data = json.load(f)

    # Parse the nested JSON structure
    variants_json = json.loads(data[0]['text'])

    # Extract all variants
    all_variants = variants_json.get('variants', [])

    # Filter for desired colors and sizes
    desired_colors = {'White', 'Black', 'Navy', 'Heather Grey'}
    desired_sizes = {'S', 'M', 'L', 'XL', '2XL'}

    filtered = []
    for v in all_variants:
        opts = v.get('options', {})
        color = opts.get('color', '')
        size = opts.get('size', '')

        if color in desired_colors and size in desired_sizes:
            filtered.append({
                'id': v['id'],
                'title': v.get('title', ''),
                'color': color,
                'size': size
            })

    # Print results
    print(f"Total variants available: {len(all_variants)}")
    print(f"Matching our criteria: {len(filtered)}\n")

    # Group by color
    by_color = {}
    for v in filtered:
        if v['color'] not in by_color:
            by_color[v['color']] = []
        by_color[v['color']].append(v)

    # Print organized by color
    size_order = ['S', 'M', 'L', 'XL', '2XL']
    for color in desired_colors:
        if color in by_color:
            print(f"{color}:")
            for v in sorted(by_color[color], key=lambda x: size_order.index(x['size'])):
                print(f"  {v['id']} - {v['size']}")

    # Print all IDs as a simple comma-separated list
    all_ids = [str(v['id']) for v in filtered]
    print(f"\n\nAll variant IDs (comma-separated):")
    print(','.join(all_ids))

    # Print as JSON array for direct use
    print(f"\n\nAs JSON array:")
    print(json.dumps([v['id'] for v in filtered]))

    # Save to a simple file
    with open('/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/bp6_variant_ids.txt', 'w') as f:
        f.write(','.join(all_ids))

    print(f"\n\nSaved to bp6_variant_ids.txt")

except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc()
    sys.exit(1)
