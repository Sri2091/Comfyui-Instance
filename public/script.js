// Global variables
let logInterval = null;
let autoScrollEnabled = true;
let lastContentHeight = 0;
let currentUser = null;
let allUsers = [];
let filteredUsers = [];
let volumeMap = {};
let selectedIndex = -1;
let hasInitialized = false;

// Image loading management
const imageCache = new Map();
const imageLoadPromises = new Map();
let imagesPreloaded = false;

// DOM elements
const selectionPage = document.getElementById('selectionPage');
const cardPage = document.getElementById('cardPage');
const searchInput = document.getElementById('searchInput');
const dropdownContainer = document.getElementById('dropdownContainer');
const dropdownMenu = document.getElementById('dropdownMenu');
const dropdownList = document.getElementById('dropdownList');
const noResults = document.getElementById('noResults');

// Card page elements
const backButton = document.getElementById('backButton');
const userCard = document.getElementById('userCard');
const cardTitle = document.getElementById('cardTitle');
const logsWrapper = document.getElementById('logsWrapper');
const logBox = document.getElementById('comfyLogBox');
const jumpButton = document.getElementById('jumpToBottomButton');
const copyText = document.getElementById('copyText');
const statusIndicator = document.getElementById('statusIndicator');

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        await loadUserList();
        preloadUserImages();
        renderDropdown();
        
        // Make sure to call updateCopyLink during initialization
        await updateCopyLink();
        
        setupEventListeners();
        await checkInstanceStatus();
        
        if (!hasInitialized) {
            const header = document.querySelector('.header');
            const dropdownWrapper = document.querySelector('.dropdown-wrapper');
            if (header) header.classList.add('animate-in');
            if (dropdownWrapper) dropdownWrapper.classList.add('animate-in');
            setTimeout(() => {
                if (dropdownWrapper) {
                    dropdownWrapper.classList.add('intro-glow');
                    setTimeout(() => {
                        if (dropdownWrapper) {
                            dropdownWrapper.classList.remove('intro-glow');
                        }
                    }, 2000);
                }
            }, 1000);
            hasInitialized = true;
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Failed to initialize application', 'error');
    }
}


function setupEventListeners() {
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('focus', showDropdown);
    searchInput.addEventListener('keydown', handleKeyNavigation);
    document.addEventListener('click', (e) => {
        if (!dropdownContainer.contains(e.target)) {
            hideDropdown();
        }
    });
    dropdownMenu.addEventListener('click', (e) => e.stopPropagation());
    backButton.addEventListener('click', showSelectionPage);
    logsWrapper.addEventListener('scroll', handleLogsScroll);
    jumpButton.addEventListener('click', () => {
        autoScrollEnabled = true;
        updateJumpButtonState();
        scrollToBottom();
    });
    // Add spacebar listener for search box activation
    document.addEventListener('keydown', handleGlobalKeydown);
}

function handleGlobalKeydown(e) {
    // Only activate on spacebar when on selection page and search box is not already focused
    if (e.code === 'Space' && 
        selectionPage.style.display !== 'none' && 
        document.activeElement !== searchInput &&
        !isInputElement(document.activeElement)) {
        
        e.preventDefault(); // Prevent page scroll
        searchInput.focus();
        showDropdown();
        
        // Add a subtle visual feedback
        searchInput.classList.add('spacebar-focus');
        setTimeout(() => {
            searchInput.classList.remove('spacebar-focus');
        }, 300);
    }
}

function isInputElement(element) {
    // Check if the currently focused element is an input that should receive text
    if (!element) return false;
    const tagName = element.tagName.toLowerCase();
    const inputTypes = ['input', 'textarea', 'select'];
    return inputTypes.includes(tagName) || element.contentEditable === 'true';
}


