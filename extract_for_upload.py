#!/usr/bin/env python3
"""Extract image data and prepare for Supabase upload."""
import json

# Input files and output filenames
FILES = [
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240556633.txt", "design-fire-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240591085.txt", "design-skull-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240619094.txt", "design-abstract-fusion-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240646634.txt", "design-nature-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240673339.txt", "design-data-viz-001.png"),
]

# Extract and print data for each file
for input_file, filename in FILES:
    with open(input_file, 'r') as f:
        data = json.load(f)

    # Parse inner JSON
    inner = json.loads(data[0]['text'])

    # Print in format: filename|mime_type|base64_data
    print(f"FILE: {filename}")
    print(f"MIME: {inner['mime_type']}")
    print(f"BASE64_START")
    print(inner['image_base64'])
    print(f"BASE64_END")
    print("---")
