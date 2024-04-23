set -e
echo "rnning frontend init"
cd /workspace/DigitalTwinVis/frontend
apt-get install -y tmux
tmux
serve -s build -p 8000 --cors