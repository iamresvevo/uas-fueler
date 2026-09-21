import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { useState, useRef } from 'react';
import Dash from '../screens/Dash';
import Menu from './Menu';
import { device_width } from '../helpers/deviceDimensions';
import config from '../constants/config';
import { useThemedStyles } from '../context/ThemeContext';

const MENU_WIDTH = (device_width > 400) ? 300 : device_width * 0.7; // Menu takes 70% of screen width

export default function MainNavigation({ navigation }) {
  const { colors, styles, isDark } = useThemedStyles(createStyles);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const toggleMenu = () => {
    const toValue = isMenuOpen ? 0 : -MENU_WIDTH;
    const opacityValue = isMenuOpen ? 0 : 1;
    
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: opacityValue,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Dashboard that slides */}
      <Animated.View 
        style={[
          styles.dashContainer,
          {
            transform: [{ translateX: slideAnim }]
          }
        ]}
      >

        {/* Overlay when menu is open */}
            <Animated.View 
              style={[
                styles.overlay,
                {
                  opacity: overlayOpacity
                }
              ]}
              pointerEvents={isMenuOpen ? 'auto' : 'none'}
            >
              <TouchableOpacity 
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={toggleMenu}
              />
            </Animated.View>
        <Dash toggleMenu={toggleMenu} isMenuOpen={isMenuOpen} navigation={navigation} />
      </Animated.View>

      {/* Menu that appears from the right */}
      <Animated.View 
        style={[
          styles.menuContainer,
          {
            transform: [{ translateX: slideAnim }]
          }
        ]}
      >
        <Menu toggleMenu={toggleMenu} navigation={navigation} />
      </Animated.View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  dashContainer: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  menuContainer: {
    position: 'absolute',
    right: -MENU_WIDTH,
    top: 0,
    bottom: 0,
    width: MENU_WIDTH,
    backgroundColor: colors.darker,
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: colors.darker7,
  },
});
