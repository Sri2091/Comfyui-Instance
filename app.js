const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8000;

// State management
let currentStatus = {
    running: false,
    user: null,
    startTime: null
};

// Helper function to check if ComfyUI process is actually running
async function checkComfyUIProcess() {
    return new Promise((resolve) => {
        // Check if anything is listening on ComfyUI's port (8188)
        exec('netstat -tulpn 2>/dev/null | grep ":8188" || lsof -i :8188 2>/dev/null', (error, stdout, stderr) => {
            const isRunning = !error && stdout.trim().length > 0;
            
            console.log('[CHECK] Port 8188 check:', stdout.trim());
            console.log('[CHECK] ComfyUI running:', isRunning);
            
            resolve(isRunning);
        });
    });
}
// Initialize - check actual status on startup
async function initializeStatus() {
    const isRunning = await checkComfyUIProcess();
    if (!isRunning) {
        currentStatus = {
            running: false,
            user: null,
            startTime: null
        };
        console.log('[INIT] ComfyUI not running, status reset');
    } else {
        console.log('[INIT] ComfyUI is running');
    }
}

// Call initialization
initializeStatus();

// Serve static files
app.use(express.static('public'));

// Serve volume_map.json - used only for fetching user list
app.get('/volume_map.json', (req, res) => {
    const volumeMapPath = path.join(__dirname, 'volume_map.json');
    
    if (fs.existsSync(volumeMapPath)) {
        res.sendFile(volumeMapPath);
    } else {
        console.warn('volume_map.json not found, returning default');
        const defaultVolumeMap = {
            "vol_1": ["Sri", "Bharath"],
            "vol_2": ["Pavan", "Moulika"],
            "vol_3": ["Abhijith", "Abhiram", "Sneha"],
            "vol_4": ["Shakthi"],
            "no_vol": ["Intern"]
        };
        res.json(defaultVolumeMap);
    }
});

// Start ComfyUI for any user
app.get('/start_comfyui/:user', async (req, res) => {
    const userName = req.params.user;
    
    console.log(`[START] Request to start ComfyUI for user: ${userName}`);
    
    // Check if already running
    const isActuallyRunning = await checkComfyUIProcess();
    
    if (isActuallyRunning) {
        // If running but we don't know who started it, allow the current user to "claim" it
        if (!currentStatus.user) {
            currentStatus = {
                running: true,
                user: userName,
                startTime: new Date().toISOString()
            };
            
            return res.json({
                success: true,
                message: `ComfyUI is already running. Claimed by ${userName}.`,
                status: currentStatus
            });
        } else if (currentStatus.user !== userName) {
            return res.status(409).json({
                success: false,
                message: `ComfyUI is already running for user '${currentStatus.user}'. Please stop it first.`
            });
        }
    }
    
    // Path to the start script - CORRECTED PATH
    const scriptPath = path.join(__dirname, 'scripts', 'start_comfyui.sh');
    
    if (!fs.existsSync(scriptPath)) {
        console.error(`[START] Script not found: ${scriptPath}`);
        return res.status(404).json({
            success: false,
            message: 'Start script not found'
        });
    }
    
    // Make script executable
    try {
        fs.chmodSync(scriptPath, '755');
    } catch (err) {
        console.warn('[START] Could not chmod script:', err.message);
    }
    
    // Execute the script with username as parameter
    exec(`bash "${scriptPath}" "${userName}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`[START] Script error:`, error);
        }
        if (stderr) {
            console.log(`[START] Script stderr:`, stderr);
        }
        if (stdout) {
            console.log(`[START] Script output:`, stdout);
        }
    });
    
    // Update status
    currentStatus = {
        running: true,
        user: userName,
        startTime: new Date().toISOString()
    };
    
    res.json({
        success: true,
        message: `Starting ComfyUI for ${userName}...`,
        status: currentStatus
    });
});

// Get current status
app.get('/status', async (req, res) => {
    // Double-check actual process status
    const isActuallyRunning = await checkComfyUIProcess();
    
    // Update our status if mismatch
    if (!isActuallyRunning && currentStatus.running) {
        console.log('[STATUS] ComfyUI not running, resetting status');
        currentStatus = {
            running: false,
            user: null,
            startTime: null
        };
    } else if (isActuallyRunning && !currentStatus.running) {
        console.log('[STATUS] ComfyUI is running but status was false');
        currentStatus.running = true;
    }
    
    res.json({
        running: currentStatus.running,
        user: currentStatus.user,
        startTime: currentStatus.startTime,
        uptime: currentStatus.startTime ? 
            Math.floor((Date.now() - new Date(currentStatus.startTime)) / 1000) : 0
    });
});

// Stop ComfyUI
app.get('/stop_comfyui', async (req, res) => {
    console.log(`[STOP] Request to stop ComfyUI (was running for: ${currentStatus.user})`);
    
    // Path to the stop script - CORRECTED PATH
    const scriptPath = path.join(__dirname, 'scripts', 'stop_comfyui.sh');
    
    if (!fs.existsSync(scriptPath)) {
        console.warn(`[STOP] Script not found at ${scriptPath}, attempting direct kill.`);
        // If no stop script, try direct kill
        exec('pkill -f "main.py --listen"', (error) => {
            if (error) {
                console.error('[STOP] Error killing process:', error);
            }
        });
    } else {
        // Make script executable
        try {
            fs.chmodSync(scriptPath, '755');
        } catch (err) {
            console.warn('[STOP] Could not chmod script:', err.message);
        }
        
        exec(`bash "${scriptPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error('[STOP] Script error:', error);
            }
            if (stdout) {
                console.log('[STOP] Script output:', stdout);
            }
        });
    }
    
    const previousUser = currentStatus.user;
    
    // Reset status
    currentStatus = {
        running: false,
        user: null,
        startTime: null
    };
    
    res.json({
        success: true,
        message: `Stopped ComfyUI${previousUser ? ` (was running for ${previousUser})` : ''}`,
        status: currentStatus
    });
});

