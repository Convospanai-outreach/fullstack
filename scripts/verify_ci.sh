#!/bin/bash
set -e

echo "=========================================="
echo "Phi-3 Micro-LLM CI Verification"
echo "=========================================="

# Build verification image
echo ""
echo "Building verification Docker image..."
docker build -f docker/Dockerfile.verify -t convospan-verify:latest .

# Check build result
if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✓ VERIFICATION PASSED"
    echo "=========================================="
    exit 0
else
    echo ""
    echo "=========================================="
    echo "✗ VERIFICATION FAILED"
    echo "=========================================="
    exit 1
fi
