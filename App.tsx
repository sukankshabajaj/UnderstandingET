import React, { useMemo } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Quicksand_700Bold } from '@expo-google-fonts/quicksand/700Bold';
import { AtkinsonHyperlegible_400Regular } from '@expo-google-fonts/atkinson-hyperlegible/400Regular';
import { AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible/700Bold';
import { MaterialSymbolsRounded_500Medium } from '@expo-google-fonts/material-symbols-rounded/500Medium';
import { createBackend } from './src/data';
import { AppProvider, useApp, type RouteName } from './src/state/app';
import { colors } from './src/theme';
import { Icon, T } from './src/ui/kit';
import { Auth, Join, ObAccess, ObNeeds, ObProfile, ObReady, ObTeam, ObWho, Welcome } from './src/screens/Onboarding';
import { CheckIn, MyWeek, TaskScreen, Today } from './src/screens/Person';
import { Tracker } from './src/screens/Tracker';
import { Clients, Notes, Overview, StrategyDetail } from './src/screens/Team';
import { Settings } from './src/screens/Settings';
import { Sheets } from './src/sheets/Sheets';

const SCREENS: Partial<Record<RouteName, React.ComponentType>> = {
  welcome: Welcome,
  auth: Auth,
  join: Join,
  'ob-who': ObWho,
  'ob-profile': ObProfile,
  'ob-needs': ObNeeds,
  'ob-access': ObAccess,
  'ob-team': ObTeam,
  'ob-ready': ObReady,
  clients: Clients,
  today: Today,
  task: TaskScreen,
  checkin: CheckIn,
  tracker: Tracker,
  myweek: MyWeek,
  notes: Notes,
  overview: Overview,
  strategy: StrategyDetail,
  settings: Settings,
};

/** Screens that need a loaded person and show the bottom navigation. */
const MAIN: RouteName[] = ['today', 'task', 'checkin', 'tracker', 'myweek', 'notes', 'overview', 'strategy', 'settings'];

function BottomNav() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const role = app.snap?.me.role;
  const items: [string, RouteName, string][] =
    role === 'self'
      ? [['Today', 'today', 'today'], ['Tracker', 'tracker', 'calendar_month'], ['My week', 'myweek', 'bar_chart'], ['Notes', 'notes', 'edit_note']]
      : [['Overview', 'overview', 'dashboard'], ['Tracker', 'tracker', 'calendar_month'], ['Notes', 'notes', 'edit_note']];
  const cur = app.route.name;
  const active = (k: RouteName) => k === cur || (k === 'today' && (cur === 'task' || cur === 'checkin')) || (k === 'overview' && cur === 'strategy');
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10, paddingHorizontal: 12, paddingBottom: Math.max(14, insets.bottom + 6), borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg }}>
      {items.map(([label, key, icon]) => {
        const on = active(key);
        const fg = on ? colors.primary : colors.navInactive;
        return (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={() => { app.closeSheet(); app.reset(key); }} style={{ alignItems: 'center', gap: 5, minWidth: 72, minHeight: 48, padding: 4 }}>
            <View style={{ width: 56, height: 30, borderRadius: 15, backgroundColor: on ? colors.border : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={24} color={fg} />
            </View>
            <T bold size={14} color={fg}>
              {label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

function Shell() {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);
  const name = app.route.name;
  const main = MAIN.includes(name) && !!app.snap;
  const Screen = name === 'loading' || (MAIN.includes(name) && !app.snap) ? null : SCREENS[name];
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: colors.bg, overflow: 'hidden' }}>
        <ScrollView
          key={`${name}:${app.route.params?.taskId ?? app.route.params?.strategyId ?? ''}`}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 4, paddingHorizontal: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            main ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await app.refresh();
                  setRefreshing(false);
                }}
              />
            ) : undefined
          }
        >
          {Screen ? <Screen /> : null}
        </ScrollView>
        {main ? <BottomNav /> : null}
        {app.toastMsg ? (
          <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 20, right: 20, bottom: main ? 100 + insets.bottom : 30 + insets.bottom, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, zIndex: 30 }}>
            <T bold size={15} color="#fff" align="center">
              {app.toastMsg}
            </T>
          </View>
        ) : null}
        {app.snap ? <Sheets /> : null}
      </View>
    </View>
  );
}

export default function App() {
  const backend = useMemo(createBackend, []);
  const [fontsLoaded] = useFonts({
    Quicksand_700Bold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
    MaterialSymbolsRounded_500Medium,
  });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppProvider backend={backend}>
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.title = 'Stepwise · Understanding ET';
}
