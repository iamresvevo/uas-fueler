import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Animated, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from '../constants/config';
import { useThemedStyles } from '../context/ThemeContext';
import MapView, { Marker } from 'react-native-maps';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAccount } from '../context/AccountContext';
import { apiCall } from '../helpers/apiCall';

// Default center: Johan Adolf Pengel International Airport, Suriname
const DEFAULT_REGION = {
  latitude: 5.4528,
  longitude: -55.1878,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function LiveFueling({ navigation }) {
  const { colors, styles, isDark } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { account } = useAccount();
  const mapRef = useRef(null);
  const markerRefs = useRef({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const [selectedTanker, setSelectedTanker] = useState(null);
  const [tankers, setTankers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    apiCall('app/live-fueling', 'POST', {}, account).then(res => {
      if (res?.success) {
        const all = [
          ...(res.data.active_tankers || []),
          ...(res.data.idle_tankers  || []),
        ];
        setTankers(all);
      }
      setLoading(false);

      // Fade in map
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

      // Slide in bottom sheet
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    });
  }, [account]);

  useEffect(() => {
    load();
  }, []);

  const fitAll = useCallback(() => {
    if (!mapRef.current) return;
    const coords = tankers
      .filter(t => t.lat != null && t.lng != null)
      .map(t => ({ latitude: t.lat, longitude: t.lng }));
    if (coords.length) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: insets.top + 84, right: 52, bottom: insets.bottom + 274, left: 52 },
        animated: true,
      });
    }
  }, [tankers, insets.top]);

  // Fit once tankers arrive (map may already be ready)
  useEffect(() => { fitAll(); }, [tankers]);

  const handleTankerPress = (tanker) => {
    setSelectedTanker(tanker.id);
    if (tanker.lat == null || tanker.lng == null) return;
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: tanker.lat,
        longitude: tanker.lng,
        latitudeDelta: 0.0005,
        longitudeDelta: 0.0005,
      }, 500);
    }
    if (markerRefs.current[tanker.id]) {
      markerRefs.current[tanker.id].showCallout();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Map */}
      <Animated.View style={[styles.mapContainer, { opacity: fadeAnim }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={DEFAULT_REGION}
          provider="google"
          customMapStyle={isDark ? mapStyle : []}
          showsPointsOfInterest={false}
          showsBuildings={false}
          loadingEnabled={true}
          loadingIndicatorColor={colors.accent}
          loadingBackgroundColor={colors.dark}
          onMapReady={fitAll}
        >
          {tankers.filter(t => t.lat != null && t.lng != null).map((tanker) => (
            <Marker
              key={tanker.id}
              ref={(ref) => markerRefs.current[tanker.id] = ref}
              coordinate={{ latitude: tanker.lat, longitude: tanker.lng }}
              title={tanker.name}
              description={`${tanker.in_use ? 'In use' : 'Available'} · ${tanker.level_pct}% · ${tanker.amount.toFixed(0)} ${tanker.amount_type}`}
              onPress={() => setSelectedTanker(tanker.id)}
            >
              <View style={[
                styles.markerContainer,
                tanker.in_use ? styles.markerInUse : styles.markerAvailable,
                selectedTanker === tanker.id && styles.markerSelected
              ]}>
                <MaterialCommunityIcons name="fuel-cell" size={24} color={colors.onAccent} />
              </View>
            </Marker>
          ))}
        </MapView>
      </Animated.View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="chevron-left" size={32} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} pointerEvents='none'>Live fueling</Text>
        <View style={styles.headerLive} pointerEvents='none' />
      </View>

      {/* Bottom Sheet */}
      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideAnim }] }]}> 
        <View style={styles.sheetHandle} />
        <View style={styles.sheetTitleView}>
          <Text style={styles.sheetTitle}>Fuel stock</Text>
          <TouchableOpacity onPress={load} activeOpacity={0.7} style={{ padding: 4 }}>
            <MaterialCommunityIcons name="refresh" size={20} color={colors.lighter5} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.tankerList}
          contentContainerStyle={[styles.tankerListContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : tankers.length === 0 ? (
            <Text style={{ color: colors.lighter5, textAlign: 'center', paddingVertical: 20 }}>No tankers found</Text>
          ) : tankers.map((tanker) => (
            <TouchableOpacity 
              key={tanker.id} 
              style={[styles.tankerCard, selectedTanker === tanker.id && styles.tankerCardSelected]}
              onPress={() => handleTankerPress(tanker)}
              activeOpacity={0.7}
            >
              <View style={styles.tankerInfo}>
                <View style={[
                  styles.tankerStatus,
                  tanker.in_use ? styles.tankerStatusInUse : styles.tankerStatusAvailable
                ]} />
                <View style={styles.tankerDetails}>
                  <Text style={styles.tankerName}>{tanker.name}</Text>
                  <View style={styles.tankerMeta}>
                    <View style={[styles.tankerStatusView, {
                      backgroundColor: tanker.in_use ? colors.yellow : colors.green
                    }]}>
                      <Text style={[styles.tankerStatusText, {
                        color: tanker.in_use ? colors.yellowDarker : colors.onAccent
                      }]}>
                        {tanker.in_use ? 'IN USE' : 'AVAILABLE'}
                      </Text>
                    </View>
                    <Text style={styles.tankerFuelType}>{tanker.fuelType}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.fuelLevelContainer}>
                <Text style={styles.fuelLevelText}>{tanker.level_pct}%</Text>
                <View style={styles.fuelLevelBar}>
                  <View 
                    style={[
                      styles.fuelLevelFill,
                      { 
                        width: `${tanker.level_pct}%`,
                        backgroundColor: tanker.level_pct > 30 ? colors.green : colors.accent
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.fuelLevelAmount}>{tanker.amount.toFixed(0)} / {tanker.amount_cap.toFixed(0)} {tanker.amount_type}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: colors.dark, // Match map dark style background
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.onAccent,
  },
  markerInUse: {
    backgroundColor: colors.accent,
  },
  markerAvailable: {
    backgroundColor: colors.green,
  },
  markerSelected: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  backButton: {
    marginRight: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: config.fontsizes.title,
    fontWeight: 'bold',
    color: colors.white,
  },
  headerLive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 6,
    backgroundColor: colors.accent
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: 14,
    minHeight: 200,
    maxHeight: '50%',
    elevation: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    marginTop: 9,
    borderRadius: 2,
    backgroundColor: colors.lighter3,
  },
  sheetTitleView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    color: colors.white,
    fontSize: config.fontsizes.subtitle,
    fontWeight: 'bold',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 8,
    textAlign: 'center'
  },
  tankerList: {
    flex: 1,
  },
  tankerListContent: {
    gap: 8,
    paddingTop: 12,
    paddingBottom: 20,
  },
  tankerCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.transparent,
  },
  tankerCardSelected: {
    backgroundColor: colors.surfacePressed,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  tankerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tankerStatus: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  tankerStatusInUse: {
    backgroundColor: colors.accent,
  },
  tankerStatusAvailable: {
    backgroundColor: colors.green,
  },
  tankerDetails: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start'
  },
  tankerName: {
    fontSize: config.fontsizes.title,
    fontWeight: 'bold',
    color: colors.white,
  },
  tankerStatusView: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    marginTop: 2,
    borderRadius: 12,
    paddingHorizontal: 10
  },
  tankerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  tankerFuelType: {
    fontSize: config.fontsizes.small,
    color: colors.textMuted,
    fontWeight: '600',
  },
  tankerStatusText: {
    fontSize: config.fontsizes.small,
    color: colors.yellowDarker,
    fontWeight: 'bold',
  },
  fuelLevelContainer: {
    alignItems: 'flex-end',
    width: 90,
  },
  fuelLevelText: {
    fontSize: config.fontsizes.text,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 6,
  },
  fuelLevelBar: {
    width: '100%',
    height: 6,
    backgroundColor: colors.darklight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fuelLevelFill: {
    height: '100%',
    borderRadius: 3,
  },
  fuelLevelAmount: {
    fontSize: config.fontsizes.small - 1,
    color: colors.textMuted,
    marginTop: 4,
  },
});

// Dark map style for better visibility
const mapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#1d2429" }]
  },
  {
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#8a8a8a" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#1d2429" }]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [{ "color": "#373d42" }]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "poi",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{ "color": "#1f3a2e" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#2b3135" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#1d2429" }]
  },
  {
    "featureType": "road",
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#3d4245" }]
  },
  {
    "featureType": "transit",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#0e1419" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#4e6d70" }]
  },
];
