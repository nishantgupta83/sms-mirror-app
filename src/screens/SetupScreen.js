import { FamilyControls } from 'react-native-screen-time-api';

const SetupScreen = () => {
  const [authStatus, setAuthStatus] = useState('not-determined');

  const requestAuth = async () => {
    const status = await FamilyControls.requestAuthorization('child');
    setAuthStatus(status);
  };

  return (
    <View>
      <Text>Family Controls Authorization Status: {authStatus}</Text>
      <Button title="Enable Monitoring" onPress={requestAuth} />
    </View>
  );
};
