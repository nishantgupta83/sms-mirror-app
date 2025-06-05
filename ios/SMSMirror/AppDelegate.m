#import "AppDelegate.h"
#import <React/RCTBundleURLProvider.h>
#import <FamilyControls/FamilyControls.h>

@implementation AppDelegate
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
  // Initialize Family Controls
  FAMILY_CONTROLS_SYNC_START();
  
  // Screen Time API Authorization
  [AuthorizationCenter.shared requestAuthorizationForFamilyControlsWithCompletionHandler:^(NSError * _Nullable error) {
    if (error) NSLog(@"Auth Error: %@", error.localizedDescription);
  }];
  
  return YES;
}
@end
