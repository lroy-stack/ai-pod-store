#!/usr/bin/env python3
import json

# Quick extraction to get mime_type from each file
files = [
    "/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240556633.txt",
    "/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240591085.txt",
    "/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240619094.txt",
    "/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240646634.txt",
    "/Users/lr0y/.claude/projects/-Users-lr0y-POD-AI-PDR-pod-agent-harness-pod-workspace/089d6f79-e5f9-4d98-8ebe-1498121dc017/tool-results/mcp-gemini-gemini_generate_image-1771240673339.txt",
]

filenames = [
    "design-fire-001.png",
    "design-skull-001.png",
    "design-abstract-fusion-001.png",
    "design-nature-001.png",
    "design-data-viz-001.png",
]

for f, name in zip(files, filenames):
    with open(f, 'r') as file:
        data = json.load(file)
        inner = json.loads(data[0]['text'])
        print(f"{name}: {inner['mime_type']}, {len(inner['image_base64'])} chars")
