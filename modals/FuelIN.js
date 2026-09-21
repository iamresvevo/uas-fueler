import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
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
const DEV_TANKER_ID = 1; // stock.id
// ─────────────────────────────────────────────────────────────────────────────

export default function FuelIN({ navigation }) {
  const { colors, styles, isDark } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { showModal } = useModal();
  const { account } = useAccount();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ vendors: [] }); // tankers loaded on scan
  const [formDataLoaded, setFormDataLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lockedTankerId, setLockedTankerId] = useState(null);
  const [scannedTanker, setScannedTanker] = useState(null);
  const [scanLookingUp, setScanLookingUp] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const qrCameraRef = useRef(null);
  const stepIndicatorScrollRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  
  const [form, setForm] = useState({
    step1: {
        scannedTankQRCode: ''
    },
    step2: {
        selectedVendor: null  // {id, name}
    },
    step3: {
        amountFueled: '',
        amountFueledUnit: 'Gal.'
    },
    step4: {
        afterMeterPhoto: null
    },
    step5: {
        receiptPhoto: null
    }
  });

  // Load form data (vendors only) on mount
  useEffect(() => {
    apiCall('app/fueling/form-data', 'POST', {}, account).then(res => {
      if (res?.success) {
        setFormData({ vendors: res.data.vendors || [] });
      }
      setFormDataLoaded(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const takePicture = async (stepKey, photoKey) => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: true,
        });
        setForm(prev => ({
          ...prev,
          [stepKey]: { ...prev[stepKey], [photoKey]: photo.base64 }
        }));
      } catch (error) {
        console.error('Error taking picture:', error);
      }
    }
  };

  const handleBarCodeScanned = ({ type, data }) => {
    if (isScanning) return;
    setIsScanning(true);

    if (step === 1) {
      setScanLookingUp(true);
      apiCall('app/fueling/lookup/tanker', 'POST', { qr_token: data }, account).then(res => {
        setScanLookingUp(false);
        if (res?.success) {
          const t = res.data;
          if (t.in_use && t.id !== lockedTankerId) {
            showModal('Tanker In Use', `${t.name || t.qr_token} is currently in use by another fueling process. Please select a different tanker.`, 'OK', () => setIsScanning(false));
            return;
          }
          const tankerUnit = (t.amount_type || '').toUpperCase().startsWith('G') ? 'Gal.' : 'L';
          setScannedTanker({ ...t, in_use: true });
          setForm(prev => ({
            ...prev,
            step1: { ...prev.step1, scannedTankQRCode: data },
            step3: { ...prev.step3, amountFueledUnit: tankerUnit },
          }));
          lockTanker(t.id);
          setIsScanning(false);
        } else {
          showModal('Tanker Not Found', 'No registered tanker found for this QR code.', 'OK', () => setIsScanning(false));
        }
      });
    }
  };

  // Reset scanning state when step changes
  useEffect(() => {
    setIsScanning(false);
  }, [step]);

  // Auto-scroll step indicator when step changes
  useEffect(() => {
    if (stepIndicatorScrollRef.current) {
      // Each step ball is 32px wide + line 24px = ~56px per step
      const scrollPosition = (step - 1) * 56;
      stepIndicatorScrollRef.current.scrollTo({ x: scrollPosition, animated: true });
    }
  }, [step]);

  // Validation function for each step
  const validateStep = (currentStep) => {
    switch(currentStep) {
      case 1:
        // QR code must be scanned
        return form.step1.scannedTankQRCode !== '';
      
      case 2:
        // Vendor must be selected
        return form.step2.selectedVendor !== null && form.step2.selectedVendor.id > 0;
      
      case 3:
        // Amount must be entered (not empty)
        return form.step3.amountFueled !== '' && form.step3.amountFueled !== '0';

      case 4:
        // After-meter photo must be taken
        return form.step4.afterMeterPhoto !== null;

      case 5:
        // Receipt photo must be taken
        return form.step5.receiptPhoto !== null;
      
      default:
        return true;
    }
  };

  const stepView = useMemo( () => {
    let content;
    let subtitle = '';


    switch(step){
        case 1:
            subtitle = 'Scan the QR code on the tank.';
            
            content = (
                <View style={styles.stepViewScanContainer}>
                    {!form.step1.scannedTankQRCode ? (
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
                                                const tankerUnit = (devTanker.amount_type || '').toUpperCase().startsWith('G') ? 'Gal.' : 'L';
                                                setScannedTanker({ ...devTanker, in_use: true });
                                                setForm(prev => ({
                                                    ...prev,
                                                    step1: { ...prev.step1, scannedTankQRCode: devTanker.qr_token },
                                                    step3: { ...prev.step3, amountFueledUnit: tankerUnit },
                                                }));
                                                lockTanker(devTanker.id);
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
                                {scannedTanker?.image_url
                                    ? <Image source={{ uri: scannedTanker.image_url }} style={styles.scanResultImage} resizeMode="cover" />
                                    : (
                                        <View style={styles.scanResultQR}>
                                            <View style={styles.scanResultQRInner}>
                                                <QRCode
                                                    value={form.step1.scannedTankQRCode || 'N/A'}
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
                                        <Text style={styles.scanResultLabel}>Tank</Text>
                                        <Text style={styles.scanResultValue}>{scannedTanker?.name || form.step1.scannedTankQRCode}</Text>
                                    </View>
                                    <View style={styles.scanResultDivider} />
                                    <View>
                                        <Text style={styles.scanResultLabel}>Fuel type</Text>
                                        <Text style={styles.scanResultValue}>{scannedTanker?.gas_type || '—'}</Text>
                                    </View>
                                </View>
                            </View>
                            <TouchableOpacity 
                                style={styles.rescanButton}
                                onPress={() => {
                                    setForm({
                                        ...form,
                                        step1: {
                                            ...form.step1,
                                            scannedTankQRCode: ''
                                        }
                                    });
                                    unlockTanker();
                                    setScannedTanker(null);
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
        case 2:
            subtitle = 'Select vendor.';

            content = (
                <ScrollView showsVerticalScrollIndicator={false} style={styles.stepViewList} contentContainerStyle={styles.stepViewListContainer}>
                    {!formDataLoaded ? (
                        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
                    ) : formData.vendors.length === 0 ? (
                        <Text style={{ color: colors.lighter5, textAlign: 'center', marginTop: 40 }}>No vendors found. Add vendors in the admin panel.</Text>
                    ) : (
                        formData.vendors.map(vendor => (
                            <TouchableOpacity
                                key={vendor.id}
                                activeOpacity={.5}
                                style={styles.stepViewListItem}
                                onPress={() => setForm({ ...form, step2: { ...form.step2, selectedVendor: vendor } })}
                            >
                                <Text style={styles.stepViewListItemText}>{vendor.name}</Text>
                                <View style={[styles.stepViewListItemCheck, form.step2.selectedVendor?.id === vendor.id && styles.stepViewListItemCheckDone]}>
                                    {form.step2.selectedVendor?.id === vendor.id && (
                                        <MaterialCommunityIcons name="check" size={23} color={colors.onAccent} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            )
        
        break;
        case 3:
            subtitle = 'Insert the amount fueled.';
            
            content = (
                <AmountInput
                    value={form.step3.amountFueled}
                    unit={form.step3.amountFueledUnit}
                    onValueChange={(newValue) => {
                        setForm({
                            ...form,
                            step3: {
                                ...form.step3,
                                amountFueled: newValue
                            }
                        });
                    }}
                    onUnitChange={() => {
                        // Unit is locked for FuelIN
                    }}
                    onNext={() => setStep(step + 1)}
                    unitLocked={true}
                />
            );
        
        break;
        case 4:
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
                        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                            <Text style={styles.permissionButtonText}>Grant Permission</Text>
                        </TouchableOpacity>
                    </View>
                );
            } else {
                content = (
                    <View style={styles.stepViewCameraContainer}>
                        <View style={styles.cameraPreview}>
                            {form.step4.afterMeterPhoto ? (
                                <Image
                                    source={{ uri: `data:image/jpeg;base64,${form.step4.afterMeterPhoto}` }}
                                    style={styles.cameraPreviewImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <CameraView ref={cameraRef} style={styles.cameraPreviewPlaceholder} facing="back" />
                            )}
                        </View>
                        {form.step4.afterMeterPhoto ? (
                            <TouchableOpacity
                                style={styles.retakeButton}
                                onPress={() => setForm(prev => ({ ...prev, step4: { ...prev.step4, afterMeterPhoto: null } }))}
                            >
                                <MaterialCommunityIcons name="camera-retake" size={32} color={colors.white} />
                                <Text style={styles.retakeButtonText}>Retake</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.captureButton} onPress={() => takePicture('step4', 'afterMeterPhoto')}>
                                <View style={styles.captureButtonInner} />
                            </TouchableOpacity>
                        )}
                    </View>
                );
            }

        break;
        case 5:
            subtitle = 'Add the receipt.';

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
                        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                            <Text style={styles.permissionButtonText}>Grant Permission</Text>
                        </TouchableOpacity>
                    </View>
                );
            } else {
                content = (
                    <View style={styles.stepViewCameraContainer}>
                        <View style={styles.cameraPreview}>
                            {form.step5.receiptPhoto ? (
                                <Image
                                    source={{ uri: `data:image/jpeg;base64,${form.step5.receiptPhoto}` }}
                                    style={styles.cameraPreviewImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <CameraView ref={cameraRef} style={styles.cameraPreviewPlaceholder} facing="back" />
                            )}
                        </View>
                        {form.step5.receiptPhoto ? (
                            <TouchableOpacity
                                style={styles.retakeButton}
                                onPress={() => setForm(prev => ({ ...prev, step5: { ...prev.step5, receiptPhoto: null } }))}
                            >
                                <MaterialCommunityIcons name="camera-retake" size={32} color={colors.white} />
                                <Text style={styles.retakeButtonText}>Retake</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.captureButton} onPress={() => takePicture('step5', 'receiptPhoto')}>
                                <View style={styles.captureButtonInner} />
                            </TouchableOpacity>
                        )}
                    </View>
                );
            }

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
                    {[1, 2, 3, 4, 5].map((stepNumber, index) => (
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
                            {index < 4 && (
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

            {content}

        </View>
    )

  }, [step, form, permission, isScanning, scannedTanker, scanLookingUp, colors, styles]);

  const stepOptions = useMemo( () => {
    let valid = validateStep(step);
    let c2a = () => {
        setStep( step + 1 );
    };
    let text = 'Next step';

    switch(step){
        case 5:
            text = 'Submit Fuel-IN';
            c2a = () => {
                const tanker = scannedTanker;
                if (!tanker) {
                    showModal('Tanker Not Found', 'The scanned QR code does not match any registered tanker. Please rescan.', 'OK', () => {});
                    return;
                }
                const vendor = form.step2.selectedVendor;
                const amount = parseFloat(form.step3.amountFueled);
                const amount_type = form.step3.amountFueledUnit || 'L';

                const GAL_TO_L = 3.785411784;
                const L_TO_GAL = 0.264172052;

                const doSubmit = (liveTanker) => {
                    const inputUnit = amount_type.toUpperCase().startsWith('G') ? 'GAL' : 'L';
                    const tankUnit  = ((liveTanker.amount_type || tanker.amount_type || 'L')).toUpperCase().startsWith('G') ? 'GAL' : 'L';
                    let amountInTankUnit = amount;
                    if (inputUnit !== tankUnit) {
                        amountInTankUnit = inputUnit === 'GAL' ? amount * GAL_TO_L : amount * L_TO_GAL;
                    }

                    setSubmitting(true);

                    const meter_before = liveTanker.amount;
                    const meter_after  = Math.min(liveTanker.amount_cap, liveTanker.amount + amountInTankUnit);
                    const meter_unit   = tankUnit;

                    const uploadPhoto = (base64, slot) => {
                        if (!base64) return Promise.resolve(null);
                        return apiCall('app/fueling/upload-photo', 'POST', { image: base64, slot }, account)
                            .then(r => r?.success ? r.data.filename : null);
                    };

                    Promise.all([
                        uploadPhoto(form.step4.afterMeterPhoto, 'after'),
                        uploadPhoto(form.step5.receiptPhoto, 'receipt'),
                    ]).then(([photo_after, photo_receipt]) => {
                        apiCall('app/fueling/create', 'POST', {
                            form: {
                                type: 'IN',
                                tanker_id: tanker.id,
                                vendor_id: vendor.id,
                                amount,
                                amount_type,
                                fueler_id: account?.id ?? 0,
                                notes: '',
                                photo_after,
                                photo_receipt,
                                meter_before,
                                meter_after,
                                meter_unit,
                            }
                        }, account).then(res => {
                            setSubmitting(false);
                            if (res?.success) {
                                const spillage = res.data?.spillage;
                                const spillageUnit = res.data?.spillage_unit;
                                const spillageMsg = spillage > 0
                                    ? `\n\nSpillage of ${spillage.toFixed(1)} ${spillageUnit} was detected and recorded as a separate transaction.`
                                    : '';
                                showModal(
                                    'Fuel-IN Complete',
                                    `Successfully recorded ${amount} ${amount_type} from ${vendor.name} into ${tanker.name}.${spillageMsg}`,
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

                showModal(
                    'Confirm Fuel-IN',
                    `Tanker: ${tanker.name} (${tanker.gas_type || tanker.fuelType || ''})
Vendor: ${vendor.name}
Amount: ${amount} ${amount_type}

Please verify the details above before confirming.`,
                    'Confirm',
                    () => {
                        setSubmitting(true);
                        apiCall('app/fueling/lookup/tanker', 'POST', { id: tanker.id }, account).then(res => {
                            setSubmitting(false);
                            const liveTanker = res?.success ? res.data : null;
                            doSubmit(liveTanker || tanker);
                        });
                    },
                    true
                );
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
                style={[styles.stepOptionsButton, (step == 5) && styles.stepOptionsButtonDone, {
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
  }, [step, form, submitting, formDataLoaded, scannedTanker, colors, styles])

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
                            || !!form.step1.scannedTankQRCode
                            || !!form.step2.selectedVendor
                            || !!form.step3.amountFueled
                            || !!form.step4.afterMeterPhoto
                            || !!form.step5.receiptPhoto;
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
                <View style={[styles.headerIcon, { backgroundColor: colors.green }]}>
                    <MaterialCommunityIcons name="arrow-down" size={20} color={colors.onAccent} />
                </View>
                <Text style={styles.headerTitle}>Fuel-in</Text>
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
    backgroundColor: colors.green,
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
    width: 20,
    height: 3,
    backgroundColor: colors.surfaceRaised,
    marginHorizontal: 2,
  },
  stepIndicatorLineActive: {
    backgroundColor: colors.accent,
  },

  stepViewList: {
    flex: 1,
    paddingHorizontal: 14,
  },
  stepViewListContainer: {
    paddingTop: 10,
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
    backgroundColor: colors.dark,
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
