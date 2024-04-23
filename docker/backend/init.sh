#!/bin/bash
set -e
echo "Running backend init"
tmux new -d -s backend "gunicorn -w 4 -b 0.0.0.0:5000 --chdir /workspace/DigitalTwinVis/Backend App:app"
cd /workspace/DigitalTwinVis/frontend
apt-get install npm
npm run build
npm install -g serve
serve -s build -p 8000 --cors
