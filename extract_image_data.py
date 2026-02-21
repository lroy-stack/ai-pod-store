#!/usr/bin/env python3
"""Extract base64 image data from Gemini JSON files."""
import json
import sys
import re

def extract_image_data(file_path):
    """Extract mime_type and image_base64 from a Gemini response file."""
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)

        # The structure is an array with one object
        if isinstance(data, list) and len(data) > 0:
            text_content = data[0].get('text', '')

            # The text field contains a JSON string with mime_type and image_base64
            # Parse it as JSON
            try:
                inner_data = json.loads(text_content)
                mime_type = inner_data.get('mime_type')
                image_base64 = inner_data.get('image_base64')

                if mime_type and image_base64:
                    return {'mime_type': mime_type, 'image_base64': image_base64}
            except json.JSONDecodeError:
                # If it's not valid JSON, try regex extraction
                mime_match = re.search(r'"mime_type":\s*"([^"]+)"', text_content)
                # For base64, we need to handle it might be very long
                base64_match = re.search(r'"image_base64":\s*"([^"]+)"', text_content, re.DOTALL)

                if mime_match and base64_match:
                    return {
                        'mime_type': mime_match.group(1),
                        'image_base64': base64_match.group(1)
                    }

        return None
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: extract_image_data.py <file_path>")
        sys.exit(1)

    result = extract_image_data(sys.argv[1])
    if result:
        # Output only the critical info
        print(json.dumps(result))
    else:
        sys.exit(1)
