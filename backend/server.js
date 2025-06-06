const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// WebSocket server for real-time communication
const wss = new WebSocket.Server({ port: 8080 });

// Store active connections
const activeConnections = new Map();
const messageStore = new Map(); // Simple in-memory store

// Encryption utilities
function encrypt(text, password) {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(password, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decrypt(encryptedData, password) {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(password, 'salt', 32);
  const decipher = crypto.createDecipher(algorithm, key);
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const deviceId = req.url.split('?deviceId=')[1];
  console.log(`Device connected: ${deviceId}`);
  
  activeConnections.set(deviceId, ws);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(data, deviceId);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    activeConnections.delete(deviceId);
    console.log(`Device disconnected: ${deviceId}`);
  });
  
  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connection_confirmed',
    deviceId,
    timestamp: new Date().toISOString()
  }));
});

function handleMessage(data, deviceId) {
  const messageId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // Store message
  messageStore.set(messageId, {
    ...data,
    deviceId,
    timestamp,
    id: messageId
  });
  
  // Forward to all connected devices except sender
  activeConnections.forEach((connection, connectedDeviceId) => {
    if (connectedDeviceId !== deviceId && connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify({
        ...data,
        id: messageId,
        timestamp,
        sourceDevice: deviceId
      }));
    }
  });
}

// REST API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeConnections: activeConnections.size
  });
});

// Register device
app.post('/api/register', (req, res) => {
  const { deviceId, deviceName, platform } = req.body;
  
  if (!deviceId || !deviceName) {
    return res.status(400).json({ error: 'Device ID and name required' });
  }
  
  // Simple device registration (in production, use proper database)
  const deviceInfo = {
    deviceId,
    deviceName,
    platform,
    registeredAt: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };
  
  res.json({
    success: true,
    device: deviceInfo,
    websocketUrl: `ws://localhost:8080?deviceId=${deviceId}`
  });
});

// Send SMS via API
app.post('/api/sms/send', (req, res) => {
  const { to, message, deviceId, encrypted } = req.body;
  
  if (!to || !message) {
    return res.status(400).json({ error: 'Recipient and message required' });
  }
  
  const smsData = {
    type: 'sms_send_request',
    to,
    message,
    encrypted,
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  };
  
  // Send to specific device or broadcast
  if (deviceId && activeConnections.has(deviceId)) {
    const connection = activeConnections.get(deviceId);
    if (connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify(smsData));
      res.json({ success: true, requestId: smsData.requestId });
    } else {
      res.status(503).json({ error: 'Device not available' });
    }
  } else {
    // Broadcast to first available device
    const availableDevice = Array.from(activeConnections.entries())
      .find(([_, ws]) => ws.readyState === WebSocket.OPEN);
    
    if (availableDevice) {
      availableDevice[1].send(JSON.stringify(smsData));
      res.json({ success: true, requestId: smsData.requestId });
    } else {
      res.status(503).json({ error: 'No devices available' });
    }
  }
});

// Get message history
app.get('/api/messages', (req, res) => {
  const { deviceId, limit = 50 } = req.query;
  
  let messages = Array.from(messageStore.values());
  
  if (deviceId) {
    messages = messages.filter(msg => msg.deviceId === deviceId);
  }
  
  messages = messages
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, parseInt(limit));
  
  res.json({ messages });
});

// Get connected devices
app.get('/api/devices', (req, res) => {
  const devices = Array.from(activeConnections.keys()).map(deviceId => ({
    deviceId,
    connected: true,
    lastSeen: new Date().toISOString()
  }));
  
  res.json({ devices });
});

// Encryption endpoints
app.post('/api/encrypt', (req, res) => {
  const { text, password } = req.body;
  
  if (!text || !password) {
    return res.status(400).json({ error: 'Text and password required' });
  }
  
  try {
    const encrypted = encrypt(text, password);
    res.json({ encrypted });
  } catch (error) {
    res.status(500).json({ error: 'Encryption failed' });
  }
});

app.post('/api/decrypt', (req, res) => {
  const { encryptedData, password } = req.body;
  
  if (!encryptedData || !password) {
    return res.status(400).json({ error: 'Encrypted data and password required' });
  }
  
  try {
    const decrypted = decrypt(encryptedData, password);
    res.json({ decrypted });
  } catch (error) {
    res.status(500).json({ error: 'Decryption failed' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`SMS Mirror API server running on port ${PORT}`);
  console.log(`WebSocket server running on port 8080`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

module.exports = app;
