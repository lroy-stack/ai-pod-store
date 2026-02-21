#!/usr/bin/env python3
"""Extract all Gemini images and save metadata."""
import json
import os

FILES = [
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240556633.txt", "design-fire-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240591085.txt", "design-skull-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240619094.txt", "design-abstract-fusion-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240646634.txt", "design-nature-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240673339.txt", "design-data-viz-001.png"),
]

output_dir = "/tmp/gemini_extracts"
os.makedirs(output_dir, exist_ok=True)

results = []

for input_file, output_filename in FILES:
    print(f"Processing {output_filename}...")

    with open(input_file, 'r') as f:
        data = json.load(f)

    # Extract inner JSON
    text_content = data[0]['text']
    inner_data = json.loads(text_content)

    # Save to individual file
    output_path = os.path.join(output_dir, output_filename.replace('.png', '.json'))
    with open(output_path, 'w') as f:
        json.dump(inner_data, f)

    results.append({
        'filename': output_filename,
        'mime_type': inner_data['mime_type'],
        'json_path': output_path,
        'base64_length': len(inner_data['image_base64'])
    })

    print(f"  Saved to {output_path} ({len(inner_data['image_base64'])} chars)")

# Save summary
summary_path = os.path.join(output_dir, 'summary.json')
with open(summary_path, 'w') as f:
    json.dump(results, f, indent=2)

print(f"\nSummary saved to {summary_path}")
print(json.dumps(results, indent=2))
