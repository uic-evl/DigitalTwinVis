set -e
echo "rnning frontend init"
cd /workspace/DigitaltTwinVis/frontend
serve -s build -p 80 --cors