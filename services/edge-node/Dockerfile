FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies for ARM64/Jetson (build-essential, cmake for llama-cpp)
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
# Specialized install with specific flags for ARM64 optimization if needed
# CMAKE_ARGS="-DLLAMA_BLAS=ON -DLLAMA_VENDOR=openblas" for generic linux optimization
# For Jetson, we'd assume pre-built wheels or specific base images, but standard pip usually works for simple CPU fallback
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
