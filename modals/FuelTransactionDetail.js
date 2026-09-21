import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from '../constants/config';
import { useThemedStyles } from '../context/ThemeContext';

export default function FuelTransactionDetail({ navigation, route }) {
  const { colors, styles, isDark } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { record } = route.params;

  const isOut  = record.type === 'OUT';
  const isCorr = record.type === 'CORRECTION';
  const typeColor = isOut ? colors.accent : isCorr ? colors.yellow : colors.green;
  const typeIcon  = isOut ? 'airplane-takeoff' : isCorr ? 'swap-horizontal' : 'gas-station';

  const hasMeter = record.meter_before != null || record.meter_after != null;
  const unit = record.meter_unit || record.amount_type || '';

  const DetailSection = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );

  const DetailRow = ({ label, value, accent = false, last = false }) => (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, accent && { color: typeColor, fontSize: config.fontsizes.title, fontWeight: 'bold' }]}>
        {value ?? '—'}
      </Text>
    </View>
  );

  const PhotoSlot = ({ label, base64, last = false }) => (
    <View style={[styles.photoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.photoLabel}>{label}</Text>
      {base64 ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${base64}` }}
          style={styles.photoImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.photoPlaceholder}>
          <MaterialCommunityIcons name="camera-off" size={28} color={colors.lighter3} />
          <Text style={styles.photoPlaceholderText}>No photo</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header + Hero combined */}
      <View style={[styles.heroBlock, { paddingTop: insets.top, backgroundColor: typeColor + '22', borderBottomColor: typeColor + '40' }]}>
        {/* Back button row */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={styles.backButton}
          >
            <MaterialCommunityIcons name="chevron-left" size={32} color={colors.white} />
          </TouchableOpacity>
          <View style={[styles.typePill, { backgroundColor: typeColor }]}>
            <MaterialCommunityIcons name={typeIcon} size={14} color={colors.onAccent} />
            <Text style={styles.typePillText}>{record.type}</Text>
          </View>
        </View>

        {/* Amount */}
        <Text style={styles.heroAmount}>
          {record.amount}
          <Text style={styles.heroUnit}> {record.amount_type}</Text>
        </Text>

        {/* Route line */}
        <Text style={styles.heroRoute}>
          {isOut
            ? record.aircraft ? `${record.tanker}  →  ${record.aircraft}` : record.tanker
            : record.vendor   ? `${record.vendor}  →  ${record.tanker}`   : record.tanker}
        </Text>

        {/* Date / time / gas type */}
        <View style={styles.heroMeta}>
          {record.gas_type ? (
            <View style={[styles.gasPill, { borderColor: typeColor + '60' }]}>
              <Text style={[styles.gasPillText, { color: typeColor }]}>{record.gas_type}</Text>
            </View>
          ) : null}
          <Text style={styles.heroDate}>{record.date_label}  ·  {record.time_label}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* General */}
        <DetailSection title="General">
          <DetailRow label="Transaction ID" value={`#${record.id}`} />
          <DetailRow label="Date" value={record.date_label} />
          <DetailRow label="Time" value={record.time_label} />
          <DetailRow label="Fuel type" value={record.gas_type || '—'} />
          <DetailRow label="Tanker / bowser" value={record.tanker} />
          <DetailRow label="Operator" value={record.fueler} last />
        </DetailSection>

        {/* Route */}
        <DetailSection title={isOut ? 'Dispatch' : 'Resupply'}>
          {isOut  && <DetailRow label="Aircraft" value={record.aircraft} />}
          {!isOut && <DetailRow label="Vendor" value={record.vendor} />}
          <DetailRow label="Amount" value={`${record.amount} ${record.amount_type}`} accent last />
        </DetailSection>

        {/* Meter readings (OUT and CORRECTION) */}
        {hasMeter && (
          <DetailSection title="Meter readings">
            <DetailRow label="Before" value={record.meter_before != null ? `${record.meter_before} ${unit}` : null} />
            <DetailRow label="After"  value={record.meter_after  != null ? `${record.meter_after}  ${unit}` : null} />
            {record.meter_before != null && record.meter_after != null && (
              <DetailRow
                label="Difference"
                value={`${Math.abs(record.meter_after - record.meter_before).toFixed(2)} ${unit}`}
                accent
                last
              />
            )}
            {!(record.meter_before != null && record.meter_after != null) && (
              <DetailRow label="Unit" value={unit || '—'} last />
            )}
          </DetailSection>
        )}

        {/* Photos */}
        {(record.photo_before || record.photo_after || record.photo_receipt) && (
          <DetailSection title="Photos">
            {record.photo_before  && <PhotoSlot label="Before meter" base64={record.photo_before} />}
            {record.photo_after   && <PhotoSlot label="After meter"  base64={record.photo_after} />}
            {record.photo_receipt && <PhotoSlot label="Receipt"       base64={record.photo_receipt} last />}
          </DetailSection>
        )}

        {/* Notes */}
        {record.notes ? (
          <DetailSection title="Notes">
            <View style={[styles.detailRow, styles.detailRowLast]}>
              <Text style={[styles.detailValue, { textAlign: 'left', color: colors.white }]}>
                {record.notes}
              </Text>
            </View>
          </DetailSection>
        ) : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  // ── Header + Hero ─────────────────────────────────────────────────────────
  heroBlock: {
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  typePillText: {
    fontSize: config.fontsizes.small,
    fontWeight: '800',
    color: colors.onAccent,
    letterSpacing: 0.6,
  },
  heroAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.white,
    paddingHorizontal: 18,
    lineHeight: 52,
  },
  heroUnit: {
    fontSize: config.fontsizes.title,
    fontWeight: '600',
    color: colors.lighter9,
  },
  heroRoute: {
    fontSize: config.fontsizes.step,
    fontWeight: '600',
    color: colors.lighter9,
    paddingHorizontal: 18,
    marginTop: 4,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 10,
  },
  gasPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  gasPillText: {
    fontSize: config.fontsizes.small,
    fontWeight: '700',
  },
  heroDate: {
    fontSize: config.fontsizes.small,
    color: colors.lighter9,
    fontWeight: '500',
  },

  // ── Content ───────────────────────────────────────────────────────────────
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 14,
    paddingHorizontal: 14,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: config.fontsizes.small,
    fontWeight: '600',
    color: colors.lighter9,
    marginBottom: 8,
    paddingHorizontal: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: colors.tile,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter05,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: config.fontsizes.text,
    color: colors.lighter9,
    flex: 1,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: config.fontsizes.text,
    fontWeight: '600',
    color: colors.white,
    flex: 1,
    textAlign: 'right',
  },

  // ── Photos ────────────────────────────────────────────────────────────────
  photoRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter05,
    gap: 10,
  },
  photoLabel: {
    fontSize: config.fontsizes.small,
    color: colors.lighter9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  photoImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 10,
    backgroundColor: colors.darker3,
  },
  photoPlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 10,
    backgroundColor: colors.lighter05,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoPlaceholderText: {
    fontSize: config.fontsizes.small,
    color: colors.lighter3,
  },
});
