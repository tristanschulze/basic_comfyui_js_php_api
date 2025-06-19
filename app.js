/**
 * Main application controller for ComfyUI Image Generator
 * Handles WebSocket communication, UI updates, and image processing
 */

class ImageGenerator {
    constructor() {
        this.socket = null;
        this.imageChunks = [];
        this.isReceivingImage = false;
        this.reconnectAttempts = 0;
        this.MAX_RECONNECT_ATTEMPTS = 3;
        this.CONNECTION_TIMEOUT = 5000; // 5 seconds
        this.IMAGE_TIMEOUT = 30000; // 30 seconds
        
        // DOM Elements
        this.elements = {
            generateBtn: document.getElementById('generate-btn'),
            promptInput: document.getElementById('prompt'),
            generatedImage: document.getElementById('generated-image'),
            statusElement: document.getElementById('status'),
            debugMessages: document.getElementById('debug-messages')
        };
        
        // Initialize event listeners
        this.initEventListeners();
    }
    
    /**
     * Initialize all event listeners
     */
    initEventListeners() {
        this.elements.generateBtn.addEventListener('click', () => this.handleGenerateClick());
        document.getElementById('clear-debug').addEventListener('click', () => {
            this.elements.debugMessages.innerHTML = '';
        });
    }
    
    /**
     * Handle generate button click
     */
    async handleGenerateClick() {
        const prompt = this.elements.promptInput.value.trim();
        
        if (!prompt) {
            this.showError('Please enter a prompt');
            return;
        }
        
        try {
            await this.withWebSocketConnection(async () => {
                this.resetUI();
                await this.sendGenerationRequest(prompt);
                await this.waitForImage();
            });
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    /**
     * Reset UI elements for a new generation
     */
    resetUI() {
        this.elements.generatedImage.style.display = 'none';
        this.elements.generatedImage.src = '';
        this.setStatus('Starting generation...', 'loading');
        this.imageChunks = [];
        this.isReceivingImage = false;
    }
    
    /**
     * Send generation request to server
     * @param {string} prompt - The text prompt for image generation
     */
    async sendGenerationRequest(prompt) {
        this.debugLog("Sending generation request", "info");
        
        const response = await fetch('generate.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `prompt=${encodeURIComponent(prompt)}`
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Generation failed');
        }
        
        this.debugLog("Generation started successfully", "success");
    }
    
    /**
     * Wait for image to be received via WebSocket
     */
    async waitForImage() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Image reception timeout'));
            }, this.IMAGE_TIMEOUT);
            
            const checkInterval = setInterval(() => {
                if (!this.isReceivingImage && this.imageChunks.length > 0) {
                    clearTimeout(timeout);
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }
    
    /**
     * Execute callback with active WebSocket connection
     * @param {Function} callback - Function to execute with active connection
     */
    async withWebSocketConnection(callback) {
        try {
            if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
                await this.connectWebSocket();
            }
            return await callback();
        } finally {
            this.disconnectWebSocket();
        }
    }
    
    /**
     * Connect to WebSocket server
     */
    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
                reject(new Error('Max reconnection attempts reached'));
                return;
            }
            
            const wsUrl = 'wss://seeds-alarm-cases-accommodation.trycloudflare.com/ws';
            this.debugLog(`Connecting to WebSocket: ${wsUrl}`);
            
            this.socket = new WebSocket(wsUrl);
            this.socket.binaryType = 'arraybuffer';
            
            const timeout = setTimeout(() => {
                this.socket.close();
                reject(new Error('Connection timeout'));
            }, this.CONNECTION_TIMEOUT);
            
            this.socket.onopen = () => {
                clearTimeout(timeout);
                this.debugLog("WebSocket connected", "success");
                this.reconnectAttempts = 0;
                this.setStatus('Connected to server', 'success');
                resolve();
            };
            
            this.socket.onmessage = (event) => this.handleWebSocketMessage(event);
            
            this.socket.onclose = () => {
                this.debugLog("WebSocket closed", "info");
                this.socket = null;
            };
            
            this.socket.onerror = (error) => {
                this.debugLog(`WebSocket error: ${error.message}`, "error");
                reject(error);
            };
        });
    }
    
    /**
     * Disconnect from WebSocket server
     */
    disconnectWebSocket() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
    
    /**
     * Handle incoming WebSocket messages
     * @param {MessageEvent} event - WebSocket message event
     */
 


/**
 * Process parsed WebSocket message
 * @param {Object} message - Parsed message object
 */