// Load user list from volume map (volume info only for display, no restrictions)
async function loadUserList() {
    try {
        const response = await fetch('/volume_map.json');
        volumeMap = await response.json();
        allUsers = [];
        
        // Flatten all users from all volumes into a single list
        for (const [volume, users] of Object.entries(volumeMap)) {
            users.forEach(user => {
                allUsers.push({
                    name: user,
                    volume: volume,
                    volumeDisplay: getVolumeDisplayName(volume)
                });
            });
        }
        
        allUsers.sort((a, b) => a.name.localeCompare(b.name));
        filteredUsers = [...allUsers];
        
        console.log('Loaded users:', allUsers);
    } catch (error) {
        console.error('Error loading volume map:', error);
        // Fallback user list
        allUsers = [
            { name: 'Sri', volume: 'vol_1', volumeDisplay: 'Volume 1' },
            { name: 'Bharath', volume: 'vol_1', volumeDisplay: 'Volume 1' },
            { name: 'Pavan', volume: 'vol_2', volumeDisplay: 'Volume 2' },
            { name: 'Moulika', volume: 'vol_2', volumeDisplay: 'Volume 2' },
            { name: 'Abhijith', volume: 'vol_3', volumeDisplay: 'Volume 3' },
            { name: 'Abhiram', volume: 'vol_3', volumeDisplay: 'Volume 3' },
            { name: 'Sneha', volume: 'vol_3', volumeDisplay: 'Volume 3' },
            { name: 'Shakthi', volume: 'vol_4', volumeDisplay: 'Volume 4' },
            { name: 'Intern', volume: 'no_vol', volumeDisplay: 'General' }
        ];
        filteredUsers = [...allUsers];
    }
}

function preloadUserImages() {
    console.log('Starting image preload...');
    
    allUsers.forEach(user => {
        const imagePath = `images/${user.name.toLowerCase()}.png`;
        preloadImage(imagePath, user.name);
    });
    
    // Mark as preloaded after a short delay to allow initial requests to start
    setTimeout(() => {
        imagesPreloaded = true;
        console.log('Image preload initiated for', allUsers.length, 'users');
    }, 100);
}

function preloadImage(src, userName) {
    // Return existing promise if already loading
    if (imageLoadPromises.has(src)) {
        return imageLoadPromises.get(src);
    }
    
    const promise = new Promise((resolve, reject) => {
        // Check if image is already cached
        if (imageCache.has(src)) {
            resolve({ src, userName, cached: true });
            return;
        }
        
        const img = new Image();
        
        img.onload = () => {
            imageCache.set(src, {
                element: img,
                loaded: true,
                error: false,
                loadTime: Date.now()
            });
            console.log(`✓ Loaded: ${userName} (${src})`);
            resolve({ src, userName, cached: false });
        };
        
        img.onerror = () => {
            imageCache.set(src, {
                element: null,
                loaded: false,
                error: true,
                loadTime: Date.now()
            });
            console.log(`✗ Failed: ${userName} (${src})`);
            resolve({ src, userName, error: true }); // Resolve, don't reject, to handle gracefully
        };
        
        // Start loading
        img.src = src;
    });
    
    imageLoadPromises.set(src, promise);
    return promise;
}


function getImageStatus(src) {
    const cached = imageCache.get(src);
    if (!cached) return 'loading';
    if (cached.error) return 'error';
    if (cached.loaded) return 'loaded';
    return 'loading';
}

function createAvatarHTML(user, index) {
    const imagePath = `images/${user.name.toLowerCase()}.png`;
    const imageStatus = getImageStatus(imagePath);
    const fallbackLetter = user.name.charAt(0).toUpperCase();
    
    // Always show loading skeleton initially, then transition to image or fallback
    const showSkeleton = imageStatus === 'loading';
    const showImage = imageStatus === 'loaded';
    const showFallback = imageStatus === 'error';
    
    return `
        <div class="user-avatar ${imageStatus}" data-src="${imagePath}" data-user="${user.name}">
            <div class="avatar-skeleton ${showSkeleton ? 'visible' : ''}"></div>
            <img src="${showImage ? imagePath : imagePath}" 
                 alt="${user.name}" 
                 class="${showImage ? 'loaded' : ''}"
                 style="${showImage ? 'opacity: 1;' : 'opacity: 0;'}"
                 onload="handleImageLoad(this)"
                 onerror="handleImageError(this)">
            <div class="avatar-fallback ${showFallback ? 'visible' : ''}" 
                 style="${showFallback ? 'display: flex;' : 'display: none;'}">
                ${fallbackLetter}
            </div>
        </div>
    `;
}

