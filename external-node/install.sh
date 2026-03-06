#!/bin/bash
set -e

echo "========================================="
echo " ConvoSpan Sovereign Node Installer      "
echo "========================================="

# 1. Update and install dependencies
echo "[1/3] Installing system requirements..."
sudo apt update
sudo apt install -y python3-pip python3-venv build-essential python3-dev
sudo apt install -y ufw

# 2. Virtual Environment Setup
echo "[2/3] Setting up Python Virtual Environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip

# Optimize llama-cpp-python for the target architecture
# If on Raspberry Pi / ARM CPU, compiling speeds up inference significantly
echo "Installing LLM & Web dependencies..."
pip install -r requirements.txt

# 3. Secure Setup
echo "[3/3] Setting Firewall Rules..."
sudo ufw allow 8081/tcp

echo ""
echo "========================================="
echo " Installation Complete!"
echo " "
echo " Next Steps:"
echo " 1. Modify the .env file with your HARDWARE_SIGNATURE."
echo " 2. Run 'source venv/bin/activate && python main.py' to test."
echo " 3. Consider using the systemd service to run it on boot."
echo "========================================="
