#!/usr/bin/env python3
import json
with open("/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240556633.txt", 'r') as f:
    data = json.load(f)
inner = json.loads(data[0]['text'])
with open("/tmp/image1.json", 'w') as f:
    json.dump({"mime_type": inner['mime_type'], "image_base64": inner['image_base64']}, f)
print("Extracted to /tmp/image1.json")
