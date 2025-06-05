import { DeviceActivityMonitor } from 'react-native-screen-time-api';

const PermissionHandler = () => {
  useEffect(() => {
    const subscription = DeviceActivityMonitor.observeAuthorizationStatus((status) => {
      if (status === 'denied') Alert.alert('Screen Time Access Required');
    });
    
    return () => subscription.remove();
  }, []);
  
  return null;
};

const requestSMSPermissions = async () => {
  if (Platform.OS === 'ios') {
    await request(PERMISSIONS.IOS.MEDIA_LIBRARY); // Required for iCloud access
  } else {
    await request(PERMISSIONS.ANDROID.READ_SMS);
  }
};
