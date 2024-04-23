set -e
echo "rnning frontend init"
cd /workspace/DigitalTwinVis/frontend
serve -s build -p 80 --cors