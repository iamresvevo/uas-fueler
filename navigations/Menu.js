import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import config from '../constants/config';
import { useThemedStyles } from '../context/ThemeContext';
import { useAccount } from '../context/AccountContext';
import { useModal } from '../context/ModalContext';

export default function Menu({ toggleMenu, navigation }) {
  const { colors, styles, mode, setThemeMode } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { account, setAccount } = useAccount();
  const { showModal } = useModal();

  const handleNavigation = (screenName) => {
      toggleMenu();
      navigation.navigate(screenName);
  };

  const handleSignOut = async () => {


    // Clear account data
    setTimeout( () => {
      setAccount(null);
    }, 300);
    toggleMenu();
  };

  const confirmSignOut = () => {
    showModal(
      'Sign out',
      'Are you sure you want to sign out?',
      'Sign out',
      handleSignOut,
      true
    );
  };

  const appearanceOptions = [
    { value: 'system', label: 'Automatic', icon: 'theme-light-dark' },
    { value: 'light', label: 'Light', icon: 'weather-sunny' },
    { value: 'dark', label: 'Dark', icon: 'weather-night' },
  ];

  return (
    <View style={[styles.menuContainer, {
      paddingTop: insets.top + 12
    }]}>
      {/* Header with settings icon */}
      <View style={styles.menuHeader}>
        <View style={styles.menuTitleView}>
          <Text style={styles.menuTitle} numberOfLines={1}>{ account?.name }</Text>
          <View style={styles.menuPhoneView}>
            <MaterialCommunityIcons name="email" size={16} color={colors.lighter9} />
            <Text style={styles.menuPhone} numberOfLines={1}>{ account?.email }</Text>
          </View>
        </View>
        <TouchableOpacity activeOpacity={.5} onPress={toggleMenu} style={styles.settingsButton}>
          <MaterialCommunityIcons name="close" size={32} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Menu Items */}
      <ScrollView style={styles.menuContent} contentContainerStyle={styles.menuContentContainer}>

        <View style={styles.menuItemTitle}>
          <Text style={styles.menuItemTitleText}>Menu</Text>
        </View>

        <TouchableOpacity activeOpacity={.5} style={styles.menuItem} onPress={() => handleNavigation('FuelingHistory')}>
          <View style={styles.menuItemLabel}>
            <MaterialCommunityIcons name="history" size={22} color={colors.lighter9} />
            <Text style={styles.menuItemText}>History</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={23} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={.5} style={styles.menuItem} onPress={() => handleNavigation('Statistics')}>
          <View style={styles.menuItemLabel}>
            <MaterialCommunityIcons name="chart-box-outline" size={22} color={colors.lighter9} />
            <Text style={styles.menuItemText}>Statistics</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={23} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={.5} style={styles.menuItem} onPress={() => handleNavigation('BowserCheckHistory')}>
          <View style={styles.menuItemLabel}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={22} color={colors.lighter9} />
            <Text style={styles.menuItemText}>Bowser daily checks</Text>
          </View>
          <MaterialCommunityIcons name="clipboard-check-outline" size={23} color={colors.white} />
        </TouchableOpacity>

        <View style={styles.menuItemTitle}>
          <Text style={styles.menuItemTitleText}>Appearance</Text>
        </View>

        <View style={styles.appearanceSection}>
          <View style={styles.themeSelector}>
            {appearanceOptions.map(option => {
              const selected = mode === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${option.label} appearance`}
                  onPress={() => setThemeMode(option.value)}
                  style={[styles.themeOption, selected && styles.themeOptionActive]}
                >
                  <MaterialCommunityIcons
                    name={option.icon}
                    size={20}
                    color={selected ? colors.onAccent : colors.textMuted}
                  />
                  <Text style={[styles.themeOptionText, selected && styles.themeOptionTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>


        <TouchableOpacity 
          activeOpacity={.5} 
          style={[styles.menuItem, styles.lockItem]}
          onPress={confirmSignOut}
        >
          <View style={styles.menuItemLabel}>
            <MaterialCommunityIcons name="logout" size={22} color={colors.accent} />
            <Text style={[styles.menuItemText, { color: colors.accent }]}>Sign out</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  menuContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter05,
  },
  menuTitleView: {
    flex: 1,
    marginLeft: 12
  },
  menuTitle: {
    color: colors.accent,
    fontSize: config.fontsizes.menu,
    fontWeight: 'bold',
  },
  menuPhoneView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  menuPhone: {
    color: colors.lighter9,
    fontSize: config.fontsizes.text,
    fontWeight: '500',
    marginLeft: 6
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuContent: {
    flex: 1,
  },
  menuContentContainer: {
    paddingBottom: 24,
  },
  menuItemTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 8,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter05,
  },
  menuItemTitleText: {
    fontSize: config.fontsizes.text,
    fontWeight: 'bold',
    color: colors.lighter5,
  },
  menuDivider: {
    height: 1,
    marginTop: 24,
    backgroundColor: colors.lighter05,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingLeft: 28,
    paddingRight: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.lighter05,
  },
  menuItemLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuItemText: {
    color: colors.white,
    fontSize: config.fontsizes.menu,
    fontWeight: 'bold',
  },
  appearanceSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  themeSelector: {
    flexDirection: 'row',
    gap: 6,
    padding: 5,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  themeOption: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 4,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 3,
  },
  themeOptionActive: {
    backgroundColor: colors.accent,
  },
  themeOptionText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  themeOptionTextActive: {
    color: colors.onAccent,
  },
  lockItem: {
    marginTop: 12,
    paddingLeft: 20,
    marginHorizontal: 8,
    borderRadius: 25,
    paddingVertical: 0,
    height: 50,
    paddingRight: 20,
    borderBottomWidth: 0,
    backgroundColor: colors.lighter05,
  },
});
