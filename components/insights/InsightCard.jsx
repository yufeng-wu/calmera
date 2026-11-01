import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { FormCard } from "@/components/GlassForm";
import { TYPOGRAPHY } from "@/constants/typography";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";

// One question on the page: the question, the answer in words, then what backs it up.
export default function InsightCard({ title, answer, footnote, children }) {
  return <FormCard style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    {!!answer && <Text style={styles.answer}>{answer}</Text>}
    {children}
    {!!footnote && <Text style={styles.footnote}>{footnote}</Text>}
  </FormCard>;
}

// Numbers inside an answer.
export const Strong = ({ children }) => <Text style={styles.strong}>{children}</Text>;

// Small choices that change what one card shows.
export function Chips({ items, value, onChange, label }) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.chips}>
    {items.map(([id, text]) => {
      const selected = id === value;
      return <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: selected }} hitSlop={{ top: 8, bottom: 8 }}
        onPress={() => { if (selected) return; Haptics.selectionAsync().catch(() => {}); onChange(id); }}
        style={[styles.chip, selected && styles.chipSelected]}>
        <Text numberOfLines={1} style={[styles.chipText, selected && styles.chipTextSelected]}>{text}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 10 },
  title: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  answer: { ...TYPOGRAPHY.body, color: COLORS.text },
  strong: { ...TYPOGRAPHY.button, color: COLORS.text },
  footnote: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: COLORS.track },
  chipSelected: { backgroundColor: COLORS.primary },
  chipText: { ...TYPOGRAPHY.captionMedium, color: COLORS.text },
  chipTextSelected: { color: COLORS.white },
});
