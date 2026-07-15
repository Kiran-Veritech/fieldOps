import type { NativeStackScreenProps } from '@react-navigation/native-stack'

export type RegDraft = {
  email: string
  fullName: string
  designation: string
  password: string
}

export type AuthStackParams = {
  Onboarding: undefined
  Register: undefined
  Login: undefined
  ForgotPassword: { email?: string } | undefined
  Consent: RegDraft
  Capturing: RegDraft
}

export type AuthScreenProps<T extends keyof AuthStackParams> = NativeStackScreenProps<AuthStackParams, T>