window.handleImageLoad = function(imgElement) {
    const avatar = imgElement.closest('.user-avatar');
    const src = avatar.dataset.src;
    const userName = avatar.dataset.user;
    
    console.log(`✓ Image loaded for ${userName}`);
    
    // Update cache
    if (!imageCache.has(src) || !imageCache.get(src).loaded) {
        imageCache.set(src, {
            element: imgElement,
            loaded: true,
            error: false,
            loadTime: Date.now()
        });
    }
    
    // Smooth transition
    avatar.classList.remove('loading');
    avatar.classList.add('loaded');
    
    const skeleton = avatar.querySelector('.avatar-skeleton');
    const fallback = avatar.querySelector('.avatar-fallback');
    
    // Fade out skeleton and fallback, fade in image
    if (skeleton) skeleton.classList.remove('visible');
    if (fallback) fallback.style.display = 'none';
    
    imgElement.style.opacity = '1';
    imgElement.classList.add('loaded');
};


window.handleImageError = function(imgElement) {
    const avatar = imgElement.closest('.user-avatar');
    if (!avatar) return;
    avatar.classList.remove('loading');
    avatar.classList.add('error');
    const skeleton = avatar.querySelector('.avatar-skeleton');
    const fallback = avatar.querySelector('.avatar-fallback');
    if (skeleton) skeleton.classList.remove('visible');
    if (fallback) {
        fallback.style.display = 'flex';
        fallback.classList.add('visible');
    }
    imgElement.style.display = 'none';
};

function getVolumeDisplayName(volume) {
    const volumeNames = { 
        'vol_1': 'Volume 1', 
        'vol_2': 'Volume 2', 
        'vol_3': 'Volume 3', 
        'vol_4': 'Volume 4', 
        'no_vol': 'General' 
    };
    return volumeNames[volume] || volume;
}

function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    filteredUsers = searchTerm === '' ? [...allUsers] : allUsers.filter(user => user.name.toLowerCase().includes(searchTerm) || user.volumeDisplay.toLowerCase().includes(searchTerm));
    selectedIndex = filteredUsers.length > 0 ? 0 : -1;
    renderDropdown();
    showDropdown();
}

function showDropdown() {
    dropdownMenu.classList.add('visible');
    dropdownContainer.classList.add('focused');
    
    // Update images when dropdown becomes visible
    setTimeout(() => {
        updateLoadedImages();
    }, 0);
}

function hideDropdown() {
    dropdownMenu.classList.remove('visible');
    dropdownContainer.classList.remove('focused');
    selectedIndex = -1;
    updateSelection();
}

function handleKeyNavigation(e) {
    if (!dropdownMenu.classList.contains('visible')) {
        if (e.key !== 'Escape') showDropdown();
        return;
    }
    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, filteredUsers.length - 1);
            updateSelection();
            break;
        case 'ArrowUp':
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            updateSelection();
            break;
        case 'Enter':
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < filteredUsers.length) {
                selectUser(filteredUsers[selectedIndex]);
            } else if (filteredUsers.length === 1) {
                selectUser(filteredUsers[0]);
            }
            break;
        case 'Escape':
            e.preventDefault();
            hideDropdown();
            searchInput.blur();
            break;
    }
}

function updateSelection() {
    const items = dropdownList.querySelectorAll('.dropdown-item');
    items.forEach((item, index) => item.classList.toggle('selected', index === selectedIndex));
    if (selectedIndex >= 0 && items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
}

function renderDropdown() {
    if (filteredUsers.length === 0) {
        dropdownList.style.display = 'none';
        noResults.style.display = 'block';
        return;
    }
    
    dropdownList.style.display = 'block';
    noResults.style.display = 'none';
    
    dropdownList.innerHTML = filteredUsers.map((user, index) => `
        <div class="dropdown-item ${index === selectedIndex ? 'selected' : ''}" 
             data-index="${index}">
            ${createAvatarHTML(user, index)}
            <div class="user-info">
                <div class="user-name">${user.name}</div>
                <div class="user-volume">${user.volumeDisplay}</div>
            </div>
        </div>
    `).join('');
    
    // Add click listeners
    dropdownList.querySelectorAll('.dropdown-item').forEach((item, index) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            selectUser(filteredUsers[index]);
        });
        
        item.addEventListener('mouseenter', () => {
            selectedIndex = index;
            updateSelection();
        });
    });
    
    // Immediately trigger image loading for visible avatars
    setTimeout(() => {
        updateLoadedImages();
    }, 0);
}



