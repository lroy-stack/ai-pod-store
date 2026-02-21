#!/usr/bin/env python3
"""
This script reads Gemini JSON files and outputs the extraction results.
The extracted data can then be used to call the Supabase upload MCP tool.
"""
import json
import sys

# File mappings
IMAGES = [
    {
        "input": "/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240556633.txt",
        "filename": "design-fire-001.png",
        "desc": "fire/flames design"
    },
    {
        "input": "/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240591085.txt",
        "filename": "design-skull-001.png",
        "desc": "skull design"
    },
    {
        "input": "/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240619094.txt",
        "filename": "design-abstract-fusion-001.png",
        "desc": "abstract fusion"
    },
    {
        "input": "/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240646634.txt",
        "filename": "design-nature-001.png",
        "desc": "nature/mountains"
    },
    {
        "input": "/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240673339.txt",
        "filename": "design-data-viz-001.png",
        "desc": "data/graphics"
    },
]

def main():
    """Extract data from all files."""
    results = []

    for img in IMAGES:
        try:
            # Read and parse the Gemini JSON file
            with open(img["input"], 'r') as f:
                data = json.load(f)

            # Extract the inner JSON from the text field
            text_content = data[0]['text']
            inner_data = json.loads(text_content)

            # Store the results
            result = {
                "filename": img["filename"],
                "desc": img["desc"],
                "mime_type": inner_data['mime_type'],
                "image_base64": inner_data['image_base64'],
                "base64_length": len(inner_data['image_base64'])
            }
            results.append(result)

            print(f"✓ {img['filename']}: {result['mime_type']}, {result['base64_length']} chars", file=sys.stderr)

        except Exception as e:
            print(f"✗ Error processing {img['filename']}: {e}", file=sys.stderr)
            sys.exit(1)

    # Output results as JSON
    print(json.dumps(results))

if __name__ == "__main__":
    main()
