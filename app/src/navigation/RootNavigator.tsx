import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useAuth } from '../auth/AuthContext'
import { PresenceProvider } from '../location/PresenceProvider'
import { BrandSplash } from '../screens/BrandSplash'
import CapturingScreen from '../screens/CapturingScreen'
import ConsentScreen from '../screens/ConsentScreen'
import HomeScreen from '../screens/HomeScreen'
import OnboardingScreen from '../screens/OnboardingScreen'
import ProfileScreen from '../screens/ProfileScreen'
import RegisterScreen from '../screens/RegisterScreen'
import { AssetsStack } from './AssetsStack'
import { TasksStack } from './TasksStack'
import type { AuthStackParams } from './types'
import type { AppTabParams } from './appTypes'
import { C } from '../theme'

/** Keep the branded splash up long enough for the loading motion to read. */
const SPLASH_MIN_MS = 1600

const navTheme: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, border: C.hairline, primary: C.teal, text: C.text },
}

const AuthStack = createNativeStackNavigator<AuthStackParams>()
const Tabs = createBottomTabNavigator<AppTabParams>()

function TabGlyph({ glyph, color, active }: { glyph: string; color: string; active?: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      {active && (
        <View
          style={{
            position: 'absolute',
            top: -11,
            width: 28,
            height: 2,
            backgroundColor: C.teal,
            borderRadius: 1,
          }}
        />
      )}
      <Text style={{ fontSize: 18, color }}>{glyph}</Text>
    </View>
  )
}

function AppTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.panel,
          borderTopColor: C.hairline,
          borderTopWidth: 1,
          height: 64,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: C.teal,
        tabBarInactiveTintColor: C.textFaint,
        tabBarLabelStyle: { fontSize: 8, letterSpacing: 0.4, fontFamily: 'Courier' },
      }}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'HOME',
          tabBarIcon: ({ color, focused }) => <TabGlyph glyph="⌂" color={color} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="Tasks"
        component={TasksStack}
        options={{
          tabBarLabel: 'TASKS',
          tabBarIcon: ({ color, focused }) => <TabGlyph glyph="☰" color={color} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="Assets"
        component={AssetsStack}
        options={{
          tabBarLabel: 'ASSETS',
          tabBarIcon: ({ color, focused }) => <TabGlyph glyph="❖" color={color} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'PROFILE',
          tabBarIcon: ({ color, focused }) => <TabGlyph glyph="◉" color={color} active={focused} />,
        }}
      />
    </Tabs.Navigator>
  )
}

function AuthFlow() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="Consent" component={ConsentScreen} />
      <AuthStack.Screen name="Capturing" component={CapturingScreen} options={{ gestureEnabled: false }} />
    </AuthStack.Navigator>
  )
}

export function RootNavigator() {
  const { ready, me } = useAuth()
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), SPLASH_MIN_MS)
    return () => clearTimeout(t)
  }, [])

  if (!ready || !splashDone) {
    return <BrandSplash />
  }

  return (
    <PresenceProvider>
      <NavigationContainer theme={navTheme}>{me ? <AppTabs /> : <AuthFlow />}</NavigationContainer>
    </PresenceProvider>
  )
}