function updateLoadedImages() {
    const avatars = dropdownList.querySelectorAll('.user-avatar');
    
    avatars.forEach(avatar => {
        const src = avatar.dataset.src;
        const imageStatus = getImageStatus(src);
        const img = avatar.querySelector('img');
        
        if (imageStatus === 'loaded' && !img.src) {
            img.src = src;
        } else if (imageStatus === 'error' && !avatar.classList.contains('error')) {
            handleImageError(img);
        } else if (imageStatus === 'loading' && !img.src) {
            img.src = src;
        }
    });
}

function selectUser(userData) {
    console.log('selectUser called with:', userData);
    console.log('userData type:', typeof userData);
    console.log('userData.name:', userData.name);
    
    currentUser = userData.name;
    console.log('currentUser set to:', currentUser);
    
    hideDropdown();
    searchInput.blur();
    updateCardDisplay();
    showCardPage();
    checkInstanceStatus();
    
    // Refresh the copy link when a user is selected
    updateCopyLink();
}

function showCardPage() {
    selectionPage.style.display = 'none';
    cardPage.style.display = 'block';
    setTimeout(() => { cardPage.classList.add('visible'); }, 50);
}

function showSelectionPage() {
    cardPage.classList.remove('visible');
    setTimeout(() => {
        cardPage.style.display = 'none';
        selectionPage.style.display = 'flex';
        selectionPage.classList.add('returning');
        searchInput.value = '';
        filteredUsers = [...allUsers];
        selectedIndex = -1;
        renderDropdown();
        setTimeout(() => { 
            searchInput.focus(); 
            showDropdown(); 
        }, 50);
    }, 300);
    clearLogs();
    currentUser = null;
}

function updateCardDisplay() {
    if (!currentUser) return;
    const imageName = currentUser.toLowerCase();
    const imagePath = `images/${imageName}.png`;
    userCard.style.backgroundImage = `url('${imagePath}')`;
    cardTitle.textContent = currentUser;
}

async function updateCopyLink() {
    try {
        const response = await fetch('/copy_link');
        const data = await response.json();
        
        // Properly set the text content - don't truncate long URLs
        const linkText = data.link || 'Link unavailable';
        copyText.textContent = linkText;
        
        // Store the full link for opening
        copyText.dataset.fullLink = linkText;
        
        console.log('Copy link updated:', linkText);
    } catch (error) {
        console.error('Error fetching link:', error);
        copyText.textContent = 'Link unavailable';
        copyText.dataset.fullLink = '';
    }
}

async function checkInstanceStatus() {
    try {
        const response = await fetch('/status');
        const data = await response.json();
        updateStatusIndicator(data.running, data.user);
        
        // If an instance is running, start polling the single log file
        if (data.running) {
            startLogPolling('comfyui');
        }
    } catch (error) {
        console.error('Error checking status:', error);
    }
}

function updateStatusIndicator(isRunning, runningUser) {
    const statusDot = document.querySelector('#statusIndicator .status-dot');
    const statusText = document.querySelector('#statusIndicator .status-text');
    if (!statusDot || !statusText) return;
    
    if (isRunning) {
        statusDot.className = 'status-dot running';
        statusText.textContent = `Running (by ${runningUser || '...'})`;
    } else {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Ready';
    }
}

function handleLogsScroll() {
    const buffer = 20;
    const distanceFromBottom = logsWrapper.scrollHeight - logsWrapper.scrollTop - logsWrapper.clientHeight;
    const wasAutoScrollEnabled = autoScrollEnabled;
    autoScrollEnabled = distanceFromBottom <= buffer;
    if (wasAutoScrollEnabled !== autoScrollEnabled) {
        updateJumpButtonState();
    }
}

function updateJumpButtonState() {
    jumpButton.classList.toggle('show', !autoScrollEnabled);
}

function scrollToBottom() {
    if (autoScrollEnabled) {
        setTimeout(() => { logsWrapper.scrollTop = logsWrapper.scrollHeight; }, 0);
    }
}

