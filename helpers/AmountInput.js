import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef } from 'react';
import config from '../constants/config';
import { useThemedStyles } from '../context/ThemeContext';
import { device_height } from './deviceDimensions';

export default function AmountInput({ 
    value = '', 
    unit = 'Gal.', 
    onValueChange,
    onUnitChange,
    onNext,
    unitLocked = true,
    placeholder = '0'
}) {
    const { colors, styles } = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const longPressInterval = useRef(null);

    const handleNumberPress = (num) => {
        if (onValueChange) {
            onValueChange(value + num.toString());
        }
    };

    const handleBackspace = () => {
        if (onValueChange) {
            onValueChange(value.slice(0, -1));
        }
    };

    const handleLongPressClear = () => {
        if (onValueChange) {
            onValueChange('');
        }
        if (longPressInterval.current) {
            clearInterval(longPressInterval.current);
        }
    };

    const handleBackspacePressIn = () => {
        handleBackspace();
        longPressInterval.current = setTimeout(() => {
            handleLongPressClear();
        }, 500);
    };

    const handleBackspacePressOut = () => {
        if (longPressInterval.current) {
            clearTimeout(longPressInterval.current);
        }
    };

    const handleDecimal = () => {
        if (!value.includes('.')) {
            if (onValueChange) {
                onValueChange((value || '0') + '.');
            }
        }
    };

    const handleUnitPress = () => {
        if (!unitLocked && onUnitChange) {
            // Toggle between units or call callback
            onUnitChange();
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.capacityDisplay}>
                <Text style={styles.capacityValue} numberOfLines={1} adjustsFontSizeToFit>{value || placeholder}</Text>
                <TouchableOpacity 
                    style={styles.capacityUnit}
                    onPress={handleUnitPress}
                    disabled={unitLocked}
                    activeOpacity={unitLocked ? 1 : 0.7}
                >
                    <Text style={styles.capacityUnitText}>{unit}</Text>
                    {unitLocked && (
                        <MaterialCommunityIcons name="lock" size={14} color={colors.accent} />
                    )}
                </TouchableOpacity>
            </View>
            
            <View style={styles.numpad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <TouchableOpacity
                        key={num}
                        style={[styles.numpadButton, {
                            height: (device_height - insets.top - insets.bottom - 500) / 4,
                        }]}
                        onPress={() => handleNumberPress(num)}
                    >
                        <Text style={styles.numpadButtonText}>{num}</Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity
                    style={[styles.numpadButton, {
                        height: (device_height - insets.top - insets.bottom - 500) / 4,
                    }]}
                    onPress={handleDecimal}
                >
                    <Text style={styles.numpadButtonText}>.</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.numpadButton, {
                        height: (device_height - insets.top - insets.bottom - 500) / 4,
                    }]}
                    onPress={() => handleNumberPress(0)}
                >
                    <Text style={styles.numpadButtonText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.numpadButton, {
                        height: (device_height - insets.top - insets.bottom - 500) / 4,
                    }]}
                    onPressIn={handleBackspacePressIn}
                    onPressOut={handleBackspacePressOut}
                >
                    <MaterialCommunityIcons name="backspace-outline" size={28} color={colors.accent} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const createStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    capacityDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        height: 80,
        paddingHorizontal: 16,
        marginBottom: 20,
        gap: 12,
        width: '100%',
    },
    capacityValue: {
        flex: 1,
        fontSize: config.fontsizes.calculator,
        textAlign: 'right',
        fontWeight: 'bold',
        color: colors.white,
    },
    capacityUnit: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    capacityUnitText: {
        fontSize: config.fontsizes.title,
        fontWeight: 'bold',
        color: colors.white,
    },
    numpad: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
    },
    numpadButton: {
        width: '30%',
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    numpadButtonText: {
        fontSize: config.fontsizes.header,
        fontWeight: 'bold',
        color: colors.white,
    },
    numpadButtonAction: {
        backgroundColor: colors.darkest,
    },
    numpadButtonActionText: {
        fontSize: config.fontsizes.text,
        fontWeight: 'bold',
        color: colors.white,
        textAlign: 'center',
    },
});
