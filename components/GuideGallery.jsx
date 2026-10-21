import { TYPOGRAPHY } from "@/constants/typography";
import { useEffect, useRef, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { FormHeader, GlassButton, formStyles } from "@/components/GlassForm";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import FoodwrapWordmark from "@/components/FoodwrapWordmark";

const GUIDE_STEPS = [
  { title: "Zero your scale", description: "Place your empty bowl on the scale, then set the display to 0 g. Keep the display in view until calmera reads zero." },
  { title: "Add one food at a time", description: "Point your camera at the scale and add your first ingredient. Wait for it to be logged before adding the next one." },
  { title: "Review your meal", description: "Check the foods, weights and nutrition estimates in your session. Edit any item that needs a correction." },
  { title: "Keep the camera steady", description: "A phone stand helps keep your food and the scale display in view while you prepare your meal." },
];
export default function GuideGallery({ title = "calmera guide", onBack, finalPage }) {
  const { width, fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  const list = useRef(null);
  const [page, setPage] = useState(0);
  const items = finalPage ? [...GUIDE_STEPS, "selector"] : GUIDE_STEPS;
  useEffect(() => { list.current?.scrollToOffset({ offset: page * width, animated: false }); }, [width, page, fontScale]);
  const goNext = () => {
    if (page === items.length - 1) { onBack(); return; }
    list.current?.scrollToOffset({ offset: (page + 1) * width, animated: true });
  };
  return <View style={formStyles.screen}>
    <FormHeader title={title} onBack={onBack} />
    <FlatList key={`gallery-${width}-${fontScale}`} ref={list} initialScrollIndex={page} horizontal pagingEnabled data={items} style={styles.gallery}
      keyExtractor={(_, index) => String(index)} showsHorizontalScrollIndicator={false}
      getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      onMomentumScrollEnd={event => setPage(Math.max(0, Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
      renderItem={({ item, index }) => <View style={[styles.page, { width }]}>
        {item === "selector" ? finalPage : <ScrollView style={styles.stepCard} contentContainerStyle={styles.stepContent}>
          <FoodwrapWordmark style={{ marginBottom: 28 }} />
          <Text style={styles.stepNumber}>STEP {index + 1} OF {GUIDE_STEPS.length}</Text>
          <Text accessibilityRole="header" style={styles.stepTitle}>{item.title}</Text>
          <Text style={styles.stepDescription}>{item.description}</Text>
        </ScrollView>}
      </View>} />
    <View style={[styles.footer, largeText && styles.footerLarge]}>
      <View style={[styles.progress, largeText && styles.progressLarge]} accessibilityLabel={`Page ${page + 1} of ${items.length}`}>
        {items.map((_, index) => <View key={index} style={[styles.dot, index === page && styles.activeDot]} />)}
        <Text style={styles.pageCount}>{page + 1} / {items.length}</Text>
      </View>
      {!(finalPage && page === items.length - 1) && <GlassButton title={page === items.length - 1 ? "Done" : "Next"}
        symbol={page === items.length - 1 ? "checkmark" : "arrow.right"} onPress={goNext} style={[styles.next, largeText && styles.nextLarge]} />}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  gallery: { flex: 1 },
  page: { flex: 1, padding: 16, paddingTop: 8 },
  stepCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: "#EFE7DF" },
  stepContent: { flexGrow: 1, justifyContent: "center", padding: 28, gap: 14 },
  stepNumber: { ...TYPOGRAPHY.caption, color: COLORS.textLight, textAlign: "center" },
  stepTitle: { ...TYPOGRAPHY.authTitle, color: COLORS.text, textAlign: "center" },
  stepDescription: { ...TYPOGRAPHY.body, color: COLORS.textLight, textAlign: "center" },
  footer: { minHeight: 78, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18 },
  footerLarge: { flexDirection: "column", alignItems: "stretch", gap: 12 },
  progressLarge: { flex: 0, alignSelf: "center" },
  nextLarge: { width: "100%" },
  progress: { flexDirection: "row", gap: 6, alignItems: "center", flex: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D8CABF" },
  activeDot: { backgroundColor: COLORS.primary, width: 18 },
  pageCount: { ...TYPOGRAPHY.caption, marginLeft: 6, color: COLORS.textLight,},
  next: { width: 104, minHeight: 46 },
});
