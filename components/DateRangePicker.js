import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Platform, Animated, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import config from '../constants/config';
import { useThemedStyles } from '../context/ThemeContext';

const isApple = () => Platform.OS === 'ios' || Platform.OS === 'macos';

export const getThisWeek = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days, else go to Monday
  
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { start: monday, end: sunday };
};

export const formatDate = (date) => {
  const currentYear = new Date().getFullYear();
  const dateYear = date.getFullYear();
  
  const options = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    ...(dateYear !== currentYear && { year: 'numeric' })
  };
  
  return date.toLocaleDateString('en-US', options);
};

export default function DateRangePicker({ startDate, endDate, onDateChange, style }) {
  const { colors, styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickingDate, setPickingDate] = useState(null); // 'start' or 'end'
  const slideAnim = useRef(new Animated.Value(500)).current;
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (showDatePicker && !isClosing) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }).start();
    }
  }, [showDatePicker, isClosing]);

  const dateRangeText = `${formatDate(startDate)} - ${formatDate(endDate)}`;

  const openDatePicker = (type) => {
    setPickingDate(type);
    if (!isApple()) {
      setShowDatePicker(true);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    if (!isApple()) {
      setShowDatePicker(false);
    }

    if (event.type === 'set' && selectedDate) {
      if (pickingDate === 'start') {
        onDateChange(selectedDate, endDate);
      } else if (pickingDate === 'end') {
        onDateChange(startDate, selectedDate);
      }
    }
  };

  const handleDone = () => {
    setIsClosing(true);
    Animated.timing(slideAnim, {
      toValue: 500,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
        setShowDatePicker(false);
        setPickingDate(null);
        setIsClosing(false);
        slideAnim.setValue(500);
    });
  };

  const resetToThisWeek = () => {
    const thisWeek = getThisWeek();
    onDateChange(thisWeek.start, thisWeek.end);
  };

  const isCurrentWeek = () => {
    const thisWeek = getThisWeek();
    return startDate.getTime() === thisWeek.start.getTime() && 
           endDate.getTime() === thisWeek.end.getTime();
  };

  return (
    <>
      <View style={[styles.dateControls, style]}>
        <TouchableOpacity 
          style={styles.dateRangeButton}
          onPress={() => {
            setShowDatePicker(true);
            if (isApple()) {
              setPickingDate('start');
            }
          }}
          activeOpacity={0.7}
        >
          <Text numberOfLines={1} style={styles.dateRange}>{dateRangeText}</Text>
          <MaterialCommunityIcons name="calendar" size={16} color={colors.accent} />
        </TouchableOpacity>
        {!isCurrentWeek() && (
          <TouchableOpacity 
            style={styles.resetButton}
            onPress={resetToThisWeek}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="refresh" size={18} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      {/* Date Range Picker Modal */}
      {showDatePicker && (
        <>
          {isApple() ? (
            <Modal
              visible={showDatePicker}
              transparent={true}
              animationType="none"
              onRequestClose={handleDone}
            >
              <Pressable style={styles.modalOverlay} onPress={handleDone}>
                <Animated.View style={[styles.modalContent, {
                  paddingBottom: insets.bottom + 20,
                  transform: [{ translateY: slideAnim }],
                }]}>
                  <Pressable onPress={() => {}}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Select Date Range</Text>
                    <TouchableOpacity onPress={handleDone}>
                      <Text style={styles.doneButton}>Done</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Date Selection Buttons */}
                  <View style={styles.dateSelectionRow}>
                    <TouchableOpacity
                      style={[styles.dateTypeButton, pickingDate === 'start' && styles.dateTypeButtonActive]}
                      onPress={() => setPickingDate('start')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dateTypeLabel, pickingDate === 'start' && styles.dateTypeLabelActive]}>
                        Start Date
                      </Text>
                      <Text style={[styles.dateTypeValue, pickingDate === 'start' && styles.dateTypeValueActive]}>
                        {formatDate(startDate)}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.dateTypeButton, pickingDate === 'end' && styles.dateTypeButtonActive]}
                      onPress={() => setPickingDate('end')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dateTypeLabel, pickingDate === 'end' && styles.dateTypeLabelActive]}>
                        End Date
                      </Text>
                      <Text style={[styles.dateTypeValue, pickingDate === 'end' && styles.dateTypeValueActive]}>
                        {formatDate(endDate)}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* iOS Date Picker */}
                  <DateTimePicker
                    value={pickingDate === 'start' ? startDate : endDate}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    textColor={colors.white}
                  />
                  </Pressable>
                </Animated.View>
              </Pressable>
            </Modal>
          ) : (
            // Android Date Picker
            <DateTimePicker
              value={pickingDate === 'start' ? startDate : endDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}
        </>
      )}
    </>
  );
}

const createStyles = (colors) => StyleSheet.create({
  dateControls: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dateRangeButton: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent + '20',
    borderWidth: 1,
    borderColor: colors.accent + '50',
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
  },
  resetButton: {
    backgroundColor: colors.accent + '20',
    borderWidth: 1,
    borderColor: colors.accent + '50',
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRange: {
    flexShrink: 1,
    fontSize: config.fontsizes.text,
    color: colors.accent,
    fontWeight: 'bold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 16,
    minHeight: 250,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: config.fontsizes.title,
    fontWeight: 'bold',
    color: colors.white,
  },
  doneButton: {
    fontSize: config.fontsizes.text,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.accent,
  },
  dateSelectionRow: {
    flexDirection: 'row',
    marginBottom: 12,
    height: 50,
    borderRadius: 30,
    overflow: 'hidden',
  },
  dateTypeButton: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateTypeButtonActive: {
    backgroundColor: colors.accent,
  },
  dateTypeLabel: {
    fontSize: config.fontsizes.small,
    color: colors.textMuted,
    fontWeight: '500'
  },
  dateTypeLabelActive: {
    color: colors.onAccent,
  },
  dateTypeValue: {
    fontSize: config.fontsizes.text,
    fontWeight: 'bold',
    color: colors.white,
  },
  dateTypeValueActive: {
    color: colors.white,
  },
});
