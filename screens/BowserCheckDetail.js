import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from '../constants/config';
import { useThemedStyles } from '../context/ThemeContext';
import { useState, useEffect } from 'react';
import { useAccount } from '../context/AccountContext';
import { apiCall } from '../helpers/apiCall';

export default function BowserCheckDetail({ navigation, route }) {
  const { colors, styles, isDark } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { account } = useAccount();
  const { record: initialRecord } = route.params;

  const [record, setRecord] = useState(initialRecord);
  const [loading, setLoading] = useState(false);

  // Fetch fresh detail on mount (initialRecord from list may be partial)
  useEffect(() => {
    setLoading(true);
    apiCall('app/bowser-checkup/detail', 'POST', { id: initialRecord.id }, account).then(res => {
      if (res?.success) setRecord(res.data.record);
      setLoading(false);
    });
  }, []);

  const isPass      = record.result === 'pass';
  const isFail      = record.result === 'fail';
  const accentColor = isFail ? colors.accent : isPass ? colors.green : colors.lighter3;
  const resultLabel = isFail ? 'FAIL' : 'PASS';

  const Row = ({ label, value, valueColor }) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor && { color: valueColor }]}>{value ?? '—'}</Text>
    </View>
  );

  const Section = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="chevron-left" size={32} color={colors.white} />
        </TouchableOpacity>
        <View style={[styles.headerIcon, { backgroundColor: accentColor }]}>
          <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={colors.dark} />
        </View>
        <Text style={styles.headerTitle}>Bowser check</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero card */}
          <View style={[styles.heroCard, { borderLeftColor: accentColor }]}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroTanker}>{record.tanker_name}</Text>
              {!!record.fueler_name && (
                <Text style={styles.heroFueler}>{record.fueler_name}</Text>
              )}
            </View>
            <View style={styles.heroRight}>
              <View style={[styles.badge, { borderColor: accentColor, backgroundColor: accentColor + '20' }]}>
                <Text style={[styles.badgeText, { color: accentColor }]}>{resultLabel}</Text>
              </View>
              <Text style={styles.heroDate}>{record.date_label}</Text>
              <Text style={styles.heroTime}>{record.time_label}</Text>
            </View>
          </View>

          {/* General */}
          <Section title="General">
            <Row label="Bowser" value={record.tanker_name} />
            <Row label="Fueler" value={record.fueler_name} />
            <Row label="Date"   value={record.date_label} />
            <Row label="Time"   value={record.time_label} />
          </Section>

          {/* Result */}
          <Section title="Result">
            <Row label="Check result" value={resultLabel} valueColor={accentColor} />
          </Section>

          {/* Comments */}
          {!!record.comments && (
            <Section title="Comments">
              <Text style={styles.remarks}>{record.comments}</Text>
            </Section>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter05,
    gap: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: config.fontsizes.title,
    fontWeight: 'bold',
    color: colors.white,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    gap: 12,
  },

  // Hero card
  heroCard: {
    backgroundColor: colors.tile,
    borderRadius: 16,
    borderLeftWidth: 4,
    flexDirection: 'row',
    padding: 14,
    gap: 12,
  },
  heroLeft: {
    flex: 1,
    gap: 6,
  },
  heroRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  heroTanker: {
    fontSize: config.fontsizes.header,
    fontWeight: '800',
    color: colors.white,
  },
  heroFueler: {
    fontSize: config.fontsizes.small,
    color: colors.lighter9,
    fontWeight: '500',
    marginTop: 2,
  },
  heroDate: {
    fontSize: config.fontsizes.small,
    color: colors.lighter9,
    textAlign: 'right',
  },
  heroTime: {
    fontSize: config.fontsizes.text,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'right',
  },

  // Badge
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: config.fontsizes.small,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Section
  section: {
    backgroundColor: colors.tile,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: config.fontsizes.small,
    fontWeight: '700',
    color: colors.lighter9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionBody: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },

  // Row
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: colors.lighter05,
  },
  rowLabel: {
    fontSize: config.fontsizes.text,
    color: colors.lighter9,
    fontWeight: '500',
    flex: 1,
  },
  rowValue: {
    fontSize: config.fontsizes.text,
    color: colors.lighter9,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },

  // Remarks
  remarks: {
    fontSize: config.fontsizes.text,
    color: colors.lighter9,
    lineHeight: 22,
    paddingTop: 4,
  },
});
