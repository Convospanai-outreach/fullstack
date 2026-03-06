# ConvoSpan Sovereign Firewall Node (External)

This folder contains the complete setup to deploy the ConvoSpan **Sovereign Firewall and Micro-LLM** directly on an external hardware node (such as a **Raspberry Pi 5** or **Jetson Nano**).

## Purpose
1. **Sovereign PII Firewall**: Inspects and replaces Personally Identifiable Information (PII) before allowing telemetry or payloads to reach external cloud services. Stores the PII -> Token mappings securely.
2. **Micro-LLM Backend**: Hosts an ultra-fast local LLM (Phi-3-mini) for stateless, 100% private inference (latency < 1000ms).
3. **Hardware Actuator Auth**: Secures programmatic execution requests by acting as a verifiable physical bridge.

## Hardware Requirements
- **Device**: Raspberry Pi 5 (8GB RAM recommended) or NVIDIA Jetson device.
- **OS**: Ubuntu Server 22.04 LTS or Raspberry Pi OS (64-bit).
- **Storage**: At least 32GB SD Card / SSD (for the GGUF model files).

## Installation

### 1. Transfer this folder to your Node
`scp -r ./external-node username@<pi-ip-address>:~/external-node`

### 2. Download the Phi-3 Model
You will need a GGUF quantized model tailored for CPU edge inference.
```bash
mkdir -p models
wget -O models/phi-3-mini-4k-instruct-q4_k_m.gguf "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf"
```

### 3. Run the Auto-Installer
```bash
cd external-node
chmod +x install.sh
sudo ./install.sh
```

*(This will install Python dependencies, create a virtual environment, and register the systemd service to start entirely on boot).*

## Environment Variables
Create a `.env` file in this directory based on your needs:
```ini
# .env
HARDWARE_SIGNATURE=your_secure_unique_device_id
PORT=8081
MODEL_PATH=./models/phi-3-mini-4k-instruct-q4_k_m.gguf
N_THREADS=4
```

## Integrating with the ConvoSpan Main App
In your main application's `.env`, point the endpoints to this node:
```ini
MICRO_LLM_URL=http://<node-ip-address>:8081
EDGE_NODE_URL=http://<node-ip-address>:8081
HARDWARE_SIGNATURE=your_secure_unique_device_id
```
