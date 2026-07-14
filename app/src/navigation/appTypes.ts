import type { NavigatorScreenParams } from '@react-navigation/native'
import type { TasksStackParams } from './tasksTypes'

export type AppTabParams = {
  Home: undefined
  Tasks: NavigatorScreenParams<TasksStackParams> | undefined
  Assets: undefined
  Profile: undefined
}