async function fetchLogs(logIdentifier) {
    try {
        const response = await fetch(`/logs/${logIdentifier}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        const data = await response.text();
        
        // Use textContent instead of innerHTML for better performance with large logs
        if (logBox.textContent !== data) {
            logBox.textContent = data;
            const contentHeightChanged = logBox.scrollHeight > lastContentHeight;
            lastContentHeight = logBox.scrollHeight;
            if (contentHeightChanged) {
                scrollToBottom();
            }
        }
    } catch (error) {
        console.error('Error fetching logs:', error);
        logBox.textContent = `Error fetching logs: ${error.message}`;
    }
}

function startLogPolling(logIdentifier) {
    if (logInterval) clearInterval(logInterval);
    autoScrollEnabled = true;
    updateJumpButtonState();
    lastContentHeight = 0;
    fetchLogs(logIdentifier);
    logInterval = setInterval(() => fetchLogs(logIdentifier), 2000);
}

function clearLogs() {
    logBox.innerHTML = 'No logs available. Start an instance to see logs.';
    lastContentHeight = 0;
    if (logInterval) {
        clearInterval(logInterval);
        logInterval = null;
    }
}

async function startComfy() {
    console.log('startComfy called');
    console.log('currentUser value:', currentUser);
    console.log('currentUser type:', typeof currentUser);
    
    if (!currentUser) {
        console.error('currentUser is empty/null/undefined:', currentUser);
        showNotification('No user selected', 'error');
        return;
    }

    console.log('Starting ComfyUI for user:', currentUser);
    console.log('API URL will be:', `/start_comfyui/${currentUser}`);

    try {
        showNotification('Starting ComfyUI instance...', 'info');

        const response = await fetch(`/start_comfyui/${currentUser}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.text();
        console.log('Backend response:', data);

        // Parse response (handle both JSON and plain text)
        let result;
        try {
            result = JSON.parse(data);
        } catch (e) {
            result = { success: true, message: data };
        }

        if (result.success !== false) {
            showNotification(result.message || data, 'success');
            startLogPolling('comfyui');
            updateStatusIndicator(true, currentUser);
        } else {
            showNotification(result.message || 'Failed to start ComfyUI', 'error');
        }

    } catch (error) {
        console.error('Error starting ComfyUI:', error);
        showNotification(`Network error: ${error.message}`, 'error');
    }
}

async function stopComfy() {
    try {
        showNotification('Stopping ComfyUI instance...', 'info');
        const response = await fetch('/stop_comfyui');
        const data = await response.text();
        
        // Parse response (handle both JSON and plain text)
        let result;
        try {
            result = JSON.parse(data);
        } catch (e) {
            result = { success: true, message: data };
        }
        
        if (result.success !== false) {
            showNotification(result.message || data, 'success');
            clearLogs();
            updateStatusIndicator(false, null);
        } else {
            showNotification(result.message || 'Failed to stop ComfyUI', 'error');
        }
    } catch (error) {
        console.error('Error stopping ComfyUI:', error);
        showNotification('Network error: Failed to stop ComfyUI', 'error');
    }
}

async function setupComfy() {
    console.log('setupComfy() called - starting debug');
    
    try {
        showNotification('Starting model download...', 'info');
        console.log('About to fetch /setup');
        
        const response = await fetch('/setup', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        console.log('Fetch response received:', response);
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success) {
            showNotification(data.message, 'success');
            console.log('Starting log polling for model_downloads');
            startLogPolling('model_downloads');
        } else {
            showNotification(data.message || 'Failed to start setup', 'error');
        }
    } catch (error) {
        console.error('Error in setupComfy:', error);
        console.error('Error stack:', error.stack);
        showNotification(`Network error: ${error.message}`, 'error');
    }
}

function openLinkInNewTab() {
    // Get the full link from the data attribute or text content
    const link = copyText.dataset.fullLink || copyText.textContent;
    
    console.log('Attempting to open link:', link);
    
    if (link && link !== 'Link unavailable' && link.trim() !== '') {
        try {
            window.open(link, '_blank', 'noopener,noreferrer');
            showNotification('Opening ComfyUI in new tab...', 'success');
        } catch (error) {
            console.error('Error opening link:', error);
            showNotification('Failed to open link', 'error');
        }
    } else {
        showNotification('No valid link available', 'error');
        console.log('No valid link found. copyText content:', copyText.textContent);
    }
}

function showNotification(message, type = 'info') {
    document.querySelectorAll('.notification').forEach(n => n.remove());
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => { notification.style.transform = 'translateX(0)'; }, 100);
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => { if (document.body.contains(notification)) { notification.remove(); } }, 300);
    }, type === 'error' ? 5000 : 3000);
}

