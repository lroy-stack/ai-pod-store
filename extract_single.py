#!/usr/bin/env python3
"""Extract single image data."""
import json
import sys

file_path = sys.argv[1]

with open(file_path, 'r') as f:
    data = json.load(f)

# Structure: [{"type": "text", "text": "{...json...}"}]
text_content = data[0]['text']
inner_data = json.loads(text_content)

# Output just what we need
output = {
    'mime_type': inner_data['mime_type'],
    'image_base64': inner_data['image_base64']
}

# Write to temp file to avoid stdout size limits
output_file = sys.argv[2] if len(sys.argv) > 2 else '/tmp/image_data.json'
with open(output_file, 'w') as f:
    json.dump(output, f)

print(f"Data extracted to {output_file}")
print(f"MIME type: {output['mime_type']}")
print(f"Base64 length: {len(output['image_base64'])} chars")
