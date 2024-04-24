#!/bin/bash
cd /workspace/DigitalTwinVis/frontend
npm run build
npm install -g serve
serve -s build -p 8000 --cors