// --- PARTICLE BACKGROUND EFFECT ---

class Pixel {
  constructor(canvas, context, x, y, color, speed, delay) {
    this.width = canvas.width;
    this.height = canvas.height;
    this.ctx = context;
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = this.getRandomValue(0.1, 0.9) * speed;
    this.size = 0;
    this.sizeStep = Math.random() * 0.4;
    this.minSize = 0.5;
    this.maxSizeInteger = 2;
    this.maxSize = this.getRandomValue(this.minSize, this.maxSizeInteger);
    this.delay = delay;
    this.counter = 0;
    this.counterStep = Math.random() * 4 + (this.width + this.height) * 0.01;
    this.isIdle = true;
    this.isReverse = false;
    this.isShimmer = false;
    this.easingSpeed = 0.08; // Adjust for faster/slower easing
    this.threshold = 0.01; // When to consider animation complete
  }

  getRandomValue(min, max) {
    return Math.random() * (max - min) + min;
  }

  draw() {
    const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5;
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
  }

  appear() {
    this.isIdle = false;
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      return;
    }
    if (this.size >= this.maxSize) {
      this.isShimmer = true;
    }
    if (this.isShimmer) {
      this.shimmer();
    } else {
      this.size += this.sizeStep;
    }
    this.draw();
  }

  disappear() {
  this.isShimmer = false;
  this.counter = 0;
  
  if (this.size <= this.threshold) {
    this.isIdle = true;
    this.size = 0;
    return;
  }
  
  // Smooth easing to zero instead of fixed step
  const diff = 0 - this.size;
  this.size += diff * this.easingSpeed;
  
  this.draw();
}

  shimmer() {
    if (this.size >= this.maxSize) {
      this.isReverse = true;
    } else if (this.size <= this.minSize) {
      this.isReverse = false;
    }
    if (this.isReverse) {
      this.size -= this.speed;
    } else {
      this.size += this.speed;
    }
  }
}

class PixelCanvas extends HTMLElement {
  static register(tag = "pixel-canvas") {
    if ("customElements" in window) {
      customElements.define(tag, this);
    }
  }

  static css = `
    :host {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      pointer-events: none;
      overflow: hidden;
    }
    canvas {
        display: block;
        width: 100%;
        height: 100%;
    }
  `;

  constructor() {
    super();
    this.isWindowFocused = !document.hidden;
    this.lastInteractionTime = 0;
    this.interactionTimeout = null;
    this.animationState = 'idle';
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleWindowFocus = this.handleWindowFocus.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleUserInteraction = this.handleUserInteraction.bind(this);
  }

  get colors() {
    return this.dataset.colors?.split(",") || ["#f8fafc", "#f1f5f9", "#cbd5e1"];
  }

  get gap() {
    return parseInt(this.dataset.gap || 10);
  }

  get speed() {
    const value = this.dataset.speed || 35;
    const min = 0;
    const max = 100;
    const throttle = 0.001;
    if (value <= min || this.reducedMotion) return min;
    if (value >= max) return max * throttle;
    return parseInt(value) * throttle;
  }

  connectedCallback() {
    const canvas = document.createElement("canvas");
    const sheet = new CSSStyleSheet();
    this.shadowroot = this.attachShadow({ mode: "open" });
    sheet.replaceSync(PixelCanvas.css);
    this.shadowroot.adoptedStyleSheets = [sheet];
    this.shadowroot.append(canvas);
    this.canvas = this.shadowroot.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.timeInterval = 1000 / 60;
    this.timePrevious = performance.now();
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.init();
    this.resizeObserver = new ResizeObserver(() => this.init());
    this.resizeObserver.observe(this);
    this.setupEventListeners();
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.removeEventListeners();
    if (this.interactionTimeout) clearTimeout(this.interactionTimeout);
  }

  setupEventListeners() {
    window.addEventListener('focus', this.handleWindowFocus);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    document.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    const interactionEvents = ['click', 'keydown', 'scroll', 'touchstart'];
    interactionEvents.forEach(event => {
      document.addEventListener(event, this.handleUserInteraction, { passive: true });
    });
  }

