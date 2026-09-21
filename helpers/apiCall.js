import axios from 'axios';
import config from '../constants/config';
import { device_width } from './deviceDimensions';
import { getDeviceID } from './getDeviceID';
import DebugMetrics from './debugMetrics';

export const apiCall = async(ep, type = 'POST', payload, account = null, cancelToken, settingsRaw) => {
  
  const settings = (settingsRaw) ? {
    default_address: settingsRaw.default_address,
    language: {
      pack: settingsRaw.language?.pack,
      version: parseFloat(settingsRaw.language?.version).toFixed(3)
    },
    region: {
      key: settingsRaw.region.key
    },
    receive_notifications: settingsRaw.receive_notifications,
  } : null;


  const device_id = await getDeviceID();

  // Prepare data payload separately to avoid memory leaks from object spreading
  let requestData = null;
  if (type.toUpperCase() === 'POST') {
    requestData = {
      ...payload,
      device_id: device_id,
      screen_width: device_width,
      settings
    };
  }

  const options = {
    method: type.toUpperCase(),
    url: config.api.url + ep,
    headers: {
      'Content-Type': 'application/json',
      'api': config.api.key,
      ...(account && { auth: `${account.token}` }),
    },
    ...(requestData && { data: requestData }),
    ...(cancelToken && { cancelToken }),
    // Add timeout to prevent memory leaks from hanging requests
    timeout: 15000, // 15 second timeout
    // Add endpoint information for better debugging
    metadata: { endpoint: ep }
  };

  // Global axios interceptors should handle tracking automatically
  return axios(options)
    .then((response) => {
      // Extract data and clear reference to response object to help GC
      const responseData = response.data;
      response = null; // Clear reference
      return responseData;
    })
    .catch((error) => {

      if (axios.isCancel(error)) {
        // For cancelled requests, make sure to clean up tracking
        if (error.config?.metadata?.pendingId) {
          DebugMetrics.endPendingRequest(error.config.metadata.pendingId);
        }
        // Clear error references to help GC
        error = null;
        return Promise.reject({ type: 'cancel', message: 'Request was cancelled' });
      }
      
      // Extract error info and clear references to help GC
      const errorMessage = error.response?.data?.message || error.message;
      error = null; // Clear reference
      
      return {
        type: 'error',
        message: errorMessage,
      };
    })
    .finally(() => {
      // Clean up references to help garbage collection
      requestData = null;
    });
};
