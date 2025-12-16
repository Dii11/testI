import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { COLORS } from '../constants';
import SimpleStepsDashboard from '../screens/health/SimpleStepsDashboard';
import CustomerDetailsScreen from '../screens/main/CustomerDetailsScreen_IMPROVED';
import CustomersScreen from '../screens/main/CustomersScreen';
import DoctorDetailsScreen from '../screens/main/DoctorDetailsScreen_IMPROVED';
import DoctorsScreen from '../screens/main/DoctorsScreen';
import type { RootState } from '../store';

const Tab = createBottomTabNavigator();
const DoctorsStack = createStackNavigator();
const CustomersStack = createStackNavigator();
const HealthStack = createStackNavigator();
const PublicRoomStack = createStackNavigator();

const DoctorsStackNavigator: React.FC = () => {
  return (
    <DoctorsStack.Navigator screenOptions={{ headerShown: false }}>
      <DoctorsStack.Screen name="DoctorsList" component={DoctorsScreen} />
      <DoctorsStack.Screen name="DoctorDetails" component={DoctorDetailsScreen} />
    </DoctorsStack.Navigator>
  );
};

const CustomersStackNavigator: React.FC = () => {
  return (
    <CustomersStack.Navigator screenOptions={{ headerShown: false }}>
      <CustomersStack.Screen name="CustomersList" component={CustomersScreen} />
      <CustomersStack.Screen name="CustomerDetails" component={CustomerDetailsScreen} />
    </CustomersStack.Navigator>
  );
};

const HealthStackNavigator: React.FC = () => {
  return (
    <HealthStack.Navigator screenOptions={{ headerShown: false }}>
      <HealthStack.Screen name="HealthDashboard" component={SimpleStepsDashboard} />
    </HealthStack.Navigator>
  );
};

const MainNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useSelector((state: RootState) => state.auth);
  const isDoctor = user?.accountType === 'health_specialist';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Doctors':
              iconName = focused ? 'medical' : 'medical-outline';
              break;
            case 'Customers':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'Health':
              iconName = focused ? 'fitness' : 'fitness-outline';
              break;
            case 'PublicRoom':
              iconName = focused ? 'globe' : 'globe-outline';
              break;
            default:
              iconName = 'ellipse-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.PRIMARY,
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)',
        tabBarStyle: (() => {
          // Get the currently focused route name from the nested navigator
          const routeName = getFocusedRouteNameFromRoute(route) ?? 'DoctorsList';

          // Top-level screens that should show the tab bar
          const topLevelScreens = ['DoctorsList', 'CustomersList', 'HealthDashboard', 'PublicRoom'];
          const shouldShowTabBar = topLevelScreens.includes(routeName);

          if (shouldShowTabBar) {
            return {
              backgroundColor: COLORS.GLASS_BG,
              borderTopWidth: 1,
              borderTopColor: COLORS.GLASS_BORDER_LIGHT,
              position: 'absolute' as const,
              bottom: 0,
              left: 0,
              right: 0,
              elevation: 0,
              shadowOpacity: 0,
              paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8),
              paddingTop: 8,
              height:
                (Platform.OS === 'ios' ? 68 : 60) +
                Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8),
            };
          }

          return {
            display: 'none' as const,
          };
        })(),
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarVisibilityAnimationConfig: {
          show: {
            animation: 'timing',
            config: {
              duration: 200,
            },
          },
          hide: {
            animation: 'timing',
            config: {
              duration: 200,
            },
          },
        },
      })}
      screenListeners={{
        state: () => {
          // Add haptic feedback for tab switches
          if (Platform.OS === 'ios') {
            Haptics.selectionAsync().catch(() => {
              // Haptic feedback failed, continue silently
            });
          }
        },
      }}
    >
      {isDoctor ? (
        <>
          <Tab.Screen
            name="Customers"
            component={CustomersStackNavigator}
            options={{
              tabBarLabel: 'Patients',
            }}
          />
        </>
      ) : (
        <>
          <Tab.Screen
            name="Doctors"
            component={DoctorsStackNavigator}
            options={{
              tabBarLabel: 'Doctors',
            }}
          />
          <Tab.Screen name="Health" component={HealthStackNavigator} />
        </>
      )}
    </Tab.Navigator>
  );
};

export default MainNavigator;
