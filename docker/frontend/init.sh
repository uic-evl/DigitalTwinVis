set -e
echo "rnning frontend init"
cd /workspace/DigitalTwinVis/frontend
apt-get install -y ufw
ufw allow 8000/tcp
serve -s build -p 8000 --cors