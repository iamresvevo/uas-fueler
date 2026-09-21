import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, ActivityIndicator, AppState } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from '../constants/config';
import { useThemedStyles } from '../context/ThemeContext';
import { useMemo, useState, useRef, useEffect } from 'react';
import { device_height } from '../helpers/deviceDimensions';
import AmountInput from '../helpers/AmountInput';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useModal } from '../context/ModalContext';
import { useAccount } from '../context/AccountContext';
import { apiCall } from '../helpers/apiCall';
import QRCode from 'react-native-qrcode-svg';

// ─── DEV: set these IDs to test without physical QR codes ───────────────────
const DEV_TANKER_ID   = 1; // stock.id
const DEV_AIRCRAFT_ID = 1; // aircrafts.id
// ─────────────────────────────────────────────────────────────────────────────

const canToggleItem = (values, index) => {
  if (values[index]) return values.slice(index + 1).every(v => !v);
  return values.slice(0, index).every(v => v);
};

export default function FuelOUT({ navigation }) {
  const { colors, styles, isDark } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { showModal } = useModal();
  const { account } = useAccount();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [lockedTankerId, setLockedTankerId] = useState(null);
  const [scannedTanker, setScannedTanker] = useState(null);
  const [scannedAircraft, setScannedAircraft] = useState(null);
  const [scanLookingUp, setScanLookingUp] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const qrCameraRef = useRef(null);
  const stepIndicatorScrollRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [advancingStep, setAdvancingStep] = useState(false);
  
  const [form, setForm] = useState({
    step1: {
        collectedAircraftKeys: false,
        collectedFuelSampleGlass: false
    },
    step2: {
        storedDrainGlass: false,
        movedBowserToHanger: false,
        connectedGroundCableBowserToAircraft: false,
        extendedHoseToRamp: false,
        connectedGroundCableFuelNozzleToAircraft: false
    },
    step3: {
        scannedAircraftQRCode: ''
    },
    step4: {
        scannedFuelPumpQRCode: ''
    },
    step5: {
        capacityBeforeFueling: '',
        capacityBeforeFuelingUnit: 'Gal.'
    },
    step6: {
        beforeMeterPhoto: null
    },
    step7: {
        capacityAfterFueling: '',
        capacityAfterFuelingUnit: 'Gal.'
    },
    step8: {
        afterMeterPhoto: null
    },
    step9: {
        closedFuelCap: false,
        disconnectedFuelNozzleFromAircraft: false,
        disconnectedGroundCableFuelNozzleFromAircraft: false,
        collectedHose: false,
        disconnectedGroundCableBowserFromAircraft: false
    }
  });

  // Lock/unlock tanker
  const lockTanker = (tankerId) => {
    if (!tankerId) return;
    setLockedTankerId(tankerId);
    apiCall('app/fueling/lock', 'POST', { tanker_id: tankerId }, account);
  };

  const unlockTanker = (tankerId) => {
    const id = tankerId ?? lockedTankerId;
    if (!id) return;
    setLockedTankerId(null);
    apiCall('app/fueling/unlock', 'POST', { tanker_id: id }, account);
  };

  const takePicture = async (stepKey) => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
        });
        
        setForm({
          ...form,
          [stepKey]: {
            ...form[stepKey],
            [stepKey === 'step6' ? 'beforeMeterPhoto' : 'afterMeterPhoto']: photo.base64
          }
        });
      } catch (error) {
        console.error('Error taking picture:', error);
      }
    }
  };

  const handleBarCodeScanned = ({ type, data }) => {
    if (isScanning) return;
    setIsScanning(true);

    if (step === 3) {
      setScanLookingUp(true);
      apiCall('app/fueling/lookup/aircraft', 'POST', { name: data }, account).then(res => {
        setScanLookingUp(false);
        if (res?.success) {
          setScannedAircraft(res.data);
          setForm(prev => ({ ...prev, step3: { ...prev.step3, scannedAircraftQRCode: data } }));
          setIsScanning(false);
        } else {
          showModal('Aircraft Not Found', `No registered aircraft found for this QR code.`, 'OK', () => setIsScanning(false));
        }
      });
    } else if (step === 4) {
      setScanLookingUp(true);
      apiCall('app/fueling/lookup/tanker', 'POST', { qr_token: data }, account).then(res => {
        setScanLookingUp(false);
        if (res?.success) {
          const t = res.data;
          if (t.in_use && t.id !== lockedTankerId) {
            showModal('Tanker In Use', `${t.name || t.qr_token} is currently in use by another fueling process. Please select a different tanker.`, 'OK', () => setIsScanning(false));
            return;
          }
          if (t.bowser_check !== 'pass') {
            const notChecked = t.bowser_check === 'not_checked';
            showModal(
              notChecked ? 'Daily Check Required' : 'Daily Check Failed',
              notChecked
                ? `${t.name} has not passed its daily bowser check today.\n\nComplete a bowser check (PASS) before fueling.`
                : `${t.name}'s last daily check FAILED.\n\nFuel-OUT is disabled until a passing check is completed.`,
              'OK',
              () => setIsScanning(false)
            );
            return;
          }
          const tankerUnit = (t.amount_type || '').toUpperCase().startsWith('G') ? 'Gal.' : 'L';
          setScannedTanker({ ...t, in_use: true });
          setForm(prev => ({
            ...prev,
            step4: { ...prev.step4, scannedFuelPumpQRCode: data },
            step5: { ...prev.step5, capacityBeforeFuelingUnit: tankerUnit },
            step7: { ...prev.step7, capacityAfterFuelingUnit: tankerUnit },
          }));
          lockTanker(t.id);
          setIsScanning(false);
          if (t.gas_type && scannedAircraft) {
            const mismatch = scannedAircraft.gas_type && scannedAircraft.gas_type !== t.gas_type;
            const unknown  = !scannedAircraft.gas_type;
            if (mismatch) {
              setTimeout(() => showModal(
                'Fuel Type Mismatch',
                `WARNING: The tanker contains ${t.gas_type} but the aircraft requires ${scannedAircraft.gas_type}.\n\nFueling with the wrong fuel type can cause serious damage. Verify before continuing.`,
                'I Understand', () => {}, true,
                () => { unlockTanker(t.id); setScannedTanker(null); setForm(prev => ({ ...prev, step4: { ...prev.step4, scannedFuelPumpQRCode: '' } })); }
              ), 300);
            } else if (unknown) {
              setTimeout(() => showModal(
                'Fuel Type Unknown',
                `The tanker contains ${t.gas_type} but the aircraft's required fuel type is not registered. Verify the correct fuel type before continuing.`,
                'I Understand', () => {}, true,
                () => { unlockTanker(t.id); setScannedTanker(null); setForm(prev => ({ ...prev, step4: { ...prev.step4, scannedFuelPumpQRCode: '' } })); }
              ), 300);
            }
          }
        } else {
          showModal('Tanker Not Found', `No registered tanker found for this QR code.`, 'OK', () => setIsScanning(false));
        }
      });
    }
  };

  // Unlock tanker when app goes to background (handles home button / swipe away)
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if ((state === 'background' || state === 'inactive') && lockedTankerId) {
        unlockTanker(lockedTankerId);
      }
    });
    return () => sub.remove();
  }, [lockedTankerId]);

  // Reset scanning state when step changes
  useEffect(() => {
    setIsScanning(false);
    setAdvancingStep(false);
  }, [step]);

  // Auto-scroll step indicator when step changes
  useEffect(() => {
    if (stepIndicatorScrollRef.current) {
      // Each step ball is 32px wide + line 20px = ~52px per step
      const scrollPosition = (step - 1) * 52;
      stepIndicatorScrollRef.current.scrollTo({ x: scrollPosition, animated: true });
    }
  }, [step]);

  // Validation function for each step
  const validateStep = (currentStep) => {
    switch(currentStep) {
      case 1:
        // All checklist items must be checked
        return form.step1.collectedAircraftKeys && form.step1.collectedFuelSampleGlass;
      
      case 2:
        // All checklist items must be checked
        return form.step2.storedDrainGlass && 
               form.step2.movedBowserToHanger && 
               form.step2.connectedGroundCableBowserToAircraft && 
               form.step2.extendedHoseToRamp && 
               form.step2.connectedGroundCableFuelNozzleToAircraft;
      
      case 3:
        // QR code must be scanned
        return form.step3.scannedAircraftQRCode !== '';
      
      case 4:
        // QR code must be scanned
        return form.step4.scannedFuelPumpQRCode !== '';
      
      case 5:
        // Capacity must be entered (not empty)
        return form.step5.capacityBeforeFueling !== '' && form.step5.capacityBeforeFueling !== '0';
      
      case 6:
        // Photo must be taken
        return form.step6.beforeMeterPhoto !== null;
      
      case 7:
        // Capacity must be entered (not empty)
        return form.step7.capacityAfterFueling !== '' && form.step7.capacityAfterFueling !== '0';
      
      case 8:
        // Photo must be taken
        return form.step8.afterMeterPhoto !== null;
      
      case 9:
        // All checklist items must be checked
        return form.step9.disconnectedFuelNozzleFromAircraft && 
               form.step9.disconnectedGroundCableFuelNozzleFromAircraft && 
               form.step9.collectedHose && 
               form.step9.closedFuelCap && 
               form.step9.disconnectedGroundCableBowserFromAircraft;
      
      default:
        return true;
    }
  };

  const stepView = useMemo( () => {
    let content;
    let subtitle = '';

    const CHECKLIST = {
      step1: [
        { key: 'collectedAircraftKeys',    label: 'Collect Aircraft keys' },
        { key: 'collectedFuelSampleGlass', label: 'Collect fuel sample glass' },
      ],
      step2: [
        { key: 'storedDrainGlass',                          label: 'Store drain glass' },
        { key: 'movedBowserToHanger',                       label: 'Move bowser to hanger' },
        { key: 'connectedGroundCableBowserToAircraft',      label: 'Connect ground cable from bowser to the aircraft' },
        { key: 'extendedHoseToRamp',                        label: 'Extend the hose to the ramp' },
        { key: 'connectedGroundCableFuelNozzleToAircraft',  label: 'Connect ground cable of the fuel nozzle to the aircraft' },
      ],
      step9: [
        { key: 'closedFuelCap',                                    label: 'Close the fuel cap' },
        { key: 'disconnectedFuelNozzleFromAircraft',               label: 'Disconnect the fuel nozzle from the aircraft' },
        { key: 'disconnectedGroundCableFuelNozzleFromAircraft',    label: 'Disconnect the ground cable of the fuel nozzle from the aircraft' },
        { key: 'collectedHose',                                    label: 'Collect the hose' },
        { key: 'disconnectedGroundCableBowserFromAircraft',        label: 'Disconnect the ground cable of the bowser from the aircraft' },
      ],
    };

    const renderChecklist = (stepKey) => {
      const items = CHECKLIST[stepKey];
      const values = items.map(({ key }) => form[stepKey][key]);
      return items.map(({ key, label }, index) => {
        const tappable = canToggleItem(values, index);
        const isLast   = index === items.length - 1;
        return (
          <TouchableOpacity
            key={key}
            activeOpacity={tappable ? .5 : 1}
            style={[styles.stepViewListItem, !values[index] && !tappable && styles.stepViewListItemDisabled]}
            onPress={() => {
              if (!tappable) return;
              const checking = !form[stepKey][key];
              setForm(prev => ({ ...prev, [stepKey]: { ...prev[stepKey], [key]: checking } }));
              // Auto-advance when the last item is checked (not on step9 — that has submit)
              if (isLast && checking && stepKey !== 'step9' && !advancingStep) {
                setAdvancingStep(true);
                setTimeout(() => setStep(s => s + 1), 350);
              }
            }}
          >
            <Text style={styles.stepViewListItemText}>{label}</Text>
            <View style={[styles.stepViewListItemCheck, form[stepKey][key] && styles.stepViewListItemCheckDone]}>
              {form[stepKey][key] && <MaterialCommunityIcons name="check" size={23} color={colors.onAccent} />}
            </View>
          </TouchableOpacity>
        );
      });
    };

    switch(step){
        case 1:
            subtitle = 'Preparation for fueling process.';
            content = (
                <ScrollView showsVerticalScrollIndicator={false} style={styles.stepViewList} contentContainerStyle={styles.stepViewListContainer}>
                    {renderChecklist('step1')}
                </ScrollView>
            );
        break;
        case 2:
            subtitle = 'After-testing phase.';
            content = (
                <ScrollView showsVerticalScrollIndicator={false} style={styles.stepViewList} contentContainerStyle={styles.stepViewListContainer}>
                    {renderChecklist('step2')}
                </ScrollView>
            );
        break;
        case 3:
            subtitle = 'Scan the QR code on the aircraft.';
            
            content = (
                <View style={styles.stepViewScanContainer}>
                    {!form.step3.scannedAircraftQRCode ? (
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
                                        barcodeScannerSettings={{
                                            barcodeTypes: ["qr"],
                                        }}
                                        onBarcodeScanned={handleBarCodeScanned}
                                    />
                                    <View style={styles.scanOverlay}>
                                        <View style={styles.scanBox}>
                                            <View style={[styles.scanCorner, styles.scanCornerTL]} />
                                            <View style={[styles.scanCorner, styles.scanCornerTR]} />
                                            <View style={[styles.scanCorner, styles.scanCornerBL]} />
                                            <View style={[styles.scanCorner, styles.scanCornerBR]} />
                                        </View>
                                        <Text style={styles.scanInstructions}>Position QR code within frame</Text>
                                    </View>
                                    {/* TODO: Remove for production */}
                                    <TouchableOpacity 
                                        style={styles.skipQRButton}
                                        onPress={() => {
                                            setScanLookingUp(true);
                                            apiCall('app/fueling/lookup/aircraft', 'POST', { id: DEV_AIRCRAFT_ID }, account).then(res => {
                                                setScanLookingUp(false);
                                                if (!res?.success) { showModal('Dev Error', res?.response || 'Aircraft not found.', 'OK', () => {}); return; }
                                                setScannedAircraft(res.data);
                                                setForm(prev => ({ ...prev, step3: { ...prev.step3, scannedAircraftQRCode: res.data.name } }));
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
                            <View style={styles.scanResultImageWrapper}>
                                {scannedAircraft?.image_url
                                    ? <Image source={{ uri: scannedAircraft.image_url }} style={styles.scanResultImage} resizeMode="cover" />
                                    : (
                                        <View style={styles.scanResultQR}>
                                            <View style={styles.scanResultQRInner}>
                                                <QRCode
                                                    value={form.step3.scannedAircraftQRCode || 'N/A'}
                                                    size={device_height < 700 ? 130 : 150}
                                                    color={colors.qrForeground}
                                                    backgroundColor={colors.qrBackground}
                                                />
                                            </View>
                                        </View>
                                    )
                                }
                                <View style={styles.scanResultContent}>
                                    <View>
                                        <Text style={styles.scanResultLabel}>Selected aircraft</Text>
                                        <Text style={styles.scanResultValue}>{form.step3.scannedAircraftQRCode}</Text>
                                    </View>
                                    <View style={styles.scanResultDivider} />
                                    <View>
                                        <Text style={styles.scanResultLabel}>Fuel type</Text>
                                        <Text style={styles.scanResultValue}>{scannedAircraft?.gas_type || '—'}</Text>
                                    </View>
                                </View>
                            </View>
                            <TouchableOpacity 
                                style={styles.rescanButton}
                                onPress={() => {
                                    setScannedAircraft(null);
                                    setForm({
                                        ...form,
                                        step3: {
                                            ...form.step3,
                                            scannedAircraftQRCode: ''
                                        }
                                    });
                                    setIsScanning(false);
                                }}
                            >
                                <MaterialCommunityIcons name="qrcode-scan" size={20} color={colors.white} />
                                <Text style={styles.rescanButtonText}>Rescan</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            );
        
        break;
        case 4:
            subtitle = 'Scan the QR code on the fuel pump.';
            
            content = (
                <View style={styles.stepViewScanContainer}>
                    {!form.step4.scannedFuelPumpQRCode ? (
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
                                        barcodeScannerSettings={{
                                            barcodeTypes: ["qr"],
                                        }}
                                        onBarcodeScanned={handleBarCodeScanned}
                                    />
                                    <View style={styles.scanOverlay}>
                                        <View style={styles.scanBox}>
                                            <View style={[styles.scanCorner, styles.scanCornerTL]} />
                                            <View style={[styles.scanCorner, styles.scanCornerTR]} />
                                            <View style={[styles.scanCorner, styles.scanCornerBL]} />
                                            <View style={[styles.scanCorner, styles.scanCornerBR]} />
                                        </View>
                                        <Text style={styles.scanInstructions}>Position QR code within frame</Text>
                                    </View>
                                    {/* TODO: Remove for production */}
                                    <TouchableOpacity 
                                        style={styles.skipQRButton}
                                        onPress={() => {
                                            setScanLookingUp(true);
                                            apiCall('app/fueling/lookup/tanker', 'POST', { id: DEV_TANKER_ID }, account).then(res => {
                                                setScanLookingUp(false);
                                                if (!res?.success) { showModal('Dev Error', res?.response || 'Tanker not found.', 'OK', () => {}); return; }
                                                const devTanker = res.data;
                                                if (devTanker.in_use) { showModal('Tanker In Use', `${devTanker.name} is currently in use.`, 'OK', () => {}); return; }
                                                if (devTanker.bowser_check !== 'pass') {
                                                    const notChecked = devTanker.bowser_check === 'not_checked';
                                                    showModal(
                                                        notChecked ? 'Daily Check Required' : 'Daily Check Failed',
                                                        notChecked
                                                            ? `${devTanker.name} has not passed its daily bowser check today.\n\nComplete a bowser check (PASS) before fueling.`
                                                            : `${devTanker.name}'s last daily check FAILED.\n\nFuel-OUT is disabled until a passing check is completed.`,
                                                        'OK', () => {}
                                                    );
                                                    return;
                                                }
                                                const tankerUnit = (devTanker.amount_type || '').toUpperCase().startsWith('G') ? 'Gal.' : 'L';
                                                setScannedTanker({ ...devTanker, in_use: true });
                                                setForm(prev => ({
                                                    ...prev,
                                                    step4: { ...prev.step4, scannedFuelPumpQRCode: devTanker.qr_token },
                                                    step5: { ...prev.step5, capacityBeforeFuelingUnit: tankerUnit },
                                                    step7: { ...prev.step7, capacityAfterFuelingUnit: tankerUnit },
                                                }));
                                                lockTanker(devTanker.id);
                                                setIsScanning(false);
                                                if (devTanker.gas_type && scannedAircraft) {
                                                    const mismatch = scannedAircraft.gas_type && scannedAircraft.gas_type !== devTanker.gas_type;
                                                    const unknown  = !scannedAircraft.gas_type;
                                                    if (mismatch) {
                                                        setTimeout(() => showModal(
                                                          'Fuel Type Mismatch',
                                                          `WARNING: The tanker contains ${devTanker.gas_type} but the aircraft requires ${scannedAircraft.gas_type}.\n\nFueling with the wrong fuel type can cause serious damage. Verify before continuing.`,
                                                          'I Understand', () => {}, true,
                                                          () => { unlockTanker(devTanker.id); setScannedTanker(null); setForm(prev => ({ ...prev, step4: { ...prev.step4, scannedFuelPumpQRCode: '' } })); }
                                                        ), 300);
                                                    } else if (unknown) {
                                                        setTimeout(() => showModal(
                                                          'Fuel Type Unknown',
                                                          `The tanker contains ${devTanker.gas_type} but the aircraft's required fuel type is not registered. Verify the correct fuel type before continuing.`,
                                                          'I Understand', () => {}, true,
                                                          () => { unlockTanker(devTanker.id); setScannedTanker(null); setForm(prev => ({ ...prev, step4: { ...prev.step4, scannedFuelPumpQRCode: '' } })); }
                                                        ), 300);
                                                    }
                                                }
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
                            <View style={styles.scanResultImageWrapper}>
                                {scannedTanker?.image_url
                                    ? <Image source={{ uri: scannedTanker.image_url }} style={styles.scanResultImage} resizeMode="cover" />
                                    : (
                                        <View style={styles.scanResultQR}>
                                            <View style={styles.scanResultQRInner}>
                                                <QRCode
                                                    value={form.step4.scannedFuelPumpQRCode || 'N/A'}
                                                    size={device_height < 700 ? 130 : 150}
                                                    color={colors.qrForeground}
                                                    backgroundColor={colors.qrBackground}
                                                />
                                            </View>
                                        </View>
                                    )
                                }
                                <View style={styles.scanResultContent}>
                                    {(() => {
                                        const t = scannedTanker;
                                        return (
                                            <>
                                                <View>
                                                    <Text style={styles.scanResultLabel}>Tanker</Text>
                                                    <Text style={styles.scanResultValue}>{t ? t.name : form.step4.scannedFuelPumpQRCode}</Text>
                                                </View>
                                                {t?.gas_type && (
                                                    <>
                                                        <View style={styles.scanResultDivider} />
                                                        <View>
                                                            <Text style={styles.scanResultLabel}>Fuel type</Text>
                                                            <Text style={styles.scanResultValue}>{t.gas_type}</Text>
                                                        </View>
                                                    </>
                                                )}
                                            </>
                                        );
                                    })()}
                                </View>
                            </View>
                            <TouchableOpacity 
                                style={styles.rescanButton}
                                onPress={() => {
                                    unlockTanker();
                                    setForm({
                                        ...form,
                                        step4: {
                                            ...form.step4,
                                            scannedFuelPumpQRCode: ''
                                        }
                                    });
                                    setIsScanning(false);
                                }}
                            >
                                <MaterialCommunityIcons name="qrcode-scan" size={20} color={colors.white} />
                                <Text style={styles.rescanButtonText}>Rescan</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            );
        
        break;
        case 5:
            subtitle = 'Insert the capacity before fueling.';
            
            content = (
                <AmountInput
                    value={form.step5.capacityBeforeFueling}
                    unit={form.step5.capacityBeforeFuelingUnit}
                    onValueChange={(newValue) => {
                        setForm({
                            ...form,
                            step5: {
                                ...form.step5,
                                capacityBeforeFueling: newValue
                            }
                        });
                    }}
                    onUnitChange={() => {
                        // Toggle unit if needed
                        const newUnit = form.step5.capacityBeforeFuelingUnit === 'Gal.' ? 'L' : 'Gal.';
                        setForm({
                            ...form,
                            step5: {
                                ...form.step5,
                                capacityBeforeFuelingUnit: newUnit
                            }
                        });
                    }}
                    onNext={() => setStep(step + 1)}
                    unitLocked={true}
                />
            );
        
        break;
        case 6:
            subtitle = 'Take a picture of the before meter.';
            
            if (!permission) {
                content = (
                    <View style={styles.stepViewCameraContainer}>
                        <Text style={styles.permissionText}>Loading camera...</Text>
                    </View>
                );
            } else if (!permission.granted) {
                content = (
                    <View style={styles.stepViewCameraContainer}>
                        <Text style={styles.permissionText}>Camera permission required</Text>
                        <TouchableOpacity 
                            style={styles.permissionButton}
                            onPress={requestPermission}
                        >
                            <Text style={styles.permissionButtonText}>Grant Permission</Text>
                        </TouchableOpacity>
                    </View>
                );
            } else {
                content = (
                    <View style={styles.stepViewCameraContainer}>
                        <View style={styles.cameraPreview}>
                            {form.step6.beforeMeterPhoto ? (
                                <Image 
                                    source={{ uri: `data:image/jpeg;base64,${form.step6.beforeMeterPhoto}` }} 
                                    style={styles.cameraPreviewImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <CameraView 
                                    ref={cameraRef}
                                    style={styles.cameraPreviewPlaceholder}
                                    facing="back"
                                />
                            )}
                        </View>
                        
                        {form.step6.beforeMeterPhoto ? (
                            <TouchableOpacity
                                style={styles.retakeButton}
                                onPress={() => {
                                    setForm({
                                        ...form,
                                        step6: {
                                            ...form.step6,
                                            beforeMeterPhoto: null
                                        }
                                    });
                                }}
                            >
                                <MaterialCommunityIcons name="camera-retake" size={32} color={colors.white} />
                                <Text style={styles.retakeButtonText}>Retake</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.captureButton}
                                onPress={() => takePicture('step6')}
                            >
                                <View style={styles.captureButtonInner} />
                            </TouchableOpacity>
                        )}
                    </View>
                );
            }
        
        break;
        case 7:
            subtitle = 'Insert the capacity after fueling.';
            
            content = (
                <AmountInput
                    value={form.step7.capacityAfterFueling}
                    unit={form.step7.capacityAfterFuelingUnit}
                    onValueChange={(newValue) => {
                        setForm({
                            ...form,
                            step7: {
                                ...form.step7,
                                capacityAfterFueling: newValue
                            }
                        });
                    }}
                    onUnitChange={() => {
                        // Toggle unit if needed
                        const newUnit = form.step7.capacityAfterFuelingUnit === 'Gal.' ? 'L' : 'Gal.';
                        setForm({
                            ...form,
                            step7: {
                                ...form.step7,
                                capacityAfterFuelingUnit: newUnit
                            }
                        });
                    }}
                    onNext={() => setStep(step + 1)}
                    unitLocked={true}
                />
            );
        
        break;
        case 8:
            subtitle = 'Take a picture of the after meter.';
            
            if (!permission) {
                content = (
                    <View style={styles.stepViewCameraContainer}>
                        <Text style={styles.permissionText}>Loading camera...</Text>
                    </View>
                );
            } else if (!permission.granted) {
                content = (
                    <View style={styles.stepViewCameraContainer}>
                        <Text style={styles.permissionText}>Camera permission required</Text>
                        <TouchableOpacity 
                            style={styles.permissionButton}
                            onPress={requestPermission}
                        >
                            <Text style={styles.permissionButtonText}>Grant Permission</Text>
                        </TouchableOpacity>
                    </View>
                );
            } else {
                content = (
                    <View style={styles.stepViewCameraContainer}>
                        <View style={styles.cameraPreview}>
                            {form.step8.afterMeterPhoto ? (
                                <Image 
                                    source={{ uri: `data:image/jpeg;base64,${form.step8.afterMeterPhoto}` }} 
                                    style={styles.cameraPreviewImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <CameraView 
                                    ref={cameraRef}
                                    style={styles.cameraPreviewPlaceholder}
                                    facing="back"
                                />
                            )}
                        </View>
                        
                        {form.step8.afterMeterPhoto ? (
                            <TouchableOpacity
                                style={styles.retakeButton}
                                onPress={() => {
                                    setForm({
                                        ...form,
                                        step8: {
                                            ...form.step8,
                                            afterMeterPhoto: null
                                        }
                                    });
                                }}
                            >
                                <MaterialCommunityIcons name="camera-retake" size={32} color={colors.white} />
                                <Text style={styles.retakeButtonText}>Retake</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.captureButton}
                                onPress={() => takePicture('step8')}
                            >
                                <View style={styles.captureButtonInner} />
                            </TouchableOpacity>
                        )}
                    </View>
                );
            }
        
        break;
        case 9:
            subtitle = 'Finishing checks.';
            content = (
                <ScrollView showsVerticalScrollIndicator={false} style={styles.stepViewList} contentContainerStyle={styles.stepViewListContainer}>
                    {renderChecklist('step9')}
                </ScrollView>
            );
        break;
        default:
            content = <View style={styles.stepViewContent} />;
        break;
    }

    return (
        <View style={styles.stepViewContent}>
            <View style={styles.stepViewHeader}>
                <ScrollView 
                    ref={stepIndicatorScrollRef}
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.stepIndicatorContainer}
                >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((stepNumber, index) => (
                        <View key={stepNumber} style={styles.stepIndicatorItem}>
                            <View style={[
                                styles.stepIndicatorBall,
                                stepNumber <= step && styles.stepIndicatorBallActive
                            ]}>
                                <Text style={[
                                    styles.stepIndicatorText,
                                    stepNumber <= step && styles.stepIndicatorTextActive
                                ]}>{stepNumber}</Text>
                            </View>
                            {index < 8 && (
                                <View style={[
                                    styles.stepIndicatorLine,
                                    stepNumber < step && styles.stepIndicatorLineActive
                                ]} />
                            )}
                        </View>
                    ))}
                </ScrollView>
                <Text style={styles.stepViewHeaderSubtitle}>{ subtitle }</Text>
            </View>

            { content }

        </View>
    )

  }, [step, form, permission, isScanning, scannedTanker, scannedAircraft, scanLookingUp, advancingStep, colors, styles]);

  const stepOptions = useMemo( () => {
    let valid = validateStep(step);
    let c2a = () => {
        setStep( step + 1 );
    };
    let text = 'Next step';

    switch(step){
        case 1:
        case 2:
        case 9: {
            const stepKey = `step${step}`;
            const keys    = Object.keys(form[stepKey]);
            const nextIdx = keys.findIndex(k => !form[stepKey][k]);
            const allDone = nextIdx === -1;

            if (!allDone) {
                // Still items to check — show sequential Checked button
                text  = 'Checked';
                valid = !advancingStep;
                c2a = () => {
                    if (advancingStep) return;
                    const key    = keys[nextIdx];
                    const isLast = nextIdx === keys.length - 1;
                    setForm(prev => ({ ...prev, [stepKey]: { ...prev[stepKey], [key]: true } }));
                    if (isLast && step !== 9) {
                        setAdvancingStep(true);
                        setTimeout(() => setStep(s => s + 1), 350);
                    }
                };
                break;
            }

            // All checked — steps 1 & 2 advance, step 9 submits
            if (step !== 9) {
                text  = 'Next step';
                valid = !advancingStep;
                c2a   = () => { if (!advancingStep) setStep(s => s + 1); };
                break;
            }

            // ── Step 9 submit ──────────────────────────────────────────
            text  = 'Submit Fuel-OUT';
            valid = !submitting;
            c2a = () => {
                // Resolve tanker from pump QR
                const tanker = scannedTanker;
                if (!tanker) {
                    showModal('Tanker Not Found', 'The scanned pump QR code does not match any registered tanker. Please go back and rescan.', 'OK', () => {});
                    return;
                }
                const aircraft = scannedAircraft;
                if (!aircraft) {
                    showModal('Aircraft Not Found', 'The scanned aircraft QR code does not match any registered aircraft. Please go back and rescan.', 'OK', () => {});
                    return;
                }
                const before = parseFloat(form.step5.capacityBeforeFueling) || 0;
                const after  = parseFloat(form.step7.capacityAfterFueling)  || 0;
                const amount = Math.abs(after - before);
                if (amount <= 0) {
                    showModal('Invalid Amount', 'The fueling amount calculated from the meter readings is zero or negative. Please go back and check your entries.', 'OK', () => {});
                    return;
                }
                const amount_type = form.step5.capacityBeforeFuelingUnit || 'L';

                const GAL_TO_L = 3.785411784;
                const L_TO_GAL = 0.264172052;

                const doSubmit = (liveTankerAmount) => {
                    const inputUnit = amount_type.toUpperCase().startsWith('G') ? 'GAL' : 'L';
                    const tankUnit  = (tanker.amount_type || 'L').toUpperCase().startsWith('G') ? 'GAL' : 'L';
                    let amountInTankUnit = amount;
                    if (inputUnit !== tankUnit) {
                        amountInTankUnit = inputUnit === 'GAL' ? amount * GAL_TO_L : amount * L_TO_GAL;
                    }
                    if (amountInTankUnit > liveTankerAmount + 0.001) {
                        showModal(
                            'Insufficient Fuel',
                            `Cannot dispense ${amount.toFixed(1)} ${amount_type} — tanker only has ${liveTankerAmount.toFixed(1)} ${tankUnit} available.`,
                            'OK', () => {}
                        );
                        return;
                    }

                    setSubmitting(true);

                    // Upload photos first, then create transaction
                    const uploadPhoto = (base64, slot) => {
                        if (!base64) return Promise.resolve(null);
                        return apiCall('app/fueling/upload-photo', 'POST', { image: base64, slot }, account)
                            .then(r => r?.success ? r.data.filename : null);
                    };

                    Promise.all([
                        uploadPhoto(form.step6.beforeMeterPhoto, 'before'),
                        uploadPhoto(form.step8.afterMeterPhoto, 'after'),
                    ]).then(([photo_before, photo_after]) => {
                        apiCall('app/fueling/create', 'POST', {
                            form: {
                                type: 'OUT',
                                tanker_id: tanker.id,
                                aircraft_id: aircraft.id,
                                amount,
                                amount_type,
                                fueler_id: account?.id ?? 0,
                                notes: '',
                                photo_before,
                                photo_after,
                                meter_before: before,
                                meter_after: after,
                                meter_unit: amount_type,
                            }
                        }, account).then(res => {
                            setSubmitting(false);
                            if (res?.success) {
                                showModal(
                                    'Fuel-OUT Complete',
                                    `Successfully recorded ${amount} ${amount_type} dispensed to ${aircraft.name} from ${tanker.name}.`,
                                    'Done',
                                    () => { unlockTanker(); navigation.pop(); },
                                    false
                                );
                            } else {
                                showModal('Submission Failed', res?.response || 'An error occurred. Please try again.', 'OK', () => {});
                            }
                        });
                    });
                };

                // Confirm before submitting
                const proceedWithConfirm = () => {
                    showModal(
                        'Confirm Fuel-OUT',
                        `Aircraft: ${aircraft.name}
Tanker: ${tanker.name} (${tanker.gas_type || ''})
Meter before: ${before} ${amount_type}
Meter after: ${after} ${amount_type}
Amount dispensed: ${amount.toFixed(1)} ${amount_type}

Please verify the details above before confirming.`,
                        'Confirm',
                        () => {
                            // Re-fetch live tanker: catches concurrent stock changes and fresh bowser check status
                            setSubmitting(true);
                            apiCall('app/fueling/lookup/tanker', 'POST', { id: tanker.id }, account).then(res => {
                                setSubmitting(false);
                                const liveTanker = res?.success ? res.data : null;
                                if (liveTanker && liveTanker.bowser_check !== 'pass') {
                                    const notChecked = liveTanker.bowser_check === 'not_checked';
                                    showModal(
                                        notChecked ? 'Daily Check Required' : 'Daily Check Failed',
                                        notChecked
                                            ? `${liveTanker.name} has not passed its daily bowser check today.\n\nComplete a bowser check (PASS) before fueling.`
                                            : `${liveTanker.name}'s last daily check FAILED.\n\nFuel-OUT is disabled until a passing check is completed.`,
                                        'OK'
                                    );
                                    return;
                                }
                                doSubmit(liveTanker ? liveTanker.amount : tanker.amount);
                            });
                        },
                        true
                    );
                };

                if (tanker.gas_type && aircraft.gas_type && tanker.gas_type !== aircraft.gas_type) {
                    showModal(
                        'Fuel Type Mismatch',
                        `WARNING: The tanker contains ${tanker.gas_type} but the aircraft requires ${aircraft.gas_type}.\n\nFueling with the wrong fuel type can cause serious damage. Are you sure you want to proceed?`,
                        'Proceed Anyway',
                        proceedWithConfirm,
                        true
                    );
                } else if (tanker.gas_type && !aircraft.gas_type) {
                    showModal(
                        'Fuel Type Unknown',
                        `The tanker contains ${tanker.gas_type} but the aircraft's required fuel type is not registered. Are you sure you want to proceed?`,
                        'Proceed Anyway',
                        proceedWithConfirm,
                        true
                    );
                } else {
                    proceedWithConfirm();
                }
            }
        }
        break;
    }

    return (
        <View style={[styles.stepOptionsContainer, {
            paddingBottom: insets.bottom + 12
        }]}>
            { (step > 1) &&
            <TouchableOpacity
                style={[styles.stepOptionsButtonBack]}
                onPress={ () => {
                    setStep( step - 1 );
                } }
            >
                <MaterialCommunityIcons name="arrow-left" size={26} color={colors.white} />
            </TouchableOpacity>
            }
            <TouchableOpacity
                style={[styles.stepOptionsButton, (step == 9) && styles.stepOptionsButtonDone, {
                    opacity: (valid && !submitting) ? 1 : 0.5
                }]}
                disabled={ !valid || submitting }
                onPress={ c2a }
            >
                {submitting
                    ? <ActivityIndicator color={colors.onAccent} />
                    : <Text style={styles.stepOptionsButtonText}>{ text }</Text>
                }
            </TouchableOpacity>
        </View>
    )
  }, [step, form, submitting, advancingStep, colors, styles])

  return (
    <View style={[styles.container, {
      paddingTop: insets.top + 12
    }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.containerModal}>
        
            {/* Header with settings icon */}
            <View style={styles.header}>
                <TouchableOpacity activeOpacity={.5} onPress={
                    () => {
                        const isDirty = step > 1
                            || form.step1.collectedAircraftKeys || form.step1.collectedFuelSampleGlass
                            || form.step2.storedDrainGlass || form.step2.movedBowserToHanger
                            || form.step2.connectedGroundCableBowserToAircraft || form.step2.extendedHoseToRamp
                            || form.step2.connectedGroundCableFuelNozzleToAircraft
                            || !!form.step3.scannedAircraftQRCode || !!form.step4.scannedFuelPumpQRCode
                            || !!form.step5.capacityBeforeFueling || !!form.step6.beforeMeterPhoto
                            || !!form.step7.capacityAfterFueling || !!form.step8.afterMeterPhoto
                            || form.step9.disconnectedFuelNozzleFromAircraft || form.step9.closedFuelCap
                            || form.step9.disconnectedGroundCableFuelNozzleFromAircraft
                            || form.step9.collectedHose || form.step9.disconnectedGroundCableBowserFromAircraft;
                        if (!isDirty) {
                            navigation.pop();
                            return;
                        }
                        if (showModal) {
                            showModal(
                                'Cancel Fueling Process',
                                'Are you sure you want to cancel? All progress will be lost.',
                                'Cancel Process',
                                () => {
                                    unlockTanker();
                                    navigation.pop();
                                },
                                true
                            );
                        } else {
                            unlockTanker();
                            navigation.pop();
                        }
                    }
                } style={styles.headerButton}>
                    <MaterialCommunityIcons name="chevron-left" size={32} color={colors.white} />
                </TouchableOpacity>
                <MaterialCommunityIcons name="fuel" size={32} color={colors.lighter9} />
                <View style={[styles.headerIcon, { backgroundColor: colors.accent }]}>
                    <MaterialCommunityIcons name="arrow-up" size={20} color={colors.onAccent} />
                </View>
                <Text style={styles.headerTitle}>Fuel-out</Text>
            </View>


            { stepView }
            { stepOptions }
    

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
   header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 6,
    paddingLeft: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.white,
    fontSize: config.fontsizes.header,
    fontWeight: 'bold',
    letterSpacing: -0.5,
    marginLeft: 4,
    flex: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },


  stepOptionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    gap: 12,
    borderTopColor: colors.border
  },
  stepOptionsButtonBack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    width: 60,
  },
  stepOptionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
  },
  stepOptionsButtonDone: {
    backgroundColor: colors.accent,
  },
  stepOptionsButtonText: {
    fontWeight: 'bold',
    color: colors.onAccent,
    fontSize: config.fontsizes.button,
  },
  stepViewContent: {
    flex: 1,
  },
  stepViewHeader: {
    paddingVertical: 12,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  stepViewHeaderTitle: {
    fontSize: config.fontsizes.header,
    fontWeight: 'bold',
    letterSpacing: -0.5,
    color: colors.accent,
    marginBottom: 2,
  },
  stepViewHeaderSubtitle: {
    fontSize: config.fontsizes.title,
    color: colors.white,
    letterSpacing: -0.2,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  stepIndicatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIndicatorBall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicatorBallActive: {
    backgroundColor: colors.accent,
  },
  stepIndicatorText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.lighter5,
  },
  stepIndicatorTextActive: {
    color: colors.onAccent,
  },
  stepIndicatorLine: {
    width: 16,
    height: 3,
    backgroundColor: colors.surfaceRaised,
    marginHorizontal: 2,
  },
  stepIndicatorLineActive: {
    backgroundColor: colors.accent,
  },

  stepViewList: {
    flex: 1,
  },
  stepViewListContainer: {
    paddingTop: 10,
    paddingHorizontal: 14,
  },
  stepViewListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    paddingVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 16,

    marginVertical: 4
  },
  stepViewListItemText: {
    fontWeight: 'bold',
    fontSize: config.fontsizes.step,
    color: colors.white,
    flex: 1
  },
  stepViewListItemCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfacePressed,
    marginLeft: 12,
  },
  stepViewListItemCheckDone: {
    backgroundColor: colors.green
  },
  stepViewListItemDisabled: {
    opacity: 0.4,
  },
  
  // Step 3 & 4 - QR Scanner
  stepViewScanContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: device_height < 700 ? 12 : 28,
  },
  scanBox: {
    width: 280,
    height: 280,
    borderRadius: 24,
    position: 'relative',
  },
  scanResultPlaceholder: {
    width: 280,
    height: 280,
    borderRadius: 24,
    marginBottom: 12,
    position: 'relative',
    backgroundColor: colors.surfaceRaised,
  },
  scanResultImageWrapper: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  scanResultQR: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: device_height < 700 ? 36 : 48,
    paddingHorizontal: device_height < 700 ? 36 : 48,
    paddingBottom: device_height < 700 ? 96 : 110,
    backgroundColor: colors.surfaceRaised,
  },
  scanResultQRInner: {
    padding: 14,
    backgroundColor: colors.qrBackground,
    borderRadius: 8,
  },
  scanResultImage: {
    width: '100%',
    aspectRatio: device_height < 700 ? 4/3 : 16/9,
  },
  scanCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: colors.onDark,
  },
  scanCornerTL: {
    top: 20,
    left: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  scanCornerTR: {
    top: 20,
    right: 20,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  scanCornerBL: {
    bottom: 20,
    left: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  scanCornerBR: {
    bottom: 20,
    right: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanResult: {
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  scanResultContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.68)',
    padding: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  scanResultLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: config.fontsizes.small,
    fontWeight: '600',
    marginBottom: 2,
  },
  scanResultValue: {
    color: colors.onDark,
    fontSize: config.fontsizes.title,
    fontWeight: 'bold',
  },
  scanResultDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  qrCameraContainer: {
    width: '100%',
    aspectRatio: 3/4,
    maxHeight: 500,
    borderRadius: 24,
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  scanInstructions: {
    color: colors.onDark,
    fontSize: config.fontsizes.text,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  permissionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.darkest,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginTop: 16,
    alignSelf: 'center',
  },
  rescanButtonText: {
    color: colors.white,
    fontSize: config.fontsizes.text,
    fontWeight: 'bold',
  },
  
  // Step 5 & 7 - Capacity Input
  stepViewInputContainer: {
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
    borderRadius: 12,
    height: 80,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 12,
  },
  capacityValue: {
    flex: 1,
    fontSize: config.fontsizes.calculator,
    textAlign: 'right',
    fontWeight: 'bold',
    color: colors.white,
  },
  capacityUnit: {
    backgroundColor: colors.surfaceRaised,
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
  
  // Step 6 & 8 - Camera
  stepViewCameraContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  cameraPreview: {
    width: '100%',
    aspectRatio: 4/3,
    backgroundColor: colors.darkest,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 40,
  },
  cameraPreviewPlaceholder: {
    flex: 1,
    backgroundColor: colors.darkest,
  },
  cameraPreviewImage: {
    flex: 1,
    backgroundColor: colors.darker3,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.qrBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.border,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    backgroundColor: colors.darkest,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  retakeButtonText: {
    color: colors.white,
    fontSize: config.fontsizes.text,
    fontWeight: 'bold',
  },
  permissionText: {
    color: colors.white,
    fontSize: config.fontsizes.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  permissionButtonText: {
    color: colors.onAccent,
    fontSize: config.fontsizes.text,
    fontWeight: 'bold',
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
  
  
});
