import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Animated, PanResponder } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from '../constants/config';
import { useThemedStyles } from '../context/ThemeContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-gifted-charts';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { device_width } from '../helpers/deviceDimensions';
import { useAccount } from '../context/AccountContext';
import { apiCall } from '../helpers/apiCall';
import BrandLogo from '../components/BrandLogo';

const SHEET_COLLAPSED_OFFSET = 191;

export default function Dash({ toggleMenu, isMenuOpen }) {
    const { colors, styles, isDark } = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const { account } = useAccount();

    const [dashData, setDashData]     = useState(null);
    const [loading, setLoading]       = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
    const hasMounted = useRef(false);
    const sheetTranslateY = useRef(new Animated.Value(0)).current;
    const sheetOffset = useRef(0);

    const snapSheet = useCallback((collapsed, velocity = 0) => {
        const toValue = collapsed ? SHEET_COLLAPSED_OFFSET : 0;
        sheetOffset.current = toValue;
        setIsSheetCollapsed(collapsed);
        Animated.spring(sheetTranslateY, {
            toValue,
            velocity,
            damping: 24,
            stiffness: 240,
            mass: 0.9,
            overshootClamping: false,
            useNativeDriver: true,
        }).start();
    }, [sheetTranslateY]);

    const sheetPanResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => (
            Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx)
        ),
        onPanResponderGrant: () => {
            sheetTranslateY.stopAnimation(value => {
                sheetOffset.current = value;
            });
        },
        onPanResponderMove: (_, gesture) => {
            const nextOffset = Math.max(
                0,
                Math.min(SHEET_COLLAPSED_OFFSET, sheetOffset.current + gesture.dy)
            );
            sheetTranslateY.setValue(nextOffset);
        },
        onPanResponderRelease: (_, gesture) => {
            if (Math.abs(gesture.dy) < 8 && Math.abs(gesture.dx) < 8) {
                snapSheet(sheetOffset.current < SHEET_COLLAPSED_OFFSET / 2);
                return;
            }
            const nextOffset = Math.max(
                0,
                Math.min(SHEET_COLLAPSED_OFFSET, sheetOffset.current + gesture.dy)
            );
            const shouldCollapse = gesture.vy > 0.45
                || (gesture.vy >= -0.45 && nextOffset > SHEET_COLLAPSED_OFFSET / 2);
            snapSheet(shouldCollapse, gesture.vy);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => snapSheet(sheetOffset.current > SHEET_COLLAPSED_OFFSET / 2),
    }), [sheetTranslateY, snapSheet]);

    const loadDash = useCallback((isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else if (!hasMounted.current) setLoading(true);
        apiCall('app/dashboard', 'POST', {}, account).then(res => {
            if (res?.success) setDashData(res.data);
            setLoading(false);
            setRefreshing(false);
        });
    }, [account]);

    // Initial load
    useEffect(() => {
        hasMounted.current = false;
        loadDash();
        hasMounted.current = true;
    }, []);

    // Reload whenever this screen comes back into focus (e.g. after FuelIN/FuelOUT)
    useFocusEffect(
        useCallback(() => {
            if (hasMounted.current) loadDash();
        }, [loadDash])
    );

    // Build per-fuel-type summary from API data
    const byFuelType = dashData?.by_fuel_type ?? [];
    const allTankers = dashData?.tankers ?? [];
    const blockedTankers = allTankers.filter(t => t.bowser_check !== 'pass');

    // Chart data: one series per fuel type (daily OUT vol last 7 days)
    // First two fuel types → series1 (green), series2 (accent)
    const series1 = byFuelType[0]?.trend?.length ? byFuelType[0].trend.map(d => ({ value: d.value, label: d.label })) : [{ value: 0, label: '-' }];
    const series2 = byFuelType[1]?.trend?.length ? byFuelType[1].trend.map(d => ({ value: d.value, label: d.label })) : [{ value: 0, label: '-' }];
    const chartMaxVal = Math.max(...series1.map(d => d.value), ...series2.map(d => d.value), 100);

    return (
        <View style={[styles.container, {
            paddingTop: insets.top + 12
        }]}>

        {/* Header with hamburger and settings */}
        <View style={styles.header}>

            <View style={styles.headerLogoView}>
                <View style={styles.headerLogoStack}>
                    <BrandLogo width={83} height={40} isDark={isDark} colors={colors} />
                </View>
                <Text style={styles.headerLogoTitle}>Fueler</Text>
            </View>
            
            <TouchableOpacity activeOpacity={.5} 
                onPress={toggleMenu}
                style={styles.hamburgerButton}
            >
                <MaterialCommunityIcons name="menu" size={32} color={colors.white} />
            </TouchableOpacity>
        </View>

        {/* Main Content */}
        <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
                  <RefreshControl
                      refreshing={false}
                      onRefresh={() => loadDash(true)}
                      tintColor={colors.accent}
                  />
            }
        >
            <Text style={styles.title}>Dashboard.</Text>
            <Text style={styles.subtitle}>Time to fuel up.</Text>

            {loading ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={{ color: colors.lighter5, marginTop: 12 }}>Loading dashboard...</Text>
                </View>
            ) : (
                <>
            {/* Stock Tiles Row — one tile per fuel type */}
            <View style={styles.tilesRow}>
                {byFuelType.map((ft, idx) => {
                    const pct = ft.cap_total > 0 ? Math.round((ft.stock_total / ft.cap_total) * 100) : 0;
                    const tileColor = pct > 50 ? colors.green : colors.accent;

                    const ftTankers  = allTankers.filter(t => t.gas_type_id === ft.gas_type_id);
                    const failCount  = ftTankers.filter(t => t.bowser_check === 'fail').length;
                    const noneCount  = ftTankers.filter(t => t.bowser_check === 'not_checked').length;
                    const passCount  = ftTankers.filter(t => t.bowser_check === 'pass').length;
                    const checkIcon  = failCount > 0 ? 'close-circle' : noneCount > 0 ? 'clock-alert-outline' : 'check-circle';
                    const checkColor = failCount > 0 ? colors.accent : noneCount > 0 ? '#f5af18' : colors.green;
                    const checkLabel = failCount > 0 ? 'Check failed' : noneCount > 0 ? 'Not checked' : 'Checked';
                    const tileHasWarning = failCount > 0 || noneCount > 0;

                    return (
                        <TouchableOpacity
                            key={ft.gas_type_id}
                            activeOpacity={tileHasWarning ? 0.7 : 1}
                            onPress={tileHasWarning ? () => navigation.navigate('BowserCheckup') : undefined}
                            style={styles.stockTile}
                        >
                            <View style={styles.stockTileItem}>
                                <Text style={styles.stockLabel}>Stock {ft.gas_type}</Text>
                                <View style={styles.stockTotal}>
                                    <Text style={styles.stockAmount}>{ft.stock_total.toFixed(0)} <Text style={styles.unit}>{ft.amount_type}</Text></Text>
                                    <Text style={styles.stockSubtext}>REMAINING</Text>
                                </View>
                                <View style={styles.stockTotal}>
                                    <Text style={styles.stockAmount}>{ft.cap_total.toFixed(0)} <Text style={styles.unit}>{ft.amount_type}</Text></Text>
                                    <Text style={styles.stockSubtext}>TOTAL</Text>
                                </View>
                                {ftTankers.length > 0 && (
                                    <View style={styles.tileCheckRow}>
                                        <MaterialCommunityIcons name={checkIcon} size={12} color={checkColor} />
                                        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tileCheckText, { color: checkColor }]}>{checkLabel}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.gaugeContainer}>
                                <View style={[styles.gauge, { backgroundColor: tileColor }]}>
                                    <View style={[styles.gaugeEmpty, { height: (100 - pct) + '%' }]} />
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                })}
                {byFuelType.length === 0 && (
                    <View style={{ padding: 24 }}>
                        <Text style={{ color: colors.lighter5 }}>No tankers found</Text>
                    </View>
                )}
            </View>

            {/* Used Today and Live Fueling Row */}
            <View style={styles.tilesRow}>
                {/* Used Today */}
                <View style={styles.smallTile}>
                    {byFuelType.length > 0 ? (
                        <>
                            <Text style={styles.stockLabel}>Used today</Text>
                            {byFuelType.map(ft => (
                                <View key={ft.gas_type_id}>
                                    <Text style={[styles.stockAmount]}>{ft.used_today.toFixed(1)} <Text style={styles.unit}>{ft.amount_type}</Text></Text>
                                    <Text style={styles.stockSubtext}>{ft.gas_type}</Text>
                                </View>
                            ))}
                        </>
                    ) : (
                        <Text style={styles.stockLabel}>No data</Text>
                    )}
                </View>

                {/* Live Fueling */}
                <TouchableOpacity activeOpacity={.5} style={styles.smallTile} onPress={() => navigation.navigate("LiveFueling")}>
                    <Text style={styles.stockLabel}>Live fueling</Text>
                    <View style={styles.liveFuelingContent}>
                        <View style={styles.fuelPoints}>
                            <View style={styles.fuelPoint} />
                            {dashData?.active_count > 0 && <View style={[styles.fuelPoint, { opacity: 0.5 }]} />}
                        </View>
                        {dashData?.active_count > 0 && (
                            <Text style={{ color: colors.green, fontSize: 11, fontWeight: '700', marginTop: 4 }}>{dashData.active_count} active</Text>
                        )}
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={23} color={colors.lighter3} style={styles.chevron} />
                </TouchableOpacity>
            </View>

            {/* Per-tanker status */}
            {allTankers.length > 0 && (
                <View style={styles.tankersTile}>
                    <Text style={styles.stockLabel}>Tankers</Text>
                    {allTankers.map((t, idx) => {
                        const pct = t.level_pct ?? 0;
                        const barColor = pct < 20 ? colors.accent : pct < 40 ? '#f5af18' : colors.green;
                        const checkOk   = t.bowser_check === 'pass';
                        const checkFail = t.bowser_check === 'fail';
                        const checkIcon = checkOk ? 'check-circle' : checkFail ? 'close-circle' : 'clock-alert-outline';
                        const checkColor = checkOk ? colors.green : checkFail ? colors.accent : '#f5af18';
                        return (
                            <TouchableOpacity
                                key={t.id}
                                activeOpacity={checkOk ? 1 : 0.7}
                                onPress={checkOk ? undefined : () => navigation.navigate('BowserCheckup')}
                                style={[styles.tankerRow, idx < allTankers.length - 1 && styles.tankerRowBorder]}
                            >
                                <MaterialCommunityIcons name="tanker-truck" size={18} color={colors.lighter5} style={{ marginRight: 8 }} />
                                <View style={styles.tankerRowInfo}>
                                    <Text style={styles.tankerRowName}>{t.name}</Text>
                                    <View style={styles.tankerBarWrap}>
                                        <View style={styles.tankerBarTrack}>
                                            <View style={[styles.tankerBarFill, { width: pct + '%', backgroundColor: barColor }]} />
                                        </View>
                                        <Text style={[styles.tankerPct, { color: barColor }]} >{pct}%</Text>
                                    </View>
                                    <Text style={styles.tankerAmount}>{t.amount} / {t.amount_cap} {t.amount_type}</Text>
                                </View>
                                <MaterialCommunityIcons name={checkIcon} size={22} color={checkColor} style={{ marginLeft: 12 }} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {/* Fuel Consumption Chart */}
            <View style={styles.chartTile}>
                <View style={styles.chartHeader}>
                    <View>
                        <Text style={styles.stockLabel}>Fuel consumption trend</Text>
                        <Text style={styles.chartDateRange}>Last 7 days (dispatched)</Text>
                    </View>
                </View>
                <View style={styles.chartContainer}>
                    <LineChart
                        data={series1}
                        data2={byFuelType.length > 1 ? series2 : undefined}
                        height={140}
                        width={device_width - 80}
                        spacing={44}
                        initialSpacing={10}
                        color1={colors.green}
                        color2={colors.accent}
                        thickness={6}
                        startFillColor1={colors.green}
                        startFillColor2={colors.accent}
                        endFillColor1={colors.green}
                        endFillColor2={colors.accent}
                        startOpacity={0.4}
                        endOpacity={0.2}
                        curved
                        areaChart
                        hideDataPoints={false}
                        dataPointsRadius={0}
                        dataPointsColor1={colors.green}
                        dataPointsColor2={colors.accent}
                        rulesColor={colors.lighter1}
                        rulesType="solid"
                        yAxisColor={colors.lighter1}
                        xAxisColor={colors.lighter1}
                        yAxisTextStyle={{ color: colors.lighter5, fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: colors.lighter5, fontSize: 11 }}
                        showVerticalLines={false}
                        backgroundColor={colors.tile}
                        noOfSections={4}
                        maxValue={chartMaxVal}
                        yAxisLabelSuffix=" L"
                    />
                </View>
                <View style={styles.chartLegend}>
                    {byFuelType.map((ft, idx) => (
                        <View key={ft.gas_type_id} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: idx === 0 ? colors.green : colors.accent }]} />
                            <Text style={styles.legendText}>{ft.gas_type}</Text>
                        </View>
                    ))}
                </View>
            </View>
                </>
            )}

        </ScrollView>


         {/* Main Options */}
        <View
            pointerEvents={isMenuOpen ? 'none' : 'box-none'}
            style={[
                styles.optionsArea,
                { paddingBottom: Math.max(insets.bottom, 8) },
                isMenuOpen && styles.optionsAreaHidden,
            ]}
        >
          <Animated.View style={[styles.optionsTile, { transform: [{ translateY: sheetTranslateY }] }]}>
            <View
                style={styles.sheetDragArea}
                accessibilityRole="adjustable"
                accessibilityLabel="Main options sheet"
                accessibilityHint={isSheetCollapsed ? 'Swipe up to expand' : 'Swipe down to collapse'}
                accessibilityState={{ expanded: !isSheetCollapsed }}
                onAccessibilityTap={() => snapSheet(!isSheetCollapsed)}
                {...sheetPanResponder.panHandlers}
            >
                <View style={styles.sheetHandle} />
                <View style={styles.optionsHeader}>
                    <Text style={styles.optionsHeaderText}>Main options</Text>
                    <MaterialCommunityIcons
                        name={isSheetCollapsed ? 'chevron-up' : 'chevron-down'}
                        size={22}
                        color={colors.lighter5}
                        style={styles.sheetStateIcon}
                    />
                </View>
            </View>
            
            <TouchableOpacity activeOpacity={.5}
                style={styles.optionItem}
                onPress={() => navigation.navigate('FuelOUT')}
            >
                <View style={styles.optionLeft}>
                    <View style={[styles.optionIcon, { backgroundColor: colors.accent }]}>
                        <MaterialCommunityIcons name="arrow-up" size={20} color={colors.onAccent} />
                    </View>
                    <View>
                        <Text style={styles.optionText}>Fuel-out</Text>
                        {blockedTankers.length > 0 && (
                            <Text style={styles.optionWarning}>
                                {blockedTankers.map(t =>
                                    t.bowser_check === 'fail' ? `${t.name}: check failed` : `${t.name}: no check`
                                ).join(' · ')}
                            </Text>
                        )}
                    </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={23} color={colors.lighter5} />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={.5} 
                style={styles.optionItem}
                onPress={() => navigation.navigate('FuelIN')}
            >
                <View style={styles.optionLeft}>
                    <View style={[styles.optionIcon, { backgroundColor: colors.green }]}>
                        <MaterialCommunityIcons name="arrow-down" size={20} color={colors.onAccent} />
                    </View>
                    <Text style={styles.optionText}>Fuel-in</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={23} color={colors.lighter5} />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={.5} 
                style={[styles.optionItem, { borderBottomWidth: 0 }]}
                onPress={() => navigation.navigate('BowserCheckup')}
            >
                    <View style={styles.optionLeft}>
                    <View style={[styles.optionIcon, {
                        backgroundColor: dashData?.checkups_failed > 0
                            ? colors.accent
                            : dashData?.checkups_today > 0
                                ? colors.green
                                : colors.tile
                    }]}>
                        <MaterialCommunityIcons
                            name="clipboard-check-outline"
                            size={23}
                            color={(dashData?.checkups_failed > 0 || dashData?.checkups_today > 0)
                              ? colors.onAccent
                              : colors.white}
                        />
                    </View>
                    <View>
                        <Text style={styles.optionText}>Bowser fuel control</Text>
                        {!!(dashData?.checkups_failed || dashData?.checkups_today) && (
                            <Text style={{
                                fontSize: config.fontsizes.small,
                                color: dashData.checkups_failed > 0
                                    ? colors.accent
                                    : dashData.checkups_today > 0
                                        ? colors.green
                                        : colors.lighter5,
                                marginTop: 1,
                            }}>
                                {dashData.checkups_today} {dashData.checkups_today === 1 ? 'entry' : 'entries'} today
                                {dashData.checkups_failed > 0 ? ` · ${dashData.checkups_failed} drain fail${dashData.checkups_failed > 1 ? 's' : ''}` : ''}
                            </Text>
                        )}
                    </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={23} color={colors.lighter5} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        </View>
    );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter05,
  },
  headerLogoView: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerLogoTitle: {
    fontWeight: 'bold',
    fontSize: config.fontsizes.header,
    color: colors.white,
    letterSpacing: -0.4,
    marginLeft: 4,
  },
  headerLogoStack: {
    width: 83,
    height: 40,
    position: 'relative',
  },
  hamburgerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 12,
    paddingBottom: 330,
    paddingHorizontal: 14
  },
  title: {
    color: colors.accent,
    fontSize: config.fontsizes.header,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.white,
    fontSize: config.fontsizes.subtitle,
    marginBottom: 12,
    fontWeight: '500'
  },
  tilesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  stockTile: {
    flex: 1,
    backgroundColor: colors.tile,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stockTileItem: {
    flex: 1,
  },
  stockLabel: {
    color: colors.accent,
    fontSize: config.fontsizes.text,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  stockAmount: {
    color: colors.white,
    fontSize: config.fontsizes.header,
    fontWeight: 'bold',
  },
  unit: {
    fontSize: config.fontsizes.text,
    fontWeight: 'normal',
    marginLeft: 4,
  },
  stockSubtext: {
    color: colors.lighter9,
    fontSize: config.fontsizes.small,
    fontWeight: '500',
  },
  stockTotal: {
    marginTop: 8,
  },
  gaugeContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gauge: {
    width: 48,
    height: 120,
    backgroundColor: 'red',
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  gaugeEmpty: {
    width: '100%',
    backgroundColor: colors.darklight,
  },
  smallTile: {
    flex: 1,
    backgroundColor: colors.tile,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  liveFuelingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.lighter05,
  },
  fuelPoints: {
    flexDirection: 'row',
  },
  fuelPoint: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  chevron: {
    position: 'absolute',
    bottom: 18,
    right: 18,
  },
  chartTile: {
    borderRadius: 12,
    padding: 6,
    marginBottom: 24,
  },
  chartHeader: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  chartDateRange: {
    color: colors.lighter5,
    fontSize: config.fontsizes.small,
    fontWeight: '500',
    marginTop: -4,
  },
  chartContainer: {
    marginBottom: 16,
    marginLeft: -10,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: colors.white,
    fontSize: config.fontsizes.small,
    fontWeight: '600',
  },
  optionsArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingHorizontal: 10,
    paddingTop: 10,
    backgroundColor: colors.transparent,
    overflow: 'hidden',
  },
  optionsAreaHidden: {
    opacity: 0,
  },
  optionsTile: {
    backgroundColor: colors.sheet,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    elevation: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
  },
  sheetDragArea: {
    backgroundColor: colors.sheet,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    marginTop: 9,
    marginBottom: 1,
    borderRadius: 2,
    backgroundColor: colors.lighter3,
  },
  optionsHeader: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionsHeaderText: {
    color: colors.white,
    fontSize: config.fontsizes.subtitle,
    fontWeight: 'bold',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 8,
    textAlign: 'center'
  },
  sheetStateIcon: {
    position: 'absolute',
    right: 20,
    bottom: 8,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    color: colors.white,
    fontSize: config.fontsizes.menu,
    fontWeight: 'bold',
  },
  optionWarning: {
    color: colors.accent,
    fontSize: config.fontsizes.small,
    fontWeight: '600',
    marginTop: 1,
  },
  tankersTile: {
    backgroundColor: colors.tile,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tankerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  tankerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter1,
  },
  tankerRowInfo: {
    flex: 1,
  },
  tankerRowName: {
    color: colors.white,
    fontSize: config.fontsizes.text,
    fontWeight: '700',
    marginBottom: 5,
  },
  tankerBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  tankerBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.lighter1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  tankerBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  tankerPct: {
    fontSize: config.fontsizes.small,
    fontWeight: '700',
    textAlign: 'right',
  },
  tankerAmount: {
    color: colors.lighter5,
    fontSize: config.fontsizes.small,
  },
  tileCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  tileCheckText: {
    flexShrink: 1,
    fontSize: config.fontsizes.small,
    fontWeight: '700',
  },
});
