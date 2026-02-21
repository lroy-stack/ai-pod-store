#!/usr/bin/env python3
"""Process Gemini-generated images and extract base64 data."""
import json
import sys

# File mappings: (input_file, output_filename)
FILES = [
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240556633.txt", "design-fire-001.png", "fire/flames design"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240591085.txt", "design-skull-001.png", "skull design"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240619094.txt", "design-abstract-fusion-001.png", "abstract fusion"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240646634.txt", "design-nature-001.png", "nature/mountains"),
    ("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240673339.txt", "design-data-viz-001.png", "data/graphics"),
]

def extract_from_file(file_path):
    """Extract mime_type and image_base64 from Gemini JSON file."""
    with open(file_path, 'r') as f:
        data = json.load(f)

    # Structure: [{"type": "text", "text": "{...json...}"}]
    if isinstance(data, list) and len(data) > 0 and data[0].get('type') == 'text':
        text_content = data[0]['text']

        # Parse the inner JSON
        inner_data = json.loads(text_content)

        return {
            'mime_type': inner_data['mime_type'],
            'image_base64': inner_data['image_base64']
        }

    raise ValueError(f"Unexpected JSON structure in {file_path}")

def main():
    """Process all files and output results."""
    results = []

    for input_file, output_filename, description in FILES:
        try:
            print(f"Processing {description}...", file=sys.stderr)
            data = extract_from_file(input_file)

            results.append({
                'filename': output_filename,
                'description': description,
                'mime_type': data['mime_type'],
                'image_base64': data['image_base64'][:100] + '...',  # truncate for display
                'base64_length': len(data['image_base64']),
                'full_base64': data['image_base64']  # keep full for actual upload
            })

            print(f"  ✓ Extracted {len(data['image_base64'])} chars of base64 data", file=sys.stderr)

        except Exception as e:
            print(f"  ✗ Error: {e}", file=sys.stderr)
            sys.exit(1)

    # Output as JSON for programmatic use
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
