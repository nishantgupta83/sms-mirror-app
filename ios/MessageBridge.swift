import Foundation
import Messages
import UserNotifications
import Network
import React

@objc(MessageBridge)
class MessageBridge: NSObject, RCTBridgeModule {
    
    static let shared = MessageBridge()
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
    private var bridge: RCTBridge?
    
    static func moduleName() -> String! {
        return "MessageBridge"
    }
    
    override init() {
        super.init()
        setupWebSocket()
        setupNotifications()
    }
    
    // MARK: - React Native Bridge Methods
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    @objc
    func startMessageMonitoring(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        // Note: iOS doesn't allow direct SMS interception like Android
        // This would require using Shortcuts app or other workarounds
        // For demo purposes, we'll simulate message monitoring
        
        requestNotificationPermissions { granted in
            if granted {
                resolve(["status": "started", "deviceId": self.deviceId])
            } else {
                reject("PERMISSION_DENIED", "Notification permission required", nil)
            }
        }
    }
    
    @objc
    func sendMessage(_ phoneNumber: String, message: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        // iOS doesn't allow programmatic SMS sending from third-party apps
        // This would open the Messages app with pre-filled content
        
        guard let url = URL(string: "sms:\(phoneNumber)&body=\(message.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") else {
            reject("INVALID_URL", "Could not create SMS URL", nil)
            return
        }
        
        DispatchQueue.main.async {
            if UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url) { success in
                    if success {
                        resolve(["success": true, "message": "SMS app opened"])
                    } else {
                        reject("OPEN_FAILED", "Could not open SMS app", nil)
                    }
                }
            } else {
                reject("SMS_UNAVAILABLE", "SMS not available on this device", nil)
            }
        }
    }
    
    @objc
    func getDeviceInfo(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        let deviceInfo = [
            "deviceId": deviceId,
            "platform": "iOS",
            "model": UIDevice.current.model,
            "systemVersion": UIDevice.current.systemVersion,
            "name": UIDevice.current.name
        ]
        resolve(deviceInfo)
    }
    
    @objc
    func connectToServer(_ serverUrl: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard let url = URL(string: "\(serverUrl)?deviceId=\(deviceId)") else {
            reject("INVALID_URL", "Invalid server URL", nil)
            return
        }
        
        setupWebSocket(url: url)
        resolve(["connected": true, "deviceId": deviceId])
    }
    
    // MARK: - WebSocket Setup
    
    private func setupWebSocket(url: URL? = nil) {
        let defaultUrl = URL(string: "ws://localhost:8080?deviceId=\(deviceId)")!
        let serverUrl = url ?? defaultUrl
        
        urlSession = URLSession(configuration: .default)
        webSocketTask = urlSession?.webSocketTask(with: serverUrl)
        
        webSocketTask?.resume()
        receiveMessage()
        
        // Send initial connection message
        sendWebSocketMessage([
            "type": "device_connected",
            "deviceId": deviceId,
            "platform": "iOS",
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ])
    }
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleWebSocketMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self?.handleWebSocketMessage(text)
                    }
                @unknown default:
                    break
                }
                self?.receiveMessage() // Continue listening
                
            case .failure(let error):
                print("WebSocket receive error: \(error)")
                // Attempt to reconnect after delay
                DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                    self?.setupWebSocket()
                }
            }
        }
    }
    
    private func handleWebSocketMessage(_ message: String) {
        guard let data = message.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }
        
        // Forward message to React Native
        if let bridge = self.bridge {
            bridge.eventDispatcher().sendAppEvent(withName: "SMSReceived", body: json)
        }
        
        // Handle different message types
        if let type = json["type"] as? String {
            switch type {
            case "sms_send_request":
                handleSendRequest(json)
            case "ping":
                sendPong()
            default:
                break
            }
        }
    }
    
    private func handleSendRequest(_ data: [String: Any]) {
        guard let to = data["to"] as? String,
              let message = data["message"] as? String else {
            return
        }
        
        // Show local notification since we can't send SMS directly
        showSendNotification(to: to, message: message)
    }
    
    private func sendPong() {
        sendWebSocketMessage([
            "type": "pong",
            "deviceId": deviceId,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ])
    }
    
    private func sendWebSocketMessage(_ data: [String: Any]) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: data),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return
        }
        
        let message = URLSessionWebSocketTask.Message.string(jsonString)
        webSocketTask?.send(message) { error in
            if let error = error {
                print("WebSocket send error: \(error)")
            }
        }
    }
    
    // MARK: - Notifications
    
    private func setupNotifications() {
        UNUserNotificationCenter.current().delegate = self
    }
    
    private func requestNotificationPermissions(completion: @escaping (Bool) -> Void) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            completion(granted)
        }
    }
    
    private func showSendNotification(to: String, message: String) {
        let content = UNMutableNotificationContent()
        content.title = "SMS Send Request"
        content.body = "Send to \(to): \(message)"
        content.sound = .default
        content.userInfo = ["to": to, "message": message, "action": "send_sms"]
        
        // Add action buttons
        let sendAction = UNNotificationAction(identifier: "SEND_ACTION", title: "Send", options: [])
        let cancelAction = UNNotificationAction(identifier: "CANCEL_ACTION", title: "Cancel", options: [])
        
        let category = UNNotificationCategory(
            identifier: "SMS_SEND_REQUEST",
            actions: [sendAction, cancelAction],
            intentIdentifiers: [],
            options: []
        )
        
        UNUserNotificationCenter.current().setNotificationCategories([category])
        content.categoryIdentifier = "SMS_SEND_REQUEST"
        
        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request)
    }
    
    // MARK: - Simulated Message Monitoring
    
    @objc
    func simulateIncomingMessage(_ from: String, message: String) {
        let messageData = [
            "type": "sms_received",
            "from": from,
            "message": message,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "deviceId": deviceId
        ]
        
        // Send to server
        sendWebSocketMessage(messageData)
        
        // Send to React Native
        if let bridge = self.bridge {
            bridge.eventDispatcher().sendAppEvent(withName: "SMSReceived", body: messageData)
        }
    }
    
    // MARK: - Shortcuts Integration
    
    @objc
    func setupShortcutsIntegration(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        // This would integrate with iOS Shortcuts app
        // Users would need to create a shortcut that sends SMS data to our app
        
        let instructions = [
            "setupRequired": true,
            "instructions": [
                "1. Open Shortcuts app",
                "2. Create new shortcut",
                "3. Add 'Get My Shortcuts' action",
                "4. Add 'Run Shortcut' action with SMS Mirror",
                "5. Configure automation triggers"
            ],
            "note": "iOS requires manual setup due to security restrictions"
        ]
        
        resolve(instructions)
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension MessageBridge: UNUserNotificationCenterDelegate {
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        
        let userInfo = response.notification.request.content.userInfo
        
        if response.actionIdentifier == "SEND_ACTION",
           let to = userInfo["to"] as? String,
           let message = userInfo["message"] as? String {
            
            // Open Messages app
            if let url = URL(string: "sms:\(to)&body=\(message.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") {
                UIApplication.shared.open(url)
            }
        }
        
        completionHandler()
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.alert, .sound])
    }
}