processWsMessage(message) {
    if (!message || !message.type) {
        this.debugLog("Received malformed message", "warning");
        return;
    }

    switch (message.type) {
        case "status":
            this.debugLog(`Server status: ${JSON.stringify(message.data)}`, "info");
            break;
            
        case "progress":
            const percent = Math.round((message.data.value / message.data.max) * 100);
            this.setStatus(`Generating... ${percent}%`, 'loading');
            break;
            
        case "executing":
            if (message.data.node === null) {
                this.debugLog("Generation completed", "success");
                if (this.isReceivingImage && this.imageChunks.length > 0) {
                    this.displayFinalImage();
                }
                this.isReceivingImage = false;
            }
            break;
            
        default:
            this.debugLog(`Unknown message type: ${message.type}`, "warning");
    }
} 
 
 
handleWebSocketMessage(event) {
    // Handle binary image data
    if (event.data instanceof ArrayBuffer) {
        this.handleBinaryData(event.data);
        return;
    }
    
    // Handle string messages - Fix for JSON parsing
    let message;
    try {
        // Some WebSocket implementations auto-parse JSON
        message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch (e) {
        this.debugLog(`Non-JSON message: ${event.data}`, "info");
        return;
    }
    
    // Process the message
    this.processWsMessage(message);
}
    
    /**
     * Handle binary data from WebSocket
     * @param {ArrayBuffer} data - Binary image data
     */
    handleBinaryData(data) {
        this.debugLog(`Received binary data (${data.byteLength} bytes)`, "info");
        
        const imageData = new Uint8Array(data).slice(8); // Remove 8-byte header
        this.imageChunks.push(imageData);
        
        if (!this.isReceivingImage) {
            this.debugLog("Starting new image reception", "info");
            this.isReceivingImage = true;
            this.setStatus('Receiving image...', 'loading');
        }
        
        // Display image after a brief pause to allow chunks to arrive
        clearTimeout(this.imageTimeout);
        this.imageTimeout = setTimeout(() => this.displayFinalImage(), 300);
    }
    
    /**
     * Handle text messages from WebSocket
     * @param {string} message - Text message
     */
    handleTextMessage(message) {
        this.debugLog(`Received message: ${message.substring(0, 100)}`, "info");
        
        try {
            const msg = JSON.parse(message);
            
            if (msg.type === "progress") {
                const percent = Math.round((msg.data.value / msg.data.max) * 100);
                this.setStatus(`Generating... ${percent}%`, 'loading');
                return;
            }
            
            if (msg.type === "executing" && msg.data.node === null) {
                this.debugLog("Generation completed", "success");
                if (this.isReceivingImage && this.imageChunks.length > 0) {
                    this.displayFinalImage();
                }
                this.isReceivingImage = false;
            }
        } catch (e) {
            this.debugLog(`Non-JSON message: ${message}`, "info");
        }
    }
    
    /**
     * Combine chunks and display final image
     */
    displayFinalImage() {
        if (this.imageChunks.length === 0) {
            this.debugLog("No image data to display", "warning");
            return;
        }
        
        // Combine all chunks
        const totalLength = this.imageChunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        this.imageChunks.forEach(chunk => {
            combined.set(chunk, offset);
            offset += chunk.length;
        });
        
        // Create blob and display image
        const blob = new Blob([combined], { type: 'image/png' });
        const imgElement = this.elements.generatedImage;
        
        // Clean up previous image if exists
        if (imgElement.src.startsWith('blob:')) {
            URL.revokeObjectURL(imgElement.src);
        }
        
        imgElement.onload = () => {
            this.debugLog("Image successfully loaded", "success");
            this.setStatus('Image received!', 'success');
        };
        
        imgElement.onerror = () => {
            this.debugLog("Failed to load image data", "error");
            // Fallback to base64 if blob fails
            const imgData = btoa(String.fromCharCode.apply(null, combined));
            imgElement.src = `data:image/png;base64,${imgData}`;
        };
        
        imgElement.src = URL.createObjectURL(blob);
        imgElement.style.display = 'block';
        this.imageChunks = [];
        this.isReceivingImage = false;
    }
    
    /**
     * Set status message
     * @param {string} text - Status text
     * @param {string} type - Status type (ready/loading/success/error)
     */
    setStatus(text, type) {
        this.elements.statusElement.textContent = text;
        this.elements.statusElement.className = `status-${type}`;
    }
    
    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.debugLog(`Error: ${message}`, "error");
        this.setStatus(`Error: ${message}`, 'error');
    }
    
    /**
     * Log debug message
     * @param {string} message - Debug message
     * @param {string} type - Message type (info/success/warning/error)
     */
    debugLog(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `debug-message debug-${type}`;
        messageDiv.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        this.elements.debugMessages.prepend(messageDiv);
        console[type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log'](message);
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ImageGenerator();
});
