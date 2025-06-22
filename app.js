const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8000;

// Status file path
const STATUS_FILE = '/tmp/comfyui_status.json';

// Helper function to read status from file
function readStatusFile() {
    try {
        if (fs.existsSync(STATUS_FILE)) {
            const data = fs.readFileSync(STATUS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('[STATUS] Error reading status file:', error.message);
    }
    
    // Return default status if file doesn't exist or can't be read
    return {
        running: false,
        user: null,
        timestamp: null
    };
}

// Helper function to write status to file
function writeStatusFile(running, user) {
    try {
        const status = {
            running: running,
            user: user,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(STATUS_FILE, JSON.stringify(status), 'utf8');
        console.log('[STATUS] Updated status file:', status);
        return status;
    } catch (error) {
        console.error('[STATUS] Error writing status file:', error.message);
        return null;
    }
}

// Helper function to check if ComfyUI is actually running using curl
async function checkComfyUIProcess() {
    return new Promise((resolve) => {
        // First try the system_stats endpoint, fallback to root endpoint
        exec('curl -s --connect-timeout 3 --max-time 5 "http://localhost:8188/system_stats"', (error, stdout, stderr) => {
            if (!error && stdout.trim().length > 0) {
                console.log('[CHECK] ComfyUI responding on /system_stats');
                resolve(true);
                return;
            }
            
            // Fallback to root endpoint
            exec('curl -s --connect-timeout 3 --max-time 5 "http://localhost:8188/"', (error2, stdout2, stderr2) => {
                const isRunning = !error2 && stdout2.trim().length > 0;
                console.log('[CHECK] ComfyUI responding on /:', isRunning);
                resolve(isRunning);
            });
        });
    });
}

// Enhanced status checking with file and process verification
async function getActualStatus() {
    const fileStatus = readStatusFile();
    const isActuallyRunning = await checkComfyUIProcess();
    
    console.log('[STATUS] File says:', fileStatus);
    console.log('[STATUS] Process check:', isActuallyRunning);
    
    // Check if we're in startup grace period (45 seconds)
    const timeSinceStart = fileStatus.timestamp ? 
        Date.now() - new Date(fileStatus.timestamp) : 
        Infinity;
    const isInGracePeriod = timeSinceStart < 45000; // 45 seconds
    
    console.log('[STATUS] Time since start:', Math.floor(timeSinceStart / 1000), 'seconds');
    console.log('[STATUS] In grace period:', isInGracePeriod);
    
    // If file says running but process isn't, check grace period
    if (fileStatus.running && !isActuallyRunning) {
        if (isInGracePeriod && fileStatus.user && fileStatus.user !== 'null') {
            // During grace period, preserve the user name - ComfyUI is still starting up
            console.log('[STATUS] In startup grace period, keeping user:', fileStatus.user);
            return {
                running: true, // Keep as running during grace period
                user: fileStatus.user,
                timestamp: fileStatus.timestamp
            };
        } else {
            // After grace period or no valid user, reset the file
            console.log('[STATUS] Grace period expired or no user, resetting status file');
            const newStatus = writeStatusFile(false, null);
            return newStatus || { running: false, user: null, timestamp: null };
        }
    }
    
    // If process is running but file says not, update file with unknown user
    if (!fileStatus.running && isActuallyRunning) {
        console.log('[STATUS] Process running but file says not, updating file');
        const newStatus = writeStatusFile(true, 'unknown');
        return newStatus || { running: true, user: 'unknown', timestamp: new Date().toISOString() };
    }
    
    // File and process status match
    return {
        running: isActuallyRunning,
        user: fileStatus.user,
        timestamp: fileStatus.timestamp
    };
}

// Initialize - check actual status on startup
async function initializeStatus() {
    console.log('[INIT] Checking initial status...');
    const status = await getActualStatus();
    console.log('[INIT] Initial status:', status);
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
    
    // Check current actual status
    const currentStatus = await getActualStatus();
    
    if (currentStatus.running) {
        if (currentStatus.user && currentStatus.user !== 'unknown' && currentStatus.user !== userName) {
            return res.status(409).json({
                success: false,
                message: `ComfyUI is already running for user '${currentStatus.user}'. Please wait for them to finish.`
            });
        }
        
        if (currentStatus.user === userName) {
            return res.json({
                success: true,
                message: `ComfyUI is already running for you (${userName}).`,
                status: currentStatus
            });
        }
    }
    
    // Path to the start script
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
    
    // Respond immediately - the script will handle status file updates
    res.json({
        success: true,
        message: `Starting ComfyUI for ${userName}...`
    });
});

// Get current status - now reads from persistent file
app.get('/status', async (req, res) => {
    try {
        const status = await getActualStatus();
        
        res.json({
            running: status.running,
            user: status.user,
            timestamp: status.timestamp,
            uptime: status.timestamp ? 
                Math.floor((Date.now() - new Date(status.timestamp)) / 1000) : 0
        });
    } catch (error) {
        console.error('[STATUS] Error getting status:', error);
        res.status(500).json({
            running: false,
            user: null,
            error: 'Failed to check status'
        });
    }
});

// Stop ComfyUI
app.get('/stop_comfyui', async (req, res) => {
    const currentStatus = await getActualStatus();
    console.log(`[STOP] Request to stop ComfyUI (currently running for: ${currentStatus.user})`);
    
    // Path to the stop script
    const scriptPath = path.join(__dirname, 'scripts', 'stop_comfyui.sh');
    
    if (!fs.existsSync(scriptPath)) {
        console.warn(`[STOP] Script not found at ${scriptPath}, attempting direct kill.`);
        // If no stop script, try direct kill and update status file
        exec('fuser -k 8188/tcp 2>/dev/null; pkill -f "main.py --listen" 2>/dev/null', (error) => {
            if (error) {
                console.error('[STOP] Error killing process:', error);
            }
        });
        
        // Update status file manually
        writeStatusFile(false, null);
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
    
    res.json({
        success: true,
        message: `Stopping ComfyUI${currentStatus.user ? ` (was running for ${currentStatus.user})` : ''}...`
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
    
    // Create logs directory if it doesn't exist
    const logsDir = '/workspace/logs';
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
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
app.get('/health', async (req, res) => {
    const status = await getActualStatus();
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        comfyui_status: status
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
    console.log(`[SERVER] Status file: ${STATUS_FILE}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[SERVER] Shutting down...');
    
    getActualStatus().then(status => {
        if (status.running) {
            exec('fuser -k 8188/tcp; pkill -f "main.py --listen"', () => {
                writeStatusFile(false, null);
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    });
});

process.on('SIGTERM', () => {
    console.log('[SERVER] SIGTERM received');
    writeStatusFile(false, null);
    process.exit(0);
});