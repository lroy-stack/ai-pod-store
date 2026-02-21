#!/usr/bin/env python3
import json
import sys

# File mappings
files = [
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240556633.txt", "design-fire-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240591085.txt", "design-skull-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240619094.txt", "design-abstract-fusion-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240646634.txt", "design-nature-001.png"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240673339.txt", "design-data-viz-001.png"),
]

# Extract data from each file
for file_path, filename in files:
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)

        # The structure is an array with one object containing the text with mime_type and base64
        if isinstance(data, list) and len(data) > 0:
            text_content = data[0].get('text', '')

            # Parse the embedded JSON in the text field
            if 'mime_type' in text_content and 'image_base64' in text_content:
                # Extract mime_type and image_base64 from the text
                import re
                mime_match = re.search(r'"mime_type":\s*"([^"]+)"', text_content)

                # Find the base64 data - it's between "image_base64": " and the next "
                base64_match = re.search(r'"image_base64":\s*"([^"]+)"', text_content)

                if mime_match and base64_match:
                    mime_type = mime_match.group(1)
                    image_base64 = base64_match.group(1)
                    print(f"{filename}|{mime_type}|{len(image_base64)}")
                else:
                    print(f"ERROR: Could not extract data from {filename}", file=sys.stderr)
            else:
                print(f"ERROR: Unexpected format in {filename}", file=sys.stderr)
        else:
            print(f"ERROR: Unexpected JSON structure in {filename}", file=sys.stderr)

    except Exception as e:
        print(f"ERROR reading {filename}: {e}", file=sys.stderr)
