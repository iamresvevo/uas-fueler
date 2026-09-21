import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from '../constants/config';
import { useThemedStyles } from '../context/ThemeContext';
import { useState, useEffect, useCallback } from 'react';
import DateRangePicker, { getThisWeek } from '../components/DateRangePicker';
import { useAccount } from '../context/AccountContext';
import { apiCall } from '../helpers/apiCall';

export default function Statistics({ navigation }) {
  const { colors, styles, isDark } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { account } = useAccount();
  const thisWeek = getThisWeek();
  const [startDate, setStartDate] = useState(thisWeek.start);
  const [endDate, setEndDate]     = useState(thisWeek.end);
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading]     = useState(true);

  const toTs    = (d) => Math.floor(new Date(d).setHours(0,0,0,0) / 1000);
  const toEndTs = (d) => Math.floor(new Date(d).setHours(23,59,59,999) / 1000);

  const load = useCallback((from, to) => {
    setLoading(true);
    apiCall('app/fueling/statistics', 'POST', {
      from_ts: toTs(from),
      to_ts:   toEndTs(to),
    }, account).then(res => {
      if (res?.success) setStatsData(res.data);
      setLoading(false);
    });
  }, [account]);

  useEffect(() => { load(startDate, endDate); }, []);

  const handleDateChange = (newStart, newEnd) => {
    setStartDate(newStart);
    setEndDate(newEnd);
    load(newStart, newEnd);
  };

  const daily    = statsData?.daily        || [];
  const byType   = statsData?.by_type      || [];
  const stocks   = statsData?.current_stock || [];
  const maxVal   = daily.length ? Math.max(...daily.map(d => d.out_vol || 0), 1) : 1;

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
        <Text style={styles.headerTitle}>Statistics</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} numberOfLines={1}>Fuel dispatched</Text>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
        />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 14 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Bar Chart — daily OUT volume */}
          <View style={styles.section}>
            {daily.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <MaterialCommunityIcons name="database-off-outline" size={36} color={colors.lighter3} />
                <Text style={{ color: colors.lighter9, marginTop: 10 }}>No data for this period</Text>
              </View>
            ) : (
              <>
                <View style={styles.chartContainer}>
                  {daily.map((item, index) => (
                    <View key={index} style={styles.barWrapper}>
                      <View style={styles.barContainer}>
                        <View
                          style={[styles.bar, {
                            height: `${(item.out_vol / maxVal) * 100}%`,
                            backgroundColor: index === daily.length - 1
                              ? colors.tile
                              : colors.green,
                          }]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Current stock card */}
                <View style={styles.stockCard}>
                  {stocks.map((s, i) => (
                    <View key={s.gas_type} style={[styles.stockItem, i > 0 && { marginTop: 12 }]}>
                      <Text style={styles.stockLabel}>{s.gas_type} in stock</Text>
                      <View style={[styles.stockBar, { backgroundColor: i === 0 ? colors.accent : colors.green }]} />
                      <Text style={styles.stockValue}>
                        {Number(s.stock_total).toFixed(1)} <Text style={styles.stockUnit}>{s.amount_type}</Text>
                      </Text>
                    </View>
                  ))}
                  {stocks.length === 0 && (
                    <Text style={{ color: colors.lighter9 }}>No stock data</Text>
                  )}
                </View>
              </>
            )}
          </View>

          {/* Per-fuel-type breakdown */}
          {byType.map((ft, i) => {
            const stock = stocks.find(s => s.gas_type === ft.gas_type);
            return (
              <View key={ft.gas_type_id} style={styles.section}>
                <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>{ft.gas_type} — period summary</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Dispatched</Text>
                    <Text style={styles.statValue}>
                      {Number(ft.out_vol).toFixed(1)} <Text style={styles.statUnit}>{ft.amount_type}</Text>
                    </Text>
                    <Text style={styles.statSubtext}>OUT</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>{stock ? 'Current stock' : 'Received'}</Text>
                    <Text style={styles.statValue}>
                      {stock
                        ? `${Number(stock.stock_total).toFixed(1)} `
                        : `${Number(ft.in_vol).toFixed(1)} `}
                      <Text style={styles.statUnit}>{stock ? stock.amount_type : ft.amount_type}</Text>
                    </Text>
                    <Text style={styles.statSubtext}>{stock ? 'STOCK' : 'IN'}</Text>
                  </View>
                </View>
              </View>
            );
          })}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter05,
  },
  backButton: {
    marginRight: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: config.fontsizes.title,
    fontWeight: 'bold',
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 14,
  },
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
    paddingLeft: 14,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter05,
  },
  sectionTitle: {
    fontSize: config.fontsizes.subtitle,
    fontWeight: 'bold',
    marginRight: 12,
    flexShrink: 1,
    color: colors.accent,
  },
  chartContainer: {
    flexDirection: 'row',
    height: 150,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  barWrapper: {
    flex: 1,
  },
  barContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 8,
    minHeight: 4,
  },
  barLabel: {
    fontSize: config.fontsizes.small,
    color: colors.lighter9,
    textAlign: 'center',
    marginTop: 4,
  },
  stockCard: {
    backgroundColor: colors.tile,
    borderRadius: 16,
    padding: 16,
  },
  stockItem: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: config.fontsizes.text,
    color: colors.white,
    fontWeight: '600',
  },
  stockBar: {
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: 2,
    flex: 1,
    marginHorizontal: 12,
  },
  stockValue: {
    fontSize: config.fontsizes.statValue,
    fontWeight: 'bold',
    color: colors.white,
  },
  stockUnit: {
    fontSize: 28,
    fontWeight: 'normal',
    color: colors.lighter9,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.tile,
    borderRadius: 16,
    padding: 16,
  },
  statLabel: {
    fontSize: config.fontsizes.small,
    color: colors.accent,
    fontWeight: '600',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 42,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 4,
  },
  statUnit: {
    fontSize: 28,
    fontWeight: 'normal',
    color: colors.lighter9,
  },
  statSubtext: {
    fontSize: config.fontsizes.small,
    color: colors.lighter9,
    fontWeight: '600',
  },
});
