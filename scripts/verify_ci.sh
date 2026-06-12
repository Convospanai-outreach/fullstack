#!/bin/bash
# ==============================================================================
# PHI-3 MICRO-LLM CI VERIFICATION SCRIPT
#
# PURPOSE: Build and run verification in Docker
# GUARANTEE: Exit non-zero on ANY failure
#
# USAGE:
#   ./scripts/verify_ci.sh
#
# HARD CONSTRAINTS:
# - NO caching of Docker layers during verification
# - NO fallbacks or auto-pass
# - FAIL immediately on any error
# ==============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCKERFILE="docker/Dockerfile.verify"
IMAGE_NAME="CraftMyFunnel-verify"
IMAGE_TAG="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$PROJECT_ROOT/verification-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo -e "[$timestamp] $1" | tee -a "$LOG_FILE"
}

log_error() {
    log "${RED}ERROR: $1${NC}"
}

log_success() {
    log "${GREEN}$1${NC}"
}

log_warn() {
    log "${YELLOW}WARNING: $1${NC}"
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

echo ""
log "=========================================="
log "PHI-3 MICRO-LLM CI VERIFICATION"
log "=========================================="
log ""
log "Project root: $PROJECT_ROOT"
log "Dockerfile: $DOCKERFILE"
log "Image: $IMAGE_NAME:$IMAGE_TAG"
log "Log file: $LOG_FILE"
log ""

# Change to project root
cd "$PROJECT_ROOT"

# Verify Dockerfile exists
if [ ! -f "$DOCKERFILE" ]; then
    log_error "Dockerfile not found: $DOCKERFILE"
    log_error "VERIFICATION FAILED"
    exit 1
fi

# Verify eval files exist
if [ ! -f "evaluation/eval_suite_prod.py" ]; then
    log_error "eval_suite_prod.py not found"
    log_error "VERIFICATION FAILED"
    exit 1
fi

if [ ! -f "evaluation/eval_cases_prod.json" ]; then
    log_error "eval_cases_prod.json not found"
    log_error "VERIFICATION FAILED"
    exit 1
fi

log "✓ All required files present"
log ""

# ==============================================================================
# BUILD VERIFICATION IMAGE
# Using --no-cache to ensure verification runs fresh every time
# ==============================================================================

log "Building verification Docker image..."
log "This will:"
log "  1. Build llama.cpp from source"
log "  2. Download Phi-3 model (~2.4GB)"
log "  3. Run verification suite"
log ""
log "Estimated time: 10-30 minutes (first run)"
log ""

BUILD_START=$(date +%s)

# Build with no cache - CRITICAL for verification integrity
# The RUN python3 eval_suite_prod.py step in Dockerfile MUST execute
if docker build \
    --no-cache \
    --progress=plain \
    -f "$DOCKERFILE" \
    -t "$IMAGE_NAME:$IMAGE_TAG" \
    -t "$IMAGE_NAME:latest" \
    . 2>&1 | tee -a "$LOG_FILE"; then
    
    BUILD_END=$(date +%s)
    BUILD_DURATION=$((BUILD_END - BUILD_START))
    
    log ""
    log "=========================================="
    log_success "✓ VERIFICATION PASSED"
    log "=========================================="
    log ""
    log "Build duration: ${BUILD_DURATION}s"
    log "Image built: $IMAGE_NAME:$IMAGE_TAG"
    log "Log file: $LOG_FILE"
    log ""
    log "All safety checks passed. Merge is allowed."
    log ""
    
    # Clean up old images (keep last 3)
    log "Cleaning up old verification images..."
    docker images "$IMAGE_NAME" --format "{{.ID}} {{.CreatedAt}}" | \
        sort -k2 -r | \
        tail -n +4 | \
        awk '{print $1}' | \
        xargs -r docker rmi 2>/dev/null || true
    
    exit 0
else
    BUILD_END=$(date +%s)
    BUILD_DURATION=$((BUILD_END - BUILD_START))
    
    log ""
    log "=========================================="
    log_error "✗ VERIFICATION FAILED"
    log "=========================================="
    log ""
    log "Build duration: ${BUILD_DURATION}s"
    log "Log file: $LOG_FILE"
    log ""
    log "Review the log file for failure details."
    log "DO NOT MERGE. CI MUST FAIL."
    log ""
    
    exit 1
fi