  removeEventListeners() {
    window.removeEventListener('focus', this.handleWindowFocus);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    document.removeEventListener('mousemove', this.handleMouseMove);
    const interactionEvents = ['click', 'keydown', 'scroll', 'touchstart'];
    interactionEvents.forEach(event => {
      document.removeEventListener(event, this.handleUserInteraction);
    });
  }

  handleWindowFocus() { this.isWindowFocused = true; }
  handleWindowBlur() {
    this.isWindowFocused = false;
    this.handleAnimation("disappear");
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.isWindowFocused = false;
      this.handleAnimation("disappear");
    } else {
      this.isWindowFocused = true;
    }
  }

  handleMouseMove(event) {
    if (!this.isWindowFocused || document.hidden) return;
    const now = Date.now();
    if (now - this.lastInteractionTime < 50) return;
    this.lastInteractionTime = now;
    const isOverViewport = (event.clientX >= 0 && event.clientX <= window.innerWidth && event.clientY >= 0 && event.clientY <= window.innerHeight);
    if (isOverViewport) this.handleUserInteraction();
  }

  handleUserInteraction() {
    if (!this.isWindowFocused || document.hidden) return;
    if (this.interactionTimeout) clearTimeout(this.interactionTimeout);
    this.handleAnimation("appear");
    this.interactionTimeout = setTimeout(() => {
      if (this.isWindowFocused && !document.hidden) {
        this.handleAnimation("disappear");
      }
    }, 3000);
  }

  handleAnimation(name) {
    if (!this.isWindowFocused || document.hidden) name = "disappear";
    if (this.animationState === name) return;
    this.animationState = name;
    cancelAnimationFrame(this.animation);
    this.animation = this.animate(name);
  }

  init() {
    const rect = this.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    this.pixels = [];
    this.canvas.width = width;
    this.canvas.height = height;
    this.createPixels();
  }

  getDistanceToCanvasCenter(x, y) {
    const dx = x - this.canvas.width / 2;
    const dy = y - this.canvas.height / 2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  createPixels() {
    for (let x = 0; x < this.canvas.width; x += this.gap) {
      for (let y = 0; y < this.canvas.height; y += this.gap) {
        const color = this.colors[Math.floor(Math.random() * this.colors.length)];
        const delay = this.reducedMotion ? 0 : this.getDistanceToCanvasCenter(x, y);
        this.pixels.push(new Pixel(this.canvas, this.ctx, x, y, color, this.speed, delay));
      }
    }
  }

  animate(fnName) {
    this.animation = requestAnimationFrame(() => this.animate(fnName));
    const timeNow = performance.now();
    const timePassed = timeNow - this.timePrevious;
    if (timePassed < this.timeInterval) return;
    this.timePrevious = timeNow - (timePassed % this.timeInterval);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let i = 0; i < this.pixels.length; i++) {
      this.pixels[i][fnName]();
    }
    if (this.pixels.every((pixel) => pixel.isIdle)) {
      cancelAnimationFrame(this.animation);
      this.animationState = 'idle';
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

PixelCanvas.register();

// --- IMAGE LOADING STYLES ---
const loadingStyles = `
.user-avatar {
    position: relative;
    overflow: hidden;
    width: 40px;
    height: 40px;
    border-radius: 50%;
}

.user-avatar img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.3s ease;
    opacity: 0;
    display: block;
}

.user-avatar img.loaded {
    opacity: 1 !important;
}

.user-avatar.loading .avatar-skeleton {
    opacity: 1;
}

.user-avatar.loaded .avatar-skeleton {
    opacity: 0;
}

.user-avatar.error .avatar-fallback {
    display: flex !important;
}

.avatar-skeleton {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.1) 0%,
        rgba(255, 255, 255, 0.2) 50%,
        rgba(255, 255, 255, 0.1) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 2;
}

.avatar-skeleton.visible {
    opacity: 1;
}

.avatar-fallback {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: none;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1.1rem;
    color: white;
    background: linear-gradient(135deg, #666, #999);
    transition: opacity 0.3s ease;
    z-index: 1;
}

.avatar-fallback.visible {
    opacity: 1;
    display: flex !important;
}

@keyframes shimmer {
    0% {
        background-position: -200% 0;
    }
    100% {
        background-position: 200% 0;
    }
}
`;


const styleSheet = document.createElement('style');
styleSheet.textContent = loadingStyles;
document.head.appendChild(styleSheet);