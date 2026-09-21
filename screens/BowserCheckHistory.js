import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from '../constants/config';
import { useThemedStyles } from '../context/ThemeContext';
import { useState, useEffect, useCallback } from 'react';
import { useAccount } from '../context/AccountContext';
import { apiCall } from '../helpers/apiCall';
import DateRangePicker, { formatDate } from '../components/DateRangePicker';

export default function BowserCheckHistory({ navigation }) {
  const { colors, styles, isDark } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { account } = useAccount();

  const [selectedTab, setSelectedTab] = useState(null); // null = all tankers
  const [records, setRecords]         = useState([]);
  const [tankers, setTankers]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage]               = useState(1);
  const [total, setTotal]             = useState(0);
  const [showPicker, setShowPicker]   = useState(false);
  const [startDate, setStartDate]     = useState(null);
  const [endDate, setEndDate]         = useState(null);

  // Load tanker tabs once on mount
  useEffect(() => {
    apiCall('app/bowser-checkup/tankers', 'POST', {}, account).then(res => {
      if (res?.success) setTankers(res.data.tankers || []);
    });
  }, []);

  const load = useCallback((tanker_id, p, from, to) => {
    setLoading(true);
    apiCall('app/bowser-checkup/history', 'POST', {
      tanker_id: tanker_id ?? null,
      page:      p,
      ...(from && to ? { from_ts: from.getTime(), to_ts: to.getTime() } : {}),
    }, account).then(res => {
      if (res?.success) {
        setRecords(res.data.records || []);
        setTotal(res.data.total || 0);
      }
      setLoading(false);
    });
  }, [account]);

  const handleDateChange = (s, e) => {
    setStartDate(s || null);
    setEndDate(e || null);
    if (s && e) {
      setPage(1);
      load(selectedTab, 1, s, e);
    }
  };

  const clearRange = () => {
    setStartDate(null);
    setEndDate(null);
    setShowPicker(false);
    setPage(1);
    load(selectedTab, 1, null, null);
  };

  useEffect(() => {
    load(null, 1);
  }, []);

  const handleTabChange = (tanker_id) => {
    setSelectedTab(tanker_id);
    setPage(1);
    load(tanker_id, 1, startDate, endDate);
  };

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || total <= records.length) return;
    const nextPage = page + 1;
    setPage(nextPage);
    setLoadingMore(true);
    apiCall('app/bowser-checkup/history', 'POST', {
      tanker_id: selectedTab ?? null,
      page:      nextPage,
      ...(startDate && endDate ? { from_ts: startDate.getTime(), to_ts: endDate.getTime() } : {}),
    }, account).then(res => {
      if (res?.success) setRecords(prev => [...prev, ...(res.data.records || [])]);
      setLoadingMore(false);
    });
  }, [loading, loadingMore, total, records.length, page, selectedTab, startDate, endDate, account]);

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
        <Text style={styles.headerTitle}>Bowser daily checks</Text>
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
        <TouchableOpacity
          onPress={() => navigation.navigate('BowserCheckup')}
          activeOpacity={0.7}
          style={styles.addButton}
        >
          <MaterialCommunityIcons name="plus" size={26} color={colors.white} />
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
          {tankers.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, selectedTab === t.id && styles.tabActive]}
              onPress={() => handleTabChange(t.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, selectedTab === t.id && styles.tabTextActive]}>{t.name}</Text>
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
            const isPass      = record.result === 'pass';
            const isFail      = record.result === 'fail';
            const accentColor = isFail ? colors.accent : isPass ? colors.green : colors.lighter3;
            const resultLabel = isFail ? 'FAIL' : 'PASS';
            return (
              <TouchableOpacity
                style={[styles.recordCard, { marginBottom: 10 }]}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('BowserCheckDetail', { record })}
              >
                <View style={[styles.recordAccent, { backgroundColor: accentColor }]} />
                <View style={styles.recordBody}>
                  <View style={styles.recordLeft}>
                    <Text style={styles.tankerName} numberOfLines={1}>{record.tanker_name}</Text>
                    {!!record.fueler_name && (
                      <Text style={styles.fuelerText}>{record.fueler_name}</Text>
                    )}
                    {!!record.comments && (
                      <Text style={styles.commentsText} numberOfLines={2}>{record.comments}</Text>
                    )}
                  </View>
                  <View style={styles.recordRight}>
                    <View style={[styles.resultBadge, { borderColor: accentColor, backgroundColor: accentColor + '20' }]}>
                      <Text style={[styles.resultBadgeText, { color: accentColor }]}>{resultLabel}</Text>
                    </View>
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

  // ── Header ────────────────────────────────────────────────────────────────
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
    marginRight: 6,
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
  addButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Tabs ──────────────────────────────────────────────────────────────────
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

  // ── List ──────────────────────────────────────────────────────────────────
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

  tankerName: {
    fontSize: config.fontsizes.text,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 2,
  },
  fuelerText: {
    fontSize: config.fontsizes.small,
    color: colors.lighter9,
    fontWeight: '500',
  },
  commentsText: {
    fontSize: config.fontsizes.small,
    color: colors.lighter5,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 2,
  },

  resultBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 6,
  },
  resultBadgeText: {
    fontSize: config.fontsizes.small,
    fontWeight: '800',
    letterSpacing: 0.5,
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
