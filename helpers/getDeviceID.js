import * as Application from 'expo-application';
import { Platform } from 'react-native';

export const getDeviceID = async () => {
  try {
    if (Platform.OS === 'ios') {
      return await Application.getIosIdForVendorAsync();
    } else if (Platform.OS === 'android') {
      return Application.getAndroidId();
    } else {
      return 'web-device-id';
    }
  } catch (error) {
    console.error('Error fetching device ID:', error);
    return null;
  }
};
