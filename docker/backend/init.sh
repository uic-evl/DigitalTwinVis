#!/bin/bash
set -e
echo "Running backend init"
# change the worker number to 1 for Mac, normally 4 for Linux
gunicorn -w 1 -b 0.0.0.0:5000 --chdir /workspace/DigitalTwinVis/Backend App:app

