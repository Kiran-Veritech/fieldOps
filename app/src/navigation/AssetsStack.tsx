import { getFocusedRouteNameFromRoute } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import AssetsListScreen from '../screens/AssetsListScreen'
import EnlistScreen from '../screens/EnlistScreen'
import SubmittedScreen from '../screens/SubmittedScreen'
import type { AssetsStackParams } from './assetsTypes'
import { C } from '../theme'

const Stack = createNativeStackNavigator<AssetsStackParams>()

const TAB_STYLE = {
  backgroundColor: C.panel,
  borderTopColor: C.hairline,
  borderTopWidth: 1,
  height: 64,
  paddingTop: 8,
  paddingBottom: 10,
}

export function AssetsStack({ navigation, route }: { navigation: any; route: any }) {
  const focused = getFocusedRouteNameFromRoute(route) ?? 'AssetsList'
  navigation.setOptions({
    tabBarStyle: focused === 'AssetsList' ? TAB_STYLE : { display: 'none' },
  })

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="AssetsList" component={AssetsListScreen} />
      <Stack.Screen name="Enlist" component={EnlistScreen} />
      <Stack.Screen name="Submitted" component={SubmittedScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  )
}
