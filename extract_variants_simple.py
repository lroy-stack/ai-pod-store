#!/usr/bin/env python3
import json
import sys

# Read the variant file
file_path = '/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/be5a70eb-2202-4128-9e7b-9b649e868e85/tool-results/mcp-printify-printify_get_variants-1771266321626.txt'

with open(file_path, 'r') as f:
    data = json.load(f)

# The data is a list with one item containing the text
variants_json = json.loads(data[0]['text'])

# Filter for White, Black, Navy, Heather Grey in sizes S, M, L, XL, 2XL
desired_colors = ['White', 'Black', 'Navy', 'Heather Grey']
desired_sizes = ['S', 'M', 'L', 'XL', '2XL']

matching = []
for v in variants_json['variants']:
    opts = v.get('options', {})
    color = opts.get('color', '')
    size = opts.get('size', '')

    if color in desired_colors and size in desired_sizes:
        matching.append({
            'id': v['id'],
            'color': color,
            'size': size,
            'title': v.get('title', '')
        })

print(f"Found {len(matching)} matching variants\n")

# Group by color
by_color = {}
for m in matching:
    if m['color'] not in by_color:
        by_color[m['color']] = []
    by_color[m['color']].append(m)

# Print grouped
for color in desired_colors:
    if color in by_color:
        print(f"\n{color}:")
        for v in sorted(by_color[color], key=lambda x: desired_sizes.index(x['size'])):
            print(f"  {v['id']:6d} - {v['size']:4s} - {v['title']}")

# Print all IDs as JSON
print("\n\nAll variant IDs:")
all_ids = [m['id'] for m in matching]
print(json.dumps(all_ids))

# Print variant config
print("\n\nVariant config:")
print(json.dumps([{"id": m['id'], "price": 2999, "is_enabled": True} for m in matching], indent=2))
