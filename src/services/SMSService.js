/*
OLDER CLAUDE IMPLEMENTATION

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APIService } from './APIService';
import { EncryptionService } from './EncryptionService';

const { SMSNativeModule } = NativeModules;

class SMSServiceClass {
  constructor() {
    this.eventEmitter = null;
    this.smsListener = null;
    this.messageQueue = [];
    this.isInitialized = false;
    
    if (Platform.OS === 'android' && SMSNativeModule) {
      this.eventEmitter = new NativeEventEmitter(SMSNativeModule);
    }
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Set up SMS listener
      if (this.eventEmitter) {
        this.smsListener = this.eventEmitter.addListener(
          'smsReceived',
          this.handleIncomingSMS.bind(this)
        );
      }

      // Process any queued messages
      await this.processQueuedMessages();
      
      this.isInitialized = true;
      console.log('SMS Service initialized successfully');
    } catch (error) {
      console.error('SMS Service initialization failed:', error);
      throw error;
    }
  }

  async handleIncomingSMS(smsData) {
    try {
      console.log('Incoming SMS:', smsData);
      
      // Check if forwarding is enabled
      const settings = await this.getSettings();
      if (!settings.forwardingEnabled) {
        console.log('SMS forwarding is disabled');
        return;
      }

      // Encrypt message before forwarding
      const encryptedMessage = await EncryptionService.encrypt({
        sender: smsData.sender,
        body: smsData.body,
        timestamp: smsData.timestamp,
        deviceId: await this.getDeviceId(),
      });

      // Forward to parent
      await this.forwardSMSToParent(encryptedMessage);
      
      // Store locally for backup
      await this.storeMessage(smsData);
      
    } catch (error) {
      console.error('Error handling incoming SMS:', error);
      // Queue for later processing if network issues
      this.queueMessage(smsData);
    }
  }

  async forwardSMSToParent(encryptedMessage) {
    try {
      const parentDeviceId = await AsyncStorage.getItem('parentDeviceId');
      if (!parentDeviceId) {
        throw new Error('Parent device not configured');
      }

      const response = await APIService.forwardSMS({
        parentDeviceId,
        encryptedMessage,
        timestamp: Date.now(),
      });

      if (response.success) {
        console.log('SMS forwarded successfully');
      } else {
        throw new Error('API forwarding failed');
      }
    } catch (error) {
      console.error('Error forwarding SMS:', error);
      throw error;
    }
  }

  async storeMessage(smsData) {
    try {
      const messages = await this.getStoredMessages();
      messages.unshift({
        ...smsData,
        id: `msg_${Date.now()}_${Math.random()}`,
        stored: true,
      });

      // Keep only last 1000 messages
      if (messages.length > 1000) {
        messages.splice(1000);
      }

      await AsyncStorage.setItem('smsMessages', JSON.stringify(messages));
    } catch (error) {
      console.error('Error storing message:', error);
    }
  }

  async getStoredMessages() {
    try {
      const stored = await AsyncStorage.getItem('smsMessages');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting stored messages:', error);
      return [];
    }
  }

  queueMessage(smsData) {
    this.messageQueue.push({
      ...smsData,
      queuedAt: Date.now(),
    });
    
    // Limit queue size
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
    }
  }

  async processQueuedMessages() {
    if (this.messageQueue.length === 0) return;

    console.log(`Processing ${this.messageQueue.length} queued messages`);
    
    const processedMessages = [];
    
    for (const message of this.messageQueue) {
      try {
        await this.handleIncomingSMS(message);
        processedMessages.push(message);
      } catch (error) {
        console.error('Error processing queued message:', error);
        // Keep failed messages in queue
      }
    }

    // Remove successfully processed messages
    this.messageQueue = this.messageQueue.filter(
      msg => !processedMessages.includes(msg)
    );
  }

  async getSettings() {
    try {
      const settings = await AsyncStorage.getItem('smsSettings');
      return settings ? JSON.parse(settings) : {
        forwardingEnabled: true,
        encryptionEnabled: true,
        parentNotifications: true,
        emergencyKeywords: ['help', 'emergency', 'urgent'],
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      return { forwardingEnabled: true };
    }
  }

  async updateSettings(newSettings) {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...newSettings };
      await AsyncStorage.setItem('smsSettings', JSON.stringify(updatedSettings));
      return updatedSettings;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  async getDeviceId() {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('deviceId', deviceId);
      }
      return deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return 'unknown_device';
    }
  }

  async getSetupStatus() {
    try {
      const setupComplete = await AsyncStorage.getItem('setupComplete');
      const isParentMode = await AsyncStorage.getItem('isParentMode');
      
      return {
        isComplete: setupComplete === 'true',
        isParentMode: isParentMode === 'true',
      };
    } catch (error) {
      console.error('Error getting setup status:', error);
      return { isComplete: false, isParentMode: false };
    }
  }

  async completeSetup(isParentMode = false) {
    try {
      await AsyncStorage.setItem('setupComplete', 'true');
      await AsyncStorage.setItem('isParentMode', isParentMode.toString());
      
      if (!isParentMode) {
        // Initialize child device
        await this.initialize();
      }
    } catch (error) {
      console.error('Error completing setup:', error);
      throw error;
    }
  }

  destroy() {
    if (this.smsListener) {
      this.smsListener.remove();
      this.smsListener = null;
    }
    this.isInitialized = false;
  }
}

export const SMSService = new SMSServiceClass();
*/

import { NativeModules } from 'react-native';
const { SMSBridge } = NativeModules;

const SMSService = {
  initialize: async () => {
    try {
      await SMSBridge.initializeScreenTimeMonitor();
      return { success: true };
    } catch (error) {
      console.error('ScreenTime Init Error:', error);
      return { success: false };
    }
  },

  fetchReports: async (daysBack = 7) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysBack);
    
    return SMSBridge.fetchDeviceActivityReports(startDate, endDate);
  }

  // SMSService.js
const syncICloudMessages = async () => {
  const messages = await NativeModules.CloudKitManager.fetchMessagesSince(lastSync);
  storeEncrypted(messages);
};

};
