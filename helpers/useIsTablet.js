import { useState, useEffect } from 'react';
import * as Device from 'expo-device';

export const useIsTablet = () => {
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkDeviceType = async () => {
      const deviceType = await Device.getDeviceTypeAsync(); // Get the device type
      setIsTablet(deviceType === Device.DeviceType.TABLET); // Set the state based on device type
    };

    checkDeviceType();
  }, []);

  return isTablet; // Return the boolean value
};
