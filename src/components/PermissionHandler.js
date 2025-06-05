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
