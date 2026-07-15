import NetInfo from '@react-native-community/netinfo'
import { useEffect, useState } from 'react'

/** True when the device has an active internet connection. */
export function useNetworkOnline(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const apply = (isConnected: boolean | null, isInternetReachable: boolean | null) => {
      if (isConnected === false || isInternetReachable === false) {
        setOnline(false)
      } else if (isConnected === true) {
        setOnline(true)
      }
    }

    const unsub = NetInfo.addEventListener((state) => {
      apply(state.isConnected, state.isInternetReachable)
    })
    void NetInfo.fetch().then((state) => {
      apply(state.isConnected, state.isInternetReachable)
    })
    return () => unsub()
  }, [])

  return online
}
