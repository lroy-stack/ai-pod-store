#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "=== Admin Panel: Installing dependencies ==="
npm install

echo "=== Admin Panel: Ready on port 3001 ==="
echo "Run 'npm run dev' to start the admin panel"
