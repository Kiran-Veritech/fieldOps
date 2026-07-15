import { getFocusedRouteNameFromRoute } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { RouteProp } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useLayoutEffect } from 'react'
import AssetsListScreen from '../screens/AssetsListScreen'
import EnlistScreen from '../screens/EnlistScreen'
import SubmittedScreen from '../screens/SubmittedScreen'
import type { AppTabParams } from './appTypes'
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

type Props = {
  navigation: BottomTabNavigationProp<AppTabParams, 'Assets'>
  route: RouteProp<AppTabParams, 'Assets'>
}

export function AssetsStack({ navigation, route }: Props) {
  const focused = getFocusedRouteNameFromRoute(route) ?? 'AssetsList'

  useLayoutEffect(() => {
    navigation.setOptions({
      tabBarStyle: focused === 'AssetsList' ? TAB_STYLE : { display: 'none' },
    })
  }, [navigation, focused])

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="AssetsList" component={AssetsListScreen} />
      <Stack.Screen name="Enlist" component={EnlistScreen} />
      <Stack.Screen name="Submitted" component={SubmittedScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  )
}