// Get logs - serve different log files based on identifier
app.get('/logs/:identifier', (req, res) => {
    const identifier = req.params.identifier;
    let logFilePath;
    
    // Map identifiers to actual log file paths
    if (identifier === 'model_downloads') {
        logFilePath = '/workspace/logs/comfyui_model_downloads.log';
    } else {
        // Default to comfyui logs (for 'comfyui' or any other identifier)
        logFilePath = '/workspace/logs/comfyui.log';
    }
    
    console.log(`[LOGS] Fetching logs for identifier '${identifier}' from: ${logFilePath}`);
    
    // Set headers for plain text streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    
    // Check if file exists
    if (!fs.existsSync(logFilePath)) {
        return res.status(404).send(`Log file not found: ${logFilePath}. Process may not have started yet or no logs generated.`);
    }
    
    try {
        // Create read stream and pipe to response
        const stream = fs.createReadStream(logFilePath, { encoding: 'utf8' });
        
        stream.on('error', (err) => {
            console.error('[LOGS] Stream error:', err);
            if (!res.headersSent) {
                res.status(500).send(`Error reading logs: ${err.message}`);
            }
        });
        
        stream.pipe(res);
    } catch (error) {
        console.error('[LOGS] Error:', error);
        res.status(500).send(`Error: ${error.message}`);
    }
});


// Get ComfyUI link
app.get('/copy_link', (req, res) => {
    const podId = process.env.RUNPOD_POD_ID;
    
    if (podId) {
        res.json({
            link: `https://${podId}-8188.proxy.runpod.net`
        });
    } else {
        res.json({
            link: 'https://localhost:8188'
        });
    }
});

// Setup/Download models
app.get('/setup', (req, res) => {
    console.log('[SETUP] Starting model download');
    
    const scriptPath = path.join(__dirname, 'scripts', 'Download_models.py');
    
    if (!fs.existsSync(scriptPath)) {
        return res.status(404).json({
            success: false,
            message: 'Setup script not found'
        });
    }
    
    exec(`python3 "${scriptPath}" > /workspace/logs/model_downloads.log 2>&1 &`, (error) => {
        if (error) {
            console.error('[SETUP] Error starting download:', error);
        }
    });
    
    res.json({
        success: true,
        message: 'Model download started. Check logs for progress.'
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        currentStatus
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Endpoint not found: ${req.method} ${req.path}`
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Started on http://0.0.0.0:${PORT}`);
    console.log(`[SERVER] Environment: ${process.env.ENV_TYPE || 'development'}`);
    console.log(`[SERVER] Pod ID: ${process.env.RUNPOD_POD_ID || 'local'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[SERVER] Shutting down...');
    
    if (currentStatus.running) {
        exec('pkill -f "main.py --listen"', () => {
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

process.on('SIGTERM', () => {
    console.log('[SERVER] SIGTERM received');
    process.exit(0);
});