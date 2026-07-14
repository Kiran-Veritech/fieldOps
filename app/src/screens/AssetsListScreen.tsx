import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Chip, Mono } from '../components/ui'
import { ASSET_STATUS } from '../components/tokens'
import { api } from '../lib/api'
import { C, mono, RADIUS } from '../theme'
import type { Asset, AssetStatus } from '../types'
import type { AssetsScreenProps } from '../navigation/assetsTypes'

type FilterKey = 'all' | AssetStatus
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'PENDING', label: 'PENDING' },
  { key: 'APPROVED', label: 'APPROVED' },
  { key: 'REJECTED', label: 'REJECTED' },
]

const TYPE_GLYPH: Record<string, string> = {
  Camera: '◉',
  Tool: '⚒',
  Device: '▭',
  Equipment: '⬢',
  Vehicle: '⛟',
  Other: '❖',
}

export default function AssetsListScreen({ navigation }: AssetsScreenProps<'AssetsList'>) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [filter, setFilter] = useState<FilterKey>('all')
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const list = await api<Asset[]>('/assets/mine')
      setAssets(list)
    } catch {
      // keep previous
    } finally {
      setLoaded(true)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: assets.length }
    for (const f of FILTERS) if (f.key !== 'all') c[f.key] = assets.filter((a) => a.status === f.key).length
    return c
  }, [assets])

  const needsAction = assets.filter((a) => a.status === 'REJECTED').length
  const visible = filter === 'all' ? assets : assets.filter((a) => a.status === filter)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={{ fontSize: 19, fontWeight: '700', color: C.text }}>My assets</Text>
          <Mono style={{ fontSize: 10, color: C.textFaint, marginTop: 4 }}>
            {assets.length} ENLISTED{needsAction ? ` · ${needsAction} NEEDS ACTION` : ''}
          </Mono>
        </View>
        <Pressable style={styles.addBtn} onPress={() => navigation.navigate('Enlist')}>
          <Text style={{ color: C.bgDeep, fontSize: 20, fontWeight: '600', lineHeight: 22 }}>+</Text>
        </Pressable>
      </View>

      <View style={{ maxHeight: 46 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={`${f.label} ${counts[f.key] ?? 0}`} active={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 10 }}>
        {visible.map((a) => {
          const st = ASSET_STATUS[a.status]
          return (
            <View key={a._id} style={[styles.card, { borderLeftColor: st.color }]}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={styles.glyph}>
                  <Text style={{ fontSize: 18, color: C.textFaint }}>{TYPE_GLYPH[a.type] ?? '❖'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ flex: 1, fontSize: 13, color: '#E8EDF4', fontWeight: '500', lineHeight: 17 }}>{a.name}</Text>
                    <View style={{ backgroundColor: st.bg, borderRadius: RADIUS, paddingHorizontal: 7, paddingVertical: 3 }}>
                      <Mono style={{ fontSize: 8, color: st.color }}>{st.label}</Mono>
                    </View>
                  </View>
                  <Mono style={{ fontSize: 10, color: C.textFaint, marginTop: 5 }}>
                    {a.type} · {a.serialNumber}
                  </Mono>
                </View>
              </View>

              {a.status === 'REJECTED' && a.adminNote && (
                <View style={styles.note}>
                  <Mono style={{ fontSize: 8, color: '#FF8F94', letterSpacing: 0.8, marginBottom: 5 }}>
                    ADMIN NOTE · REJECTED
                  </Mono>
                  <Text style={{ fontSize: 11, color: '#FFB4B8', lineHeight: 16 }}>{a.adminNote}</Text>
                  <Pressable onPress={() => navigation.navigate('Enlist')}>
                    <Mono style={{ fontSize: 10, color: C.tealText, marginTop: 8 }}>Edit &amp; resubmit ›</Mono>
                  </Pressable>
                </View>
              )}
            </View>
          )
        })}

        {loaded && visible.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={{ fontSize: 24, color: C.textFaint }}>❖</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#E8EDF4' }}>No assets yet</Text>
            <Text style={{ fontSize: 13, color: C.textMute, marginTop: 6, textAlign: 'center' }}>
              Enlist a tool or device to submit it for admin approval.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS,
    backgroundColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderWidth: 1, borderColor: C.hairline, borderLeftWidth: 2, borderRadius: RADIUS, padding: 13 },
  glyph: {
    width: 40,
    height: 40,
    borderRadius: RADIUS,
    backgroundColor: C.panelAlt,
    borderWidth: 1,
    borderColor: C.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    marginTop: 10,
    padding: 12,
    backgroundColor: 'rgba(240,68,56,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(240,68,56,0.25)',
    borderRadius: RADIUS,
  },
  empty: { alignItems: 'center', paddingVertical: 50 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: C.line2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
})
