#!/usr/bin/env bash
# run_process_trips.sh
# Navigate to your app directory
cd /app

# Execute the Python function
/usr/local/bin/python3 - <<'PYCODE'
from apps.members.utils import process_trips
process_trips()
PYCODE
