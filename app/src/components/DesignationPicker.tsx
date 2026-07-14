import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  DESIGNATIONS,
  designationColor,
  type CategoryKey,
} from '../data/designations'
import { C, mono, RADIUS } from '../theme'

export function DesignationPicker({
  visible,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean
  selected: string | null
  onClose: () => void
  onSelect: (name: string) => void
}) {
  const [query, setQuery] = useState('')

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = DESIGNATIONS.filter((d) => d.name.toLowerCase().includes(q))
    return CATEGORY_ORDER.map((cat) => ({
      cat,
      items: matched.filter((d) => d.category === cat),
    })).filter((g) => g.items.length > 0)
  }, [query])

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.head}>
            <View style={styles.headRow}>
              <Text style={styles.headTitle}>Select designation</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={{ fontFamily: mono, fontSize: 18, color: C.textDim }}>×</Text>
              </Pressable>
            </View>
            <View style={styles.search}>
              <Text style={{ color: C.textFaint, fontSize: 13 }}>⌕</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search designations…"
                placeholderTextColor={C.textFaint}
                autoCorrect={false}
                style={{ flex: 1, fontSize: 13, color: C.textBody, padding: 0 }}
              />
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20 }}>
            {grouped.map((group) => (
              <View key={group.cat}>
                <View style={styles.groupHead}>
                  <View style={{ width: 7, height: 7, backgroundColor: CATEGORY_COLOR[group.cat as CategoryKey] }} />
                  <Text style={{ fontFamily: mono, fontSize: 9, letterSpacing: 1, color: C.textFaint }}>
                    {CATEGORY_LABEL[group.cat as CategoryKey]}
                  </Text>
                </View>
                {group.items.map((d) => {
                  const active = d.name === selected
                  return (
                    <Pressable
                      key={d.name}
                      onPress={() => onSelect(d.name)}
                      style={[styles.row, active && { backgroundColor: 'rgba(22,192,174,0.06)' }]}
                    >
                      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: designationColor(d.name) }} />
                      <Text style={{ flex: 1, fontSize: 13, color: active ? '#E8EDF4' : C.textBody }}>{d.name}</Text>
                      {active && <Text style={{ color: C.teal, fontWeight: '700' }}>✓</Text>}
                    </Pressable>
                  )
                })}
              </View>
            ))}
            {grouped.length === 0 && (
              <Text style={{ fontFamily: mono, fontSize: 12, color: C.textFaint, textAlign: 'center', marginTop: 30 }}>
                No matching designations
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,6,11,0.6)', justifyContent: 'flex-end' },
  sheet: {
    height: '82%',
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderColor: C.line2,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  head: { padding: 20, paddingBottom: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headTitle: { fontSize: 18, fontWeight: '600', color: C.text },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.teal,
    borderRadius: RADIUS,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: RADIUS,
  },
})
