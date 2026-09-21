import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import config from '../constants/config';
import { useThemedStyles } from '../context/ThemeContext';
import { useAccount } from '../context/AccountContext';
import { useModal } from '../context/ModalContext';
import { apiCall } from '../helpers/apiCall';
import { device_height } from '../helpers/deviceDimensions';

// ─── DEV: set to a stock.id to test without a physical QR code ───────────────
const DEV_TANKER_ID = 1;
// ─────────────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 3;

const SUBTITLES = [
  'Scan the bowser QR code.',
  'Record the result.',
  'Add comments.',
];

export default function BowserCheckup({ navigation }) {
  const { colors, styles, isDark } = useThemedStyles(createStyles);
  const insets        = useSafeAreaInsets();
  const { account }   = useAccount();
  const { showModal } = useModal();

  const [step, setStep] = useState(1);
  const [submitting,   setSubmitting]   = useState(false);
  const [scannedTanker, setScannedTanker] = useState(null);
  const [scanLookingUp, setScanLookingUp] = useState(false);
  const [isScanning,   setIsScanning]   = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const qrCameraRef = useRef(null);

  const [form, setForm] = useState({
    tanker_id: null,
    result:    null,
    comments:  '',
  });

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Reset scanning lock when step changes
  useEffect(() => { setIsScanning(false); }, [step]);

  const isDirty = !!(form.tanker_id || form.result || form.comments);

  const handleBack = () => {
    if (!isDirty) { navigation.goBack(); return; }
    showModal(
      'Cancel entry',
      'Are you sure you want to go back? All progress will be lost.',
      'Cancel entry',
      () => navigation.goBack(),
      true
    );
  };

  const handleBarCodeScanned = ({ data }) => {
    if (isScanning) return;
    setIsScanning(true);
    setScanLookingUp(true);
    apiCall('app/fueling/lookup/tanker', 'POST', { qr_token: data }, account).then(res => {
      setScanLookingUp(false);
      if (res?.success) {
        const t = res.data;
        setScannedTanker(t);
        setField('tanker_id', t.id);
        setIsScanning(false);
      } else {
        showModal('Bowser Not Found', 'No registered bowser found for this QR code.', 'OK', () => setIsScanning(false));
      }
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const res = await apiCall('app/bowser-checkup/create', 'POST', { form }, account);
    setSubmitting(false);

    if (res?.success) {
      const title = form.result === 'fail' ? 'Check failed' : 'Entry saved';
      const msg   = form.result === 'fail'
        ? 'Entry saved — result FAILED. Notify a supervisor.'
        : 'Bowser control entry saved.';
      showModal(title, msg, 'Done', () => navigation.goBack(), false);
    } else {
      showModal('Submission failed', res?.message || 'Failed to submit. Please try again.', 'OK', () => {});
    }
  };

  // ── Step content ────────────────────────────────────────────────────────────

  let content;

  switch (step) {

    case 1: // QR scan
      content = (
        <View style={styles.scanContainer}>
          {!form.tanker_id ? (
            <>
              {!permission?.granted ? (
                <View style={styles.permissionContainer}>
                  <Text style={styles.permissionText}>Camera permission required</Text>
                  <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                    <Text style={styles.permissionButtonText}>Grant Permission</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.qrCameraContainer}>
                  <CameraView
                    ref={qrCameraRef}
                    style={styles.qrCamera}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={handleBarCodeScanned}
                  />
                  <View style={styles.scanOverlay}>
                    {scanLookingUp ? (
                      <ActivityIndicator size="large" color={colors.onDark} />
                    ) : (
                      <View style={styles.scanBox}>
                        <View style={[styles.scanCorner, styles.scanCornerTL]} />
                        <View style={[styles.scanCorner, styles.scanCornerTR]} />
                        <View style={[styles.scanCorner, styles.scanCornerBL]} />
                        <View style={[styles.scanCorner, styles.scanCornerBR]} />
                      </View>
                    )}
                    <Text style={styles.scanInstructions}>
                      {scanLookingUp ? 'Looking up bowser…' : 'Position QR code within frame'}
                    </Text>
                  </View>
                  {/* DEV bypass */}
                  <TouchableOpacity
                    style={styles.skipQRButton}
                    onPress={() => {
                      setScanLookingUp(true);
                      apiCall('app/fueling/lookup/tanker', 'POST', { id: DEV_TANKER_ID }, account).then(res => {
                        setScanLookingUp(false);
                        if (!res?.success) { showModal('Dev Error', res?.message || 'Not found.', 'OK', () => {}); return; }
                        setScannedTanker(res.data);
                        setField('tanker_id', res.data.id);
                        setIsScanning(false);
                      });
                    }}
                  >
                    <Text style={styles.skipQRButtonText}>Skip QR Scan (Dev)</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <View style={styles.scanResult}>
              <View style={styles.scanResultCard}>
                <View style={styles.scanResultQR}>
                  <View style={styles.scanResultQRInner}>
                    <QRCode
                      value={scannedTanker?.qr_token || 'N/A'}
                      size={device_height < 700 ? 110 : 130}
                      color={colors.qrForeground}
                      backgroundColor={colors.qrBackground}
                    />
                  </View>
                </View>
                <View style={styles.scanResultInfo}>
                  <Text style={styles.scanResultLabel}>Bowser</Text>
                  <Text style={styles.scanResultValue}>{scannedTanker?.name || '—'}</Text>
                  {!!scannedTanker?.gas_type && (
                    <>
                      <Text style={[styles.scanResultLabel, { marginTop: 10 }]}>Fuel type</Text>
                      <Text style={styles.scanResultValue}>{scannedTanker.gas_type}</Text>
                    </>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.rescanButton}
                onPress={() => {
                  setScannedTanker(null);
                  setField('tanker_id', null);
                  setIsScanning(false);
                }}
              >
                <MaterialCommunityIcons name="qrcode-scan" size={18} color={colors.white} />
                <Text style={styles.rescanButtonText}>Rescan</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
      break;

    case 2: // PASS / FAIL — auto-advance on tap
      content = (
        <View style={styles.stepPad}>
          <View style={styles.resultRow}>
            {['pass', 'fail'].map(r => {
              const active = form.result === r;
              const color  = r === 'pass' ? colors.green : colors.accent;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.resultBtn, active && { backgroundColor: color }]}
                  onPress={() => { setField('result', r); setStep(3); }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={r === 'pass' ? 'check-circle-outline' : 'close-circle-outline'}
                    size={30}
                    color={active ? colors.onAccent : colors.darker5}
                  />
                  <Text style={[styles.resultBtnText, active && { color: colors.onAccent }]}> 
                    {r === 'pass' ? 'PASS' : 'FAIL'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
      break;

    case 3: // Comments — optional, submit in footer
      content = (
        <View style={styles.stepPad}>
          <Text style={styles.inputLabel}>Comments (optional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={form.comments}
            onChangeText={v => setField('comments', v)}
            placeholder="Any observations or notes…"
            placeholderTextColor={colors.lighter5}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoFocus
          />
        </View>
      );
      break;

    default:
      content = <View style={{ flex: 1 }} />;
  }

  // Step 1 footer: only show "Next step" when scanned
  const showStep1Next = step === 1 && !!form.tanker_id;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}> 
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.containerModal}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBack} activeOpacity={0.5}>
            <MaterialCommunityIcons name="chevron-left" size={32} color={colors.white} />
          </TouchableOpacity>
          <MaterialCommunityIcons name="clipboard-text-outline" size={32} color={colors.lighter9} />
          <View style={[styles.headerIcon, { backgroundColor: colors.accent }]}>
            <MaterialCommunityIcons name="tanker-truck" size={18} color={colors.onAccent} />
          </View>
          <Text style={styles.headerTitle}>Bowser fuel control</Text>
        </View>

        {/* Step indicator */}
        <View style={styles.stepHeader}>
          <View style={styles.stepIndicatorRow}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n, idx) => (
              <View key={n} style={styles.stepIndicatorItem}>
                <View style={[styles.stepBall, n <= step && styles.stepBallActive]}>
                  <Text style={[styles.stepBallText, n <= step && styles.stepBallTextActive]}>{n}</Text>
                </View>
                {idx < TOTAL_STEPS - 1 && (
                  <View style={[styles.stepLine, n < step && styles.stepLineActive]} />
                )}
              </View>
            ))}
          </View>
          <Text style={styles.stepSubtitle}>{SUBTITLES[step - 1]}</Text>
        </View>

        {/* Step content */}
        <View style={styles.stepContent}>
          {content}
        </View>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.footerBack}
              onPress={() => setStep(s => s - 1)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="arrow-left" size={26} color={colors.white} />
            </TouchableOpacity>
          )}

          {showStep1Next && (
            <TouchableOpacity style={styles.submitBtn} onPress={() => setStep(2)} activeOpacity={0.85}>
              <Text style={styles.submitBtnText}>Next step</Text>
            </TouchableOpacity>
          )}

          {step === 3 && (
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color={colors.onAccent} />
                : <Text style={styles.submitBtnText}>Submit entry</Text>}
            </TouchableOpacity>
          )}
        </View>

      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  containerModal: {
    flex: 1,
    backgroundColor: colors.dark,
    borderRadius: 24,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 6,
    paddingLeft: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.white,
    fontSize: config.fontsizes.header,
    fontWeight: 'bold',
    letterSpacing: -0.5,
    marginLeft: 4,
    flex: 1,
  },

  // ── Step indicator ───────────────────────────────────────────────────────────
  stepHeader: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  stepIndicatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBallActive: {
    backgroundColor: colors.accent,
  },
  stepBallText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.lighter5,
  },
  stepBallTextActive: {
    color: colors.onAccent,
  },
  stepLine: {
    width: 40,
    height: 3,
    backgroundColor: colors.surfaceRaised,
    marginHorizontal: 2,
  },
  stepLineActive: {
    backgroundColor: colors.accent,
  },
  stepSubtitle: {
    fontSize: config.fontsizes.title,
    fontWeight: 'bold',
    letterSpacing: -0.2,
    color: colors.white,
    textAlign: 'center',
  },

  // ── Step content ─────────────────────────────────────────────────────────────
  stepContent: {
    flex: 1,
  },
  stepPad: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 20,
  },

  // ── QR scan (step 1) ─────────────────────────────────────────────────────────
  scanContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: device_height < 700 ? 12 : 20,
  },
  permissionContainer: {
    alignItems: 'center',
    gap: 14,
  },
  permissionText: {
    color: colors.textMuted,
    fontSize: config.fontsizes.text,
  },
  permissionButton: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  permissionButtonText: {
    color: colors.onAccent,
    fontWeight: 'bold',
    fontSize: config.fontsizes.text,
  },
  qrCameraContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    maxHeight: 460,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  qrCamera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scanBox: {
    width: 220,
    height: 220,
    borderRadius: 16,
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: colors.onDark,
  },
  scanCornerTL: { top: 16, left: 16, borderTopWidth: 3, borderLeftWidth: 3 },
  scanCornerTR: { top: 16, right: 16, borderTopWidth: 3, borderRightWidth: 3 },
  scanCornerBL: { bottom: 16, left: 16, borderBottomWidth: 3, borderLeftWidth: 3 },
  scanCornerBR: { bottom: 16, right: 16, borderBottomWidth: 3, borderRightWidth: 3 },
  scanInstructions: {
    color: colors.onDark,
    fontSize: config.fontsizes.text,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 8,
  },
  skipQRButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: colors.surfaceRaised,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipQRButtonText: {
    color: colors.white,
    fontSize: config.fontsizes.text,
    fontWeight: 'bold',
  },
  scanResult: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  scanResultCard: {
    width: '100%',
    backgroundColor: colors.surfaceRaised,
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    padding: 16,
    gap: 16,
    alignItems: 'center',
  },
  scanResultQR: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanResultQRInner: {
    padding: 10,
    backgroundColor: colors.qrBackground,
    borderRadius: 10,
  },
  scanResultInfo: {
    flex: 1,
  },
  scanResultLabel: {
    fontSize: config.fontsizes.small,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 2,
  },
  scanResultValue: {
    fontSize: config.fontsizes.title,
    fontWeight: 'bold',
    color: colors.white,
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.darkest,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 22,
  },
  rescanButtonText: {
    color: colors.white,
    fontSize: config.fontsizes.text,
    fontWeight: 'bold',
  },

  // ── Form elements ────────────────────────────────────────────────────────────
  inputLabel: {
    fontSize: config.fontsizes.small,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 12,
    color: colors.white,
    fontSize: config.fontsizes.text,
    paddingHorizontal: 14,
    height: 44,
  },
  textarea: {
    height: undefined,
    minHeight: 100,
    paddingVertical: 12,
  },
  resultRow: {
    flexDirection: 'row',
    gap: 12,
  },
  resultBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 14,
    paddingVertical: 28,
  },
  resultBtnText: {
    fontSize: config.fontsizes.text,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.textMuted,
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  footerBack: {
    width: 60,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 22,
    height: 44,
  },
  submitBtnText: {
    color: colors.onAccent,
    fontSize: config.fontsizes.button,
    fontWeight: 'bold',
  },
});
