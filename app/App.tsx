import { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './src/auth/AuthContext'
import { RootNavigator } from './src/navigation/RootNavigator'

// Keep the native splash up until BrandSplash / auth bootstrap take over.
SplashScreen.preventAutoHideAsync().catch(() => {})
SplashScreen.setOptions({ duration: 320, fade: true })

export default function App() {
  useEffect(() => {
    // Hand off to the JS brand splash as soon as the tree mounts.
    SplashScreen.hideAsync().catch(() => {})
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
