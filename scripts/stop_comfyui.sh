#!/usr/bin/env bash

# --- Define path for the status file ---
STATUS_FILE="/tmp/comfyui_status.json"

# --- Function to update status file ---
update_status() {
    local running=$1
    local user=$2
    local timestamp=$(date -Iseconds)
    echo "{\"running\": $running, \"user\": $user, \"timestamp\": \"$timestamp\"}" > "$STATUS_FILE"
}

echo "COMFYUI: Stopping ComfyUI..."

# --- Get current user from status file (for logging) ---
CURRENT_USER="unknown"
if [ -f "$STATUS_FILE" ]; then
    CURRENT_USER=$(cat "$STATUS_FILE" 2>/dev/null | grep -o '"user": *"[^"]*"' | cut -d'"' -f4)
    if [ -z "$CURRENT_USER" ] || [ "$CURRENT_USER" = "null" ]; then
        CURRENT_USER="unknown"
    fi
fi

# --- Kill ComfyUI process ---
# Kill by port first (more reliable)
fuser -k 8188/tcp 2>/dev/null

# Also kill by process name as backup
pkill -f "main.py --listen" 2>/dev/null

# Wait a moment for processes to terminate
sleep 1

# --- Update status file to indicate stopped ---
update_status false null

echo "COMFYUI: ComfyUI stopped (was running for: $CURRENT_USER)"
echo "{\"success\": true, \"message\": \"ComfyUI stopped successfully (was running for $CURRENT_USER).\"}"