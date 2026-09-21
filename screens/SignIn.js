import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from '../constants/config';
import { useThemedStyles } from '../context/ThemeContext';
import { useState, useRef } from 'react';
import { useAccount } from '../context/AccountContext';
import { useModal } from '../context/ModalContext';
import axios from 'axios';
import { apiCall } from '../helpers/apiCall';
import BrandLogo from '../components/BrandLogo';

export default function SignIn() {
  const { colors, styles, isDark } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { setAccount } = useAccount();
  const { showModal } = useModal();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const signInCancelRef = useRef(null);

  const handleSignIn = async () => {
    if (!email || !password) {
      showModal(
        'Missing Information',
        'Please enter both email and password.',
        'OK',
        () => {}
      );
      return;
    }

    // Cancel any previous in-flight request
    if (signInCancelRef.current) {
      signInCancelRef.current.cancel();
    }
    signInCancelRef.current = axios.CancelToken.source();

    setLoading(true);

    const res = await apiCall(
      'auth/signin',
      'POST',
      { email, password },
      null,
      signInCancelRef.current.token
    );

    console.log("ER", res)
    setLoading(false);

    if (res?.success && res?.data?.account) {
      setAccount(res.data.account);
    } else if (res?.type !== 'cancel') {
      showModal(
        'Sign In Failed',
        res?.response || 'An error occurred. Please try again.',
        'OK',
        () => {}
      );
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={[styles.content, {
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 12
      }]}>
        {/* Logo/Title Section */}
        <View style={styles.headerSection}>
          <View style={styles.logoContainer}>
              <View style={styles.logoStack}>
                <BrandLogo width={125} height={60} isDark={isDark} colors={colors} />
              </View>
          </View>
          <Text style={styles.title}>UAS Fueler</Text>
          <Text style={styles.subtitle}>Aviation Fueler</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons 
                name="email-outline" 
                size={20} 
                color={colors.lighter5} 
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter email address"
                placeholderTextColor={colors.lighter5}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
                editable={!loading}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons 
                name="lock" 
                size={20} 
                color={colors.lighter5} 
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor={colors.lighter5}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType='go'
                onSubmitEditing={handleSignIn}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color={colors.lighter5} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.signInButton, loading && styles.signInButtonDisabled]}
            onPress={handleSignIn}
            activeOpacity={0.7}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.signInButtonText}>Signing in...</Text>
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© { new Date().getFullYear() } UAS Fueler</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoStack: {
    width: 125,
    height: 60,
    position: 'relative',
  },
  title: {
    fontSize: config.fontsizes.header,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: config.fontsizes.text,
    color: colors.lighter9,
    fontWeight: '500',
  },
  formSection: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: config.fontsizes.text,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tile,
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: config.fontsizes.text,
    color: colors.white,
    fontWeight: '500',
    height: '100%',
  },
  eyeIcon: {
    padding: 8,
    marginRight: -12,
    paddingRight: 16,
    marginLeft: 8,
  },
  signInButton: {
    backgroundColor: colors.accent,
    borderRadius: 22,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    fontSize: config.fontsizes.button,
    fontWeight: 'bold',
    color: colors.onAccent,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 20,
  },
  footerText: {
    fontSize: config.fontsizes.small,
    color: colors.lighter5,
    fontWeight: '500',
  },
});
