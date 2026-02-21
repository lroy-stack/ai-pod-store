#!/bin/bash
# Extract image data from Gemini JSON files

python3 << 'EOF'
import json
import os

files = [
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240556633.txt", "design-fire-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240591085.txt", "design-skull-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240619094.txt", "design-abstract-fusion-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240646634.txt", "design-nature-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240673339.txt", "design-data-viz-001.png"),
]

os.makedirs("/tmp/image_uploads", exist_ok=True)

for idx, (input_file, filename) in enumerate(files, 1):
    with open(input_file, 'r') as f:
        data = json.load(f)

    inner = json.loads(data[0]['text'])

    output_file = f"/tmp/image_uploads/image_{idx}.json"
    with open(output_file, 'w') as f:
        json.dump({
            "filename": filename,
            "mime_type": inner['mime_type'],
            "image_base64": inner['image_base64']
        }, f)

    print(f"Extracted {filename} -> {output_file} ({len(inner['image_base64'])} chars)")

print("\nAll files extracted to /tmp/image_uploads/")
EOF
