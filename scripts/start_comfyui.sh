#!/usr/bin/env bash

# --- Get username from the first command-line argument ---
USERNAME=$1
if [ -z "$USERNAME" ]; then
    echo "Error: No username provided. Cannot start." >&2
    exit 1
fi

# --- Define path for the status file ---
STATUS_FILE="/tmp/comfyui_status.json"

# --- Prevent multiple instances from running ---
if pgrep -f "main.py --listen" > /dev/null; then
    echo "ComfyUI is already running."
    # We can still update the status file to reflect who is trying to use it.
    echo "{\"running\": true, \"user\": \"$(cat $STATUS_FILE | grep -o '\"user\": *\"[^\"]*\"' | grep -o '\"[^\"]*\"$' | tr -d '\"')\"}"
    exit 0
fi

# --- Your script logic starts here ---
export PYTHONUNBUFFERED=1
cd "/workspace/ComfyUI"

echo "COMFYUI: Starting ComfyUI for user: $USERNAME"

# --- Create the status file BEFORE starting the process ---
echo "{\"running\": true, \"user\": \"$USERNAME\"}" > "$STATUS_FILE"

# --- Start ComfyUI ---
TCMALLOC="$(ldconfig -p | grep -Po "libtcmalloc.so.\d" | head -n 1)"
export LD_PRELOAD="${TCMALLOC}"
nohup python main.py --listen 0.0.0.0 > "/workspace/logs/comfyui.log" 2>&1 &

echo "COMFYUI: ComfyUI start process has been initiated."
# This JSON is what the frontend will receive.
echo "{\"success\": true, \"message\": \"Instance start process initiated for $USERNAME.\"}"