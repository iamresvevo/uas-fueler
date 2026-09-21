import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from '../constants/config';
import { useThemedStyles } from '../context/ThemeContext';
import { useState, useEffect, useCallback } from 'react';
import DateRangePicker, { formatDate } from '../components/DateRangePicker';
import { useAccount } from '../context/AccountContext';
import { apiCall } from '../helpers/apiCall';

export default function FuelingHistory({ navigation }) {
  const { colors, styles, isDark } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { account } = useAccount();

  const [selectedTab, setSelectedTab]     = useState(null);
  const [records, setRecords]             = useState([]);
  const [gasTypes, setGasTypes]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [page, setPage]                   = useState(1);
  const [total, setTotal]                 = useState(0);
  const [showPicker, setShowPicker]       = useState(false);
  const [startDate, setStartDate]         = useState(null);
  const [endDate, setEndDate]             = useState(null);

  const toTs    = (d) => Math.floor(new Date(d).setHours(0,0,0,0) / 1000);
  const toEndTs = (d) => Math.floor(new Date(d).setHours(23,59,59,999) / 1000);

  useEffect(() => {
    apiCall('app/fueling/gas-types', 'POST', {}, account).then(res => {
      if (res?.success) setGasTypes(res.data.gas_types || []);
    });
  }, []);

  const load = useCallback((gas_type_id, p, from, to) => {
    setLoading(true);
    apiCall('app/fueling/history', 'POST', {
      gas_type_id: gas_type_id ?? null,
      page:        p,
      ...(from && to ? { from_ts: toTs(from), to_ts: toEndTs(to) } : {}),
    }, account).then(res => {
      if (res?.success) {
        setRecords(res.data.records || []);
        setTotal(res.data.total || 0);
      }
      setLoading(false);
    });
  }, [account]);

  useEffect(() => { load(null, 1, null, null); }, []);

  const handleTabChange = (gasTypeId) => {
    setSelectedTab(gasTypeId);
    setPage(1);
    load(gasTypeId, 1, startDate, endDate);
  };

  const handleDateChange = (newStart, newEnd) => {
    setStartDate(newStart);
    setEndDate(newEnd);
    setPage(1);
    load(selectedTab, 1, newStart, newEnd);
  };

  const clearRange = () => {
    setStartDate(null);
    setEndDate(null);
    setShowPicker(false);
    setPage(1);
    load(selectedTab, 1, null, null);
  };

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || total <= records.length) return;
    const nextPage = page + 1;
    setPage(nextPage);
    setLoadingMore(true);
    apiCall('app/fueling/history', 'POST', {
      gas_type_id: selectedTab ?? null,
      page:        nextPage,
      ...(startDate && endDate ? { from_ts: toTs(startDate), to_ts: toEndTs(endDate) } : {}),
    }, account).then(res => {
      if (res?.success) setRecords(prev => [...prev, ...(res.data.records || [])]);
      setLoadingMore(false);
    });
  }, [loading, loadingMore, total, records.length, page, selectedTab, startDate, endDate, account]);

  return (
    <View style={[styles.container, {
      paddingTop: insets.top
    }]}>
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
        <Text style={styles.headerTitle}>Fueling history</Text>
        <TouchableOpacity
          onPress={() => setShowPicker(v => !v)}
          activeOpacity={0.7}
          style={[styles.filterBtn, (showPicker || startDate) && styles.filterBtnActive]}
        >
          <MaterialCommunityIcons
            name="calendar-range"
            size={20}
            color={(showPicker || startDate) ? colors.onAccent : colors.white}
          />
        </TouchableOpacity>
      </View>

      {/* Optional date range picker */}
      {showPicker && (
        <View style={styles.rangeRow}>
          <DateRangePicker
            startDate={startDate || new Date()}
            endDate={endDate || new Date()}
            onDateChange={handleDateChange}
            style={{ flex: 1 }}
          />
          {startDate && (
            <TouchableOpacity onPress={clearRange} activeOpacity={0.7} style={styles.clearBtn}>
              <MaterialCommunityIcons name="close-circle" size={20} color={colors.lighter5} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Active range pill */}
      {!showPicker && startDate && endDate && (
        <TouchableOpacity style={styles.rangePill} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
          <MaterialCommunityIcons name="calendar-range" size={14} color={colors.accent} />
          <Text style={styles.rangePillText}>{formatDate(startDate)} – {formatDate(endDate)}</Text>
          <TouchableOpacity onPress={clearRange} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="close" size={14} color={colors.lighter5} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === null && styles.tabActive]}
            onPress={() => handleTabChange(null)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, selectedTab === null && styles.tabTextActive]}>All</Text>
          </TouchableOpacity>
          {gasTypes.map(gt => (
            <TouchableOpacity
              key={gt.id}
              style={[styles.tab, selectedTab === gt.id && styles.tabActive]}
              onPress={() => handleTabChange(gt.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, selectedTab === gt.id && styles.tabTextActive]}>{gt.type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Records List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          style={styles.recordsList}
          contentContainerStyle={[styles.recordsListContent, {
            paddingBottom: insets.bottom + 12,
          }]}
          data={records}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <MaterialCommunityIcons name="database-off-outline" size={40} color={colors.lighter3} />
              <Text style={{ color: colors.lighter9, marginTop: 12 }}>No records for this period</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null
          }
          renderItem={({ item: record }) => {
            const isOut  = record.type === 'OUT';
            const isCorr = record.type === 'CORRECTION';
            const typeColor = isOut ? colors.accent : isCorr ? '#f5af18' : colors.green;
            const route = isOut
              ? record.aircraft ? `${record.tanker} → ${record.aircraft}` : record.tanker
              : record.vendor  ? `${record.vendor} → ${record.tanker}`  : record.tanker;
            return (
              <TouchableOpacity
                style={[styles.recordCard, { marginBottom: 10 }]}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('FuelTransactionDetail', {
                  transactionId: record.id,
                  transactionType: record.type,
                  record,
                })}
              >
                <View style={[styles.recordAccent, { backgroundColor: typeColor }]} />
                <View style={styles.recordBody}>
                  <View style={styles.recordLeft}>
                    <View style={[styles.typeBadge, { borderColor: typeColor, backgroundColor: typeColor + '20' }]}>
                      <Text style={[styles.typeBadgeText, { color: typeColor }]}>{record.type}</Text>
                    </View>
                    <Text style={styles.amountValue}>
                      {record.amount.toFixed(1)}
                      <Text style={styles.amountUnit}> {record.amount_type}</Text>
                    </Text>
                    <View style={styles.gasBadge}>
                      <MaterialCommunityIcons name="fuel" size={10} color={typeColor} />
                      <Text style={[styles.gasText, { color: typeColor }]}>{record.gas_type}</Text>
                    </View>
                    <Text style={styles.routeText} numberOfLines={1}>{route}</Text>
                  </View>
                  <View style={styles.recordRight}>
                    {record.fueler ? (
                      <>
                        <Text style={styles.metaLabel}>Fueler</Text>
                        <Text style={styles.metaValue}>{record.fueler}</Text>
                      </>
                    ) : <View />}
                    <View style={{ flex: 1 }} />
                    <Text style={styles.dateText}>{record.date_label}</Text>
                    <Text style={styles.timeText}>{record.time_label}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
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
    flex: 1,
    fontSize: config.fontsizes.title,
    fontWeight: 'bold',
    color: colors.white,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lighter05,
  },
  filterBtnActive: {
    backgroundColor: colors.accent,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter05,
    gap: 8,
  },
  clearBtn: {
    padding: 4,
  },
  rangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.accent + '18',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    alignSelf: 'flex-start',
  },
  rangePillText: {
    flex: 1,
    fontSize: config.fontsizes.small,
    color: colors.accent,
    fontWeight: '600',
  },
  tabsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter05,
    gap: 12,
  },

  tabs: {
    flexDirection: 'row',
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    backgroundColor: colors.darkest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabText: {
    fontSize: config.fontsizes.text,
    fontWeight: 'bold',
    color: colors.lighter9,
  },
  tabTextActive: {
    color: colors.onAccent,
  },
  recordsList: {
    flex: 1,
  },
  recordsListContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 20,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  recordCard: {
    backgroundColor: colors.tile,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  recordAccent: {
    width: 4,
    borderRadius: 2,
    margin: 10,
    marginRight: 0,
  },
  recordBody: {
    flex: 1,
    flexDirection: 'row',
    padding: 12,
    paddingLeft: 10,
    gap: 10,
  },
  recordLeft: {
    flex: 1,
    gap: 4,
  },
  recordRight: {
    alignItems: 'flex-end',
    minWidth: 90,
  },

  // Type badge
  typeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  typeBadgeText: {
    fontSize: config.fontsizes.small,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Amount
  amountValue: {
    fontSize: config.fontsizes.header,
    fontWeight: '800',
    color: colors.white,
    lineHeight: 32,
  },
  amountUnit: {
    fontSize: config.fontsizes.text,
    fontWeight: '500',
    color: colors.lighter9,
  },

  // Gas type badge
  gasBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gasText: {
    fontSize: config.fontsizes.small,
    fontWeight: '600',
  },

  // Route line
  routeText: {
    fontSize: config.fontsizes.small,
    color: colors.lighter9,
    fontWeight: '500',
  },

  // Right meta
  metaLabel: {
    fontSize: config.fontsizes.small,
    color: colors.lighter9,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: config.fontsizes.text,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 2,
  },
  dateText: {
    fontSize: config.fontsizes.small,
    color: colors.lighter9,
    fontWeight: '500',
    textAlign: 'right',
  },
  timeText: {
    fontSize: config.fontsizes.text,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'right',
  },


});
