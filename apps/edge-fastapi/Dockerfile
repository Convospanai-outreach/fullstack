# Stage 1: Build dependencies and artifacts
FROM python:3.11-slim AS builder
LABEL org.opencontainers.image.source="https://github.com/Convospanai-outreach/fullstack"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install build-only system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Pre-install specific libraries to avoid huge layer rebuilds
ARG REQUIREMENTS_FILE=requirements.runtime.txt
COPY requirements*.txt ./
# Install packages into a separate directory (~/.local) so we can copy only them to the final image
RUN pip install --user -r ${REQUIREMENTS_FILE} && \
    # Clean up any leftover build files within the local directory if possible
    find /root/.local -name "*.pyc" -delete && \
    find /root/.local -name "__pycache__" -delete

# Stage 2: Final minimal runner image
FROM python:3.11-slim AS runner

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/home/appuser \
    PATH="/home/appuser/.local/bin:${PATH}"

WORKDIR /app

# Non-root user for security (Essential for "Sovereign" Node)
RUN adduser --system --group --home /home/appuser appuser && \
    mkdir -p /home/appuser && \
    # Install minimal runtime dependencies needed by torch/llama-cpp/psycopg2
    apt-get update && apt-get install -y --no-install-recommends \
    libssl3 \
    libgomp1 \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder stage
COPY --from=builder /root/.local /home/appuser/.local
# Copy only necessary application files
COPY *.py ./
COPY services/ ./services/
# Ensure application directory structure is available if needed
# COPY modules/ ./modules/ 

# Set ownership to non-root user
RUN chown -R appuser:appuser /app /home/appuser

USER appuser

EXPOSE 8000

# Health check to ensure the node is responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start uvicorn with the specialized app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
