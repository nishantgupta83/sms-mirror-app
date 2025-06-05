#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SMSBridge, NSObject)

RCT_EXTERN_METHOD(initializeScreenTimeMonitor:(RCTPromiseResolveBlock)resolve 
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(fetchDeviceActivityReports:(NSDate *)startDate 
                  endDate:(NSDate *)endDate 
                  resolver:(RCTPromiseResolveBlock)resolve 
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
