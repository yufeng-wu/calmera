import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import SettingsRow from "@/components/SettingsRow";
import { SettingsSection } from "@/components/SettingsSection";
import { SETTINGS } from "@/constants/settingsTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { PRIVACY_DOCS, PRIVACY_EFFECTIVE_DATE } from "@/lib/privacyPolicy.mjs";

// One policy document as readable text: headings, paragraphs, bullet lists and
// term–definition pairs. The page around it supplies the title and scrolling.
export default function PrivacyPolicyView({ doc, onOpenDoc, preview = false }) {
  return <View style={styles.document}>
    <Text style={styles.effective}>Effective {PRIVACY_EFFECTIVE_DATE}</Text>
    {doc.intro.map((block, index) => <Block key={`intro-${index}`} block={block} onOpenDoc={onOpenDoc} preview={preview} />)}
    {doc.sections.map((section) => <View key={section.id} style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>{section.heading}</Text>
      {section.blocks.map((block, index) => <Block key={index} block={block} onOpenDoc={onOpenDoc} preview={preview} />)}
    </View>)}
  </View>;
}

function Block({ block, onOpenDoc, preview }) {
  if (block.type === "p") return <Text style={styles.body}>{block.text}</Text>;
  if (block.type === "list") return <View style={styles.list}>
    {block.items.map((item) => <View key={item} style={styles.item}>
      <Text style={styles.bullet}>•</Text><Text style={[styles.body, styles.itemText]}>{item}</Text>
    </View>)}
  </View>;
  if (block.type === "terms") return <View style={styles.list}>
    {block.items.map(({ term, text }) => <Text key={term} style={styles.body}>
      <Text style={styles.term}>{term}. </Text>{text}
    </Text>)}
  </View>;
  if (block.type === "link") return <Pressable accessibilityRole="link" hitSlop={8}
    onPress={() => { if (!preview) Linking.openURL(block.url).catch(() => {}); }}>
    {({ pressed }) => <Text style={[styles.body, styles.link, pressed && styles.pressed]}>{block.text}</Text>}
  </Pressable>;
  if (block.type === "doc" && onOpenDoc) return <SettingsSection style={styles.docLink}>
    <SettingsRow title={PRIVACY_DOCS[block.id].title} icon="document-text" tint="leaf" onPress={() => onOpenDoc(block.id)} />
  </SettingsSection>;
  return null;
}

const styles = StyleSheet.create({
  document: { gap: 22 },
  effective: { ...TYPOGRAPHY.caption, color: SETTINGS.inkSoft, marginBottom: -10 },
  section: { gap: 8 },
  heading: { ...TYPOGRAPHY.sectionTitle, color: SETTINGS.ink },
  body: { ...TYPOGRAPHY.body, color: SETTINGS.ink },
  term: { ...TYPOGRAPHY.bodyMedium, color: SETTINGS.ink },
  list: { gap: 6 },
  item: { flexDirection: "row", gap: 8, paddingRight: 4 },
  bullet: { ...TYPOGRAPHY.body, color: SETTINGS.inkSoft },
  itemText: { flex: 1 },
  link: { ...TYPOGRAPHY.bodyMedium, color: SETTINGS.accent },
  pressed: { opacity: 0.5 },
  docLink: { marginTop: 4 },
});
