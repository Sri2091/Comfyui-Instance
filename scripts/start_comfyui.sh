#!/usr/bin/env bash

# --- Get username from the first command-line argument ---
USERNAME=$1
if [ -z "$USERNAME" ]; then
    echo "Error: No username provided. Cannot start." >&2
    exit 1
fi

# --- Define path for the status file ---
STATUS_FILE="/tmp/comfyui_status.json"

# --- Function to update status file ---
update_status() {
    local running=$1
    local user=$2
    local timestamp=$(date -Iseconds)
    echo "{\"running\": $running, \"user\": \"$user\", \"timestamp\": \"$timestamp\"}" > "$STATUS_FILE"
}

# --- Check if ComfyUI is actually running by testing the port ---
check_comfyui_running() {
    # Try to connect to ComfyUI port - return 0 if running, 1 if not
    curl -s --connect-timeout 3 --max-time 5 "http://localhost:8188/system_stats" > /dev/null 2>&1
    return $?
}

# --- Check current status ---
if check_comfyui_running; then
    echo "ComfyUI is already running."
    
    # Check who's running it from status file
    if [ -f "$STATUS_FILE" ]; then
        CURRENT_USER=$(cat "$STATUS_FILE" 2>/dev/null | grep -o '"user": *"[^"]*"' | cut -d'"' -f4)
        if [ -n "$CURRENT_USER" ] && [ "$CURRENT_USER" != "null" ]; then
            echo "Currently running for user: $CURRENT_USER"
            if [ "$CURRENT_USER" != "$USERNAME" ]; then
                echo "{\"success\": false, \"message\": \"ComfyUI is already running for user '$CURRENT_USER'. Please wait for them to finish.\"}"
                exit 1
            else
                echo "{\"success\": true, \"message\": \"ComfyUI is already running for you ($USERNAME).\"}"
                exit 0
            fi
        fi
    fi
    
    # If no valid user in status file, update it with current user
    update_status true "$USERNAME"
    echo "{\"success\": true, \"message\": \"ComfyUI was running. Now claimed by $USERNAME.\"}"
    exit 0
fi

# --- Your script logic starts here ---
export PYTHONUNBUFFERED=1
cd "/workspace/ComfyUI"

echo "COMFYUI: Starting ComfyUI for user: $USERNAME"

# --- Create the status file BEFORE starting the process ---
update_status true "$USERNAME"

# --- Start ComfyUI ---
TCMALLOC="$(ldconfig -p | grep -Po "libtcmalloc.so.\d" | head -n 1)"
export LD_PRELOAD="${TCMALLOC}"

# Create logs directory if it doesn't exist
mkdir -p "/workspace/logs"

# Start ComfyUI in background
nohup python main.py --listen 0.0.0.0 > "/workspace/logs/comfyui.log" 2>&1 &
COMFY_PID=$!

# Wait a moment and check if it started successfully
sleep 2
if kill -0 "$COMFY_PID" 2>/dev/null; then
    echo "COMFYUI: ComfyUI process started successfully (PID: $COMFY_PID)"
else
    echo "COMFYUI: ComfyUI failed to start"
    update_status false "null"
    echo "{\"success\": false, \"message\": \"Failed to start ComfyUI for $USERNAME.\"}"
    exit 1
fi

echo "COMFYUI: ComfyUI start process has been initiated."
# This JSON is what the frontend will receive.
echo "{\"success\": true, \"message\": \"Instance start process initiated for $USERNAME.\"}"