import React, { createContext, useContext, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from '../constants/config';
import { useThemedStyles } from './ThemeContext';

const ModalContext = createContext();

let globalShowModal = null;

export const useModal = () => {
  const context = useContext(ModalContext);
  if (context) {
    return context;
  }
  // Fallback to global function if context is not available
  return { showModal: globalShowModal, hideModal: () => {} };
};

export const ModalProvider = ({ children }) => {
  const hideTimerRef = useRef(null);
  const [modalState, setModalState] = useState({
    visible: false,
    title: '',
    message: '',
    buttonText: '',
    onConfirm: null,
    onCancel: null,
    showCancel: true,
  });

  const showModal = (title, message, buttonText, onConfirm, showCancel = false, onCancel = null) => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setModalState({
      visible: true,
      title,
      message,
      buttonText,
      onConfirm,
      onCancel,
      showCancel,
    });
  };

  const hideModal = () => {
    setModalState(prev => ({
      ...prev,
      visible: false,
    }));
    
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      setModalState({
        visible: false,
        title: '',
        message: '',
        buttonText: '',
        onConfirm: null,
        onCancel: null,
        showCancel: true,
      });
    }, 300);
  };

  const handleCancel = () => {
    if (modalState.onCancel) {
      modalState.onCancel();
    }
    hideModal();
  };

  const handleConfirm = () => {
    if (modalState.onConfirm) {
      modalState.onConfirm();
    }
    hideModal();
  };

  // Store globally for access from anywhere
  globalShowModal = showModal;

  return (
    <>
      <ModalContext.Provider value={{ showModal, hideModal }}>
        {children}
      </ModalContext.Provider>
      <CustomModal
        visible={modalState.visible}
        title={modalState.title}
        message={modalState.message}
        buttonText={modalState.buttonText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        showCancel={modalState.showCancel}
      />
    </>
  );
};

const CustomModal = ({ visible, title, message, buttonText, onConfirm, onCancel, showCancel }) => {
  const { colors, styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onCancel}
        />
        <View style={[styles.modalContainer, {
          marginTop: insets.top,
          marginBottom: insets.bottom,
        }]}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Text style={styles.modalMessage}>{message}</Text>
            
            <View style={styles.modalButtons}>
              {showCancel && (
                <TouchableOpacity
                  style={styles.modalButtonCancel}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.modalButtonConfirm, !showCancel && styles.modalButtonConfirmSingle]}
                onPress={onConfirm}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonConfirmText}>{buttonText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors) => StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.darker7,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999999,
    elevation: 999999,
  },
  modalContainer: {
    width: '85%',
    maxWidth: 400,
    zIndex: 1000000,
    elevation: 1000000,
  },
  modalContent: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: config.fontsizes.title,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 4,
    marginTop: 6,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: config.fontsizes.text,
    color: colors.textMuted,
    marginBottom: 24,
    paddingHorizontal: 12,
    textAlign: 'center',
    lineHeight: config.fontsizes.text + 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: colors.surfacePressed,
    borderRadius: 22,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancelText: {
    fontSize: config.fontsizes.text,
    fontWeight: 'bold',
    color: colors.white,
  },
  modalButtonConfirm: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 22,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonConfirmSingle: {
    // When there's no cancel button, take full width
    marginHorizontal: 0,
  },
  modalButtonConfirmText: {
    fontSize: config.fontsizes.text,
    fontWeight: 'bold',
    color: colors.onAccent,
  },
});
