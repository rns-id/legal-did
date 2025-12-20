#!/bin/bash

echo "🔐 Security Check Script"
echo "========================"
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "✅ .env file exists"
else
    echo "❌ .env file not found"
    echo "   Run: cp .env.example .env"
    exit 1
fi

# Check if .env is in .gitignore
if grep -q "^\.env$" .gitignore; then
    echo "✅ .env is in .gitignore"
else
    echo "❌ .env is NOT in .gitignore"
    echo "   This is a security risk!"
    exit 1
fi

# Check if .env is ignored by git
if git check-ignore .env > /dev/null 2>&1; then
    echo "✅ .env is ignored by git"
else
    echo "❌ .env is NOT ignored by git"
    echo "   This is a security risk!"
    exit 1
fi

# Check if .env is staged or committed
if git ls-files --error-unmatch .env > /dev/null 2>&1; then
    echo "❌ WARNING: .env is tracked by git!"
    echo "   Run: git rm --cached .env"
    exit 1
else
    echo "✅ .env is not tracked by git"
fi

# Check for hardcoded private keys in source files
echo ""
echo "Checking for hardcoded private keys..."
HARDCODED_KEYS=$(grep -r "PRIVATE_KEY.*=.*['\"][0-9a-fA-F]\{40,\}" --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null || true)

if [ -n "$HARDCODED_KEYS" ]; then
    echo "❌ WARNING: Found potential hardcoded private keys:"
    echo "$HARDCODED_KEYS"
    exit 1
else
    echo "✅ No hardcoded private keys found"
fi

echo ""
echo "🎉 All security checks passed!"
echo ""
echo "Remember:"
echo "  - Never commit .env file"
echo "  - Never hardcode private keys"
echo "  - Use test wallets for development"
echo "  - Rotate keys regularly"
