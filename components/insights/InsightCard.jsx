import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { FormCard } from "@/components/GlassForm";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

// One question on the page: the question, the answer in words, then what backs it up.
// With onPress, the whole card opens more detail, and a chevron says so.
export default function InsightCard({ title, answer, footnote, onPress, children }) {
  const card = <FormCard style={styles.card}>
    {!!title && <View style={styles.titleRow}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {!!onPress && <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />}
    </View>}
    {!!answer && <Text style={styles.answer}>{answer}</Text>}
    {children}
    {!!footnote && <Text style={styles.footnote}>{footnote}</Text>}
  </FormCard>;
  if (!onPress) return card;
  return <Pressable accessibilityRole="button" accessibilityHint="Opens details" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>{card}</Pressable>;
}

// Numbers inside an answer.
export const Strong = ({ children }) => <Text style={styles.strong}>{children}</Text>;

// Small choices that change what one card shows.
export function Chips({ items, value, onChange, label }) {
  // Scrolls sideways when the chips are wider than the card.
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={label}
    style={styles.chipScroller} contentContainerStyle={styles.chips}>
    {items.map(([id, text]) => {
      const selected = id === value;
      return <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: selected }} hitSlop={{ top: 8, bottom: 8 }}
        onPress={() => { if (selected) return; Haptics.selectionAsync().catch(() => {}); onChange(id); }}
        style={[styles.chip, selected && styles.chipSelected]}>
        <Text numberOfLines={1} style={[styles.chipText, selected && styles.chipTextSelected]}>{text}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 10 },
  pressed: { opacity: 0.6 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { ...TYPOGRAPHY.sectionTitle, flexShrink: 1, color: COLORS.text },
  answer: { ...TYPOGRAPHY.body, color: COLORS.text },
  strong: { ...TYPOGRAPHY.button, color: COLORS.text },
  footnote: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  chipScroller: { flexGrow: 0, marginHorizontal: -18 },
  chips: { flexDirection: "row", gap: 6, paddingHorizontal: 18 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.track },
  chipSelected: { backgroundColor: COLORS.primary },
  chipText: { ...TYPOGRAPHY.captionMedium, color: COLORS.text },
  chipTextSelected: { color: COLORS.white },
});
