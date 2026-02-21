#!/usr/bin/env python3
import json

file_path = '/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/be5a70eb-2202-4128-9e7b-9b649e868e85/tool-results/mcp-printify-printify_get_variants-1771266321626.txt'

with open(file_path, 'r') as f:
    data = json.load(f)

variants_json = json.loads(data[0]['text'])

# Filter variants
desired_colors = ['White', 'Black', 'Navy', 'Heather Grey']
desired_sizes = ['S', 'M', 'L', 'XL', '2XL']

variant_ids = []
for v in variants_json['variants']:
    opts = v.get('options', {})
    color = opts.get('color', '')
    size = opts.get('size', '')
    if color in desired_colors and size in desired_sizes:
        variant_ids.append(v['id'])

# Save to a simple text file
with open('/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/variant_ids.txt', 'w') as f:
    f.write(','.join(map(str, variant_ids)))

print(f"Saved {len(variant_ids)} variant IDs to variant_ids.txt")
