import { getFocusedRouteNameFromRoute } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import TasksListScreen from '../screens/TasksListScreen'
import TaskDetailScreen from '../screens/TaskDetailScreen'
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

export function TasksStack({ navigation, route }: { navigation: any; route: any }) {
  // Hide the tab bar on task detail (matches App Screens · 9)
  const focused = getFocusedRouteNameFromRoute(route) ?? 'TasksList'
  navigation.setOptions({
    tabBarStyle: focused === 'TaskDetail' ? { display: 'none' } : TAB_STYLE,
  })

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="TasksList" component={TasksListScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
    </Stack.Navigator>
  )
}
