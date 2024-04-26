#!/bin/bash
cd /workspace/DigitalTwinVis/DASS/dass_frontend
npm run build
npm install -g serve
serve -s build -p 9000 --cors
