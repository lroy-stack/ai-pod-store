#!/bin/bash
# Security Audit: Check for hardcoded secrets in source code
# Usage: ./scripts/audit-secrets.sh
# Exit code: 0 if clean, 1 if secrets found

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🔍 Auditing source code for hardcoded secrets..."
echo ""

FOUND_ISSUES=0

# Common file patterns to include
FILE_PATTERNS="--include=*.ts --include=*.tsx --include=*.js --include=*.jsx --include=*.py"
EXCLUDE_DIRS="--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=__pycache__ --exclude-dir=.git"

# 1. Stripe API keys (test and live)
echo "Checking for Stripe API keys..."
if grep -rE "(sk_test_|sk_live_|pk_test_[a-zA-Z0-9]{99}|pk_live_[a-zA-Z0-9]{99})" $FILE_PATTERNS $EXCLUDE_DIRS frontend/ admin/ podclaw/ 2>/dev/null | grep -v "process.env" | grep -v "your-"; then
    echo "❌ FOUND: Hardcoded Stripe keys"
    FOUND_ISSUES=1
else
    echo "✓ No Stripe keys found"
fi
echo ""

# 2. Anthropic API keys
echo "Checking for Anthropic API keys..."
if grep -r "sk-ant-api" $FILE_PATTERNS $EXCLUDE_DIRS frontend/ admin/ podclaw/ 2>/dev/null | grep -v "process.env"; then
    echo "❌ FOUND: Hardcoded Anthropic keys"
    FOUND_ISSUES=1
else
    echo "✓ No Anthropic keys found"
fi
echo ""

# 3. JWT tokens (eyJ base64 pattern)
echo "Checking for JWT tokens..."
if grep -rE 'eyJ[A-Za-z0-9_-]{30,}' $FILE_PATTERNS $EXCLUDE_DIRS frontend/ admin/ podclaw/ 2>/dev/null | grep -v "process.env" | grep -v "example" | grep -v "//"; then
    echo "❌ FOUND: Hardcoded JWT tokens"
    FOUND_ISSUES=1
else
    echo "✓ No JWT tokens found"
fi
echo ""

# 4. Google API keys
echo "Checking for Google API keys..."
if grep -rE "AIza[0-9A-Za-z_-]{35}" $FILE_PATTERNS $EXCLUDE_DIRS frontend/ admin/ podclaw/ 2>/dev/null; then
    echo "❌ FOUND: Hardcoded Google API keys"
    FOUND_ISSUES=1
else
    echo "✓ No Google API keys found"
fi
echo ""

# 5. Resend API keys
echo "Checking for Resend API keys..."
if grep -rE "re_[a-zA-Z0-9]{24}" $FILE_PATTERNS $EXCLUDE_DIRS frontend/ admin/ podclaw/ 2>/dev/null; then
    echo "❌ FOUND: Hardcoded Resend API keys"
    FOUND_ISSUES=1
else
    echo "✓ No Resend API keys found"
fi
echo ""

# 6. Database URLs with credentials
echo "Checking for database URLs with credentials..."
if grep -rE "(postgresql|postgres|mysql)://[^/]+:[^@]+@" $FILE_PATTERNS $EXCLUDE_DIRS frontend/ admin/ podclaw/ 2>/dev/null | grep -v "process.env" | grep -v "example"; then
    echo "❌ FOUND: Hardcoded database URLs"
    FOUND_ISSUES=1
else
    echo "✓ No database URLs with credentials found"
fi
echo ""

# 7. Generic API keys and secrets
echo "Checking for generic API keys..."
if grep -rE "(api_key|apiKey|API_KEY|secret_key|SECRET_KEY).*=.*['\"][a-zA-Z0-9_-]{20,}" $FILE_PATTERNS $EXCLUDE_DIRS frontend/ admin/ podclaw/ 2>/dev/null | grep -v "process.env" | grep -v "os.getenv" | grep -v "your-" | grep -v "example" | grep -v "placeholder"; then
    echo "❌ FOUND: Hardcoded API keys or secrets"
    FOUND_ISSUES=1
else
    echo "✓ No generic API keys found"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FOUND_ISSUES -eq 0 ]; then
    echo "✅ Security audit PASSED: No hardcoded secrets found"
    exit 0
else
    echo "❌ Security audit FAILED: Hardcoded secrets detected"
    echo ""
    echo "Action required:"
    echo "1. Move all secrets to .env.local files"
    echo "2. Use process.env.VARIABLE_NAME to access secrets"
    echo "3. Ensure .env.local is in .gitignore"
    echo "4. If secrets were committed, rotate them immediately"
    exit 1
fi
