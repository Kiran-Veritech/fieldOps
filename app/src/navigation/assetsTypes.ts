import type { NativeStackScreenProps } from '@react-navigation/native-stack'

export type AssetsStackParams = {
  AssetsList: undefined
  Enlist: undefined
  Submitted: { name: string; type: string; serialNumber: string }
}

export type AssetsScreenProps<T extends keyof AssetsStackParams> = NativeStackScreenProps<AssetsStackParams, T>
