import * as Device from 'expo-device';

export const isApple = (Device && Device.brand === 'Apple');
