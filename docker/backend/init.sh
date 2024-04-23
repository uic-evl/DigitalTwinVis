#!/bin/bash
set -e
echo "Running backend init"
gunicorn -w 4 -b 0.0.0.0:5000 --chdir /workspace/DigitalTwinVis/Backend App:app