import { getFocusedRouteNameFromRoute } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { RouteProp } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useLayoutEffect } from 'react'
import TasksListScreen from '../screens/TasksListScreen'
import TaskDetailScreen from '../screens/TaskDetailScreen'
import type { AppTabParams } from './appTypes'
import type { TasksStackParams } from './tasksTypes'
import { C } from '../theme'

const Stack = createNativeStackNavigator<TasksStackParams>()

const TAB_STYLE = {
  backgroundColor: C.panel,
  borderTopColor: C.hairline,
  borderTopWidth: 1,
  height: 64,
  paddingTop: 8,
  paddingBottom: 10,
}

type Props = {
  navigation: BottomTabNavigationProp<AppTabParams, 'Tasks'>
  route: RouteProp<AppTabParams, 'Tasks'>
}

export function TasksStack({ navigation, route }: Props) {
  const focused = getFocusedRouteNameFromRoute(route) ?? 'TasksList'

  // Must not call setOptions during render — it updates the parent tab navigator.
  useLayoutEffect(() => {
    navigation.setOptions({
      tabBarStyle: focused === 'TaskDetail' ? { display: 'none' } : TAB_STYLE,
    })
  }, [navigation, focused])

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="TasksList" component={TasksListScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
    </Stack.Navigator>
  )
}
