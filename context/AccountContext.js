import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

const ACCOUNT_KEY = 'uas_account';

const AccountContext = createContext();

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
};

export const AccountProvider = ({ children }) => {
  const [account, setAccountState] = useState(null);
  const [accountLoading, setAccountLoading] = useState(true);

  // Restore on boot
  useEffect(() => {
    SecureStore.getItemAsync(ACCOUNT_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setAccountState(JSON.parse(raw));
          } catch (_) {}
        }
      })
      .finally(() => setAccountLoading(false));
  }, []);

  const setAccount = useCallback((data) => {
    setAccountState(data);
    if (data) {
      SecureStore.setItemAsync(ACCOUNT_KEY, JSON.stringify(data)).catch(() => {});
    } else {
      SecureStore.deleteItemAsync(ACCOUNT_KEY).catch(() => {});
    }
  }, []);

  const signOut = useCallback(() => {
    setAccount(null);
  }, [setAccount]);

  return (
    <AccountContext.Provider value={{ account, setAccount, signOut, accountLoading }}>
      {children}
    </AccountContext.Provider>
  );
};
