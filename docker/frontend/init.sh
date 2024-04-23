set -e
echo "rnning frontend init"
cd /workspace/DigitalTwinVis/frontend
apt get install ufw
ufw allow 80/tcp
serve -s build -p 80 --cors