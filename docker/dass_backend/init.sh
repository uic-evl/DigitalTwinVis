#!/bin/bash
set -e
echo "Running backend init"
gunicorn -w 3 -b 0.0.0.0:8080 --chdir /workspace/DigitalTwinVis/DASS/dass_backend App:app

