import { useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GlassButton } from "@/components/GlassForm";
import { FORM_COLORS as COLORS } from "@/constants/formTheme";
import { TYPOGRAPHY } from "@/constants/typography";
import { FOOD_EMOJI_CATEGORIES, getFoodEmojiSections } from "@/lib/foodEmojiPicker.mjs";

// Mount for each selection so another food always starts with all categories.
export default function FoodEmojiPicker({ selectedIconId, disabled = false, onSelect, onClose }) {
  const { bottom, top, left, right } = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [gridWidth, setGridWidth] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const largeText = fontScale >= 1.5;
  const search = useRef(null);
  const scroll = useRef(null);
  const categories = useRef(null);
  const sections = getFoodEmojiSections(query, categoryId);
  const resultCount = sections.reduce((total, section) => total + section.icons.length, 0);
  const searching = Boolean(query.trim());
  const availableWidth = gridWidth ?? Math.max(0, width - left - right - 40);
  const columns = Math.max(1, Math.min(5, Math.floor((availableWidth + 8) / (72 * Math.max(1, fontScale) + 8))));
  const tileWidth = Math.max(52, Math.floor((availableWidth - (columns - 1) * 8) / columns));
  const dismiss = () => { Keyboard.dismiss(); onClose(); };
  const resetResults = () => scroll.current?.scrollTo({ y: 0, animated: false });
  const changeQuery = value => {
    setQuery(value); setCategoryId("all"); resetResults();
    categories.current?.scrollTo({ x: 0, animated: false });
  };
  const showSearch = () => { resetResults(); search.current?.focus(); };
  const clearSearch = () => {
    changeQuery("");
    scroll.current?.scrollTo({ y: 0, animated: false });
    search.current?.focus();
  };
  const choose = iconId => {
    if (disabled) return;
    Keyboard.dismiss();
    onSelect(iconId);
    onClose();
  };

  const searchControl = <View style={styles.search}>
            <Ionicons name="search-outline" size={20} color={COLORS.textLight} accessible={false} />
            <TextInput ref={search} accessibilityLabel="Search food emojis" placeholder={fontScale >= 1.5 ? "Search" : "Search food or emoji"}
              placeholderTextColor={COLORS.textLight} value={query} onChangeText={changeQuery} autoCapitalize="none"
              autoCorrect={false} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} maxLength={100}
              onFocus={() => { setSearchFocused(true); resetResults(); }} onBlur={() => setSearchFocused(false)} style={styles.searchInput} />
            {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear emoji search" onPress={clearSearch} style={styles.clear}>
              <Ionicons name="close-circle" size={20} color={COLORS.textLight} />
            </Pressable>}
          </View>;
  const categoryControl = <>{!searching && !searchFocused && <ScrollView ref={categories} horizontal style={styles.categoryScroll} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.categories} accessibilityLabel="Food categories">
            {[{ id: "all", label: "All" }, ...FOOD_EMOJI_CATEGORIES].map(category => <Pressable key={category.id}
              accessibilityRole="button" accessibilityLabel={`${category.label} food emojis`} accessibilityState={{ selected: categoryId === category.id }}
              onPress={() => { Keyboard.dismiss(); setCategoryId(category.id); resetResults(); }}
              style={({ pressed }) => [styles.category, categoryId === category.id && styles.activeCategory, pressed && categoryId !== category.id && styles.pressed]}>
              <Text style={[styles.categoryLabel, categoryId === category.id && styles.activeCategoryLabel]}>{category.label}</Text>
            </Pressable>)}
          </ScrollView>}</>;

  return <Modal visible transparent animationType={reducedMotion ? "none" : "slide"} onRequestClose={dismiss}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.backdrop, { paddingTop: Math.max(top, 12), paddingLeft: left, paddingRight: right }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Dismiss emoji picker" accessibilityRole="button" />
      <View style={[styles.sheet, fontScale >= 1.5 && styles.tallSheet]} accessibilityViewIsModal onAccessibilityEscape={dismiss}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header" accessibilityLabel="Choose a food emoji">{fontScale >= 1.5 ? "Emoji" : "Food emoji"}</Text>
          {largeText && <Pressable accessibilityRole="button" accessibilityLabel="Show emoji search" onPress={showSearch} style={styles.headerSearch}>
            <Ionicons name="search-outline" size={22} color={COLORS.primary} />
          </Pressable>}
          <GlassButton symbol="xmark" accessibilityLabel="Close emoji picker" onPress={dismiss} style={styles.close} />
        </View>
        {!largeText && <View style={styles.pinnedControls}>{searchControl}{categoryControl}</View>}
        <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: Math.max(bottom, 20) }]}
          keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          contentInsetAdjustmentBehavior="never">
          {largeText && <View style={styles.scrollingControls}>{searchControl}{categoryControl}</View>}
          {searching && !(largeText && searchFocused) && <Text style={styles.caption} accessibilityLiveRegion="polite">{resultCount} {resultCount === 1 ? "emoji found" : "emojis found"}</Text>}
          <View onLayout={event => setGridWidth(event.nativeEvent.layout.width)} style={styles.sections}>
            {sections.map(section => <View key={section.id} style={styles.section}>
              {!(largeText && searchFocused) && <Text style={styles.sectionTitle} accessibilityRole="header">{section.label}</Text>}
              <View style={styles.grid}>{section.icons.map(icon => {
                const selected = icon.id === selectedIconId;
                return <Pressable key={icon.id} disabled={disabled} onPress={() => choose(icon.id)}
                  accessibilityRole="button" accessibilityLabel={icon.label} accessibilityState={{ selected, disabled }}
                  style={({ pressed }) => [styles.tile, { width: tileWidth }, selected && styles.selectedTile, pressed && styles.pressed, disabled && styles.disabled]}>
                  <Text allowFontScaling={false} style={styles.emoji}>{icon.emoji}</Text>
                  <Text style={[styles.label, selected && styles.selectedLabel]}>{icon.label}</Text>
                  {selected && <View style={styles.check} accessible={false}><Ionicons name="checkmark" size={10} color={COLORS.white} /></View>}
                </Pressable>;
              })}</View>
            </View>)}
          </View>
          {!resultCount && <View style={styles.empty}>
            <Ionicons name="search-outline" size={30} color={COLORS.textLight} accessible={false} />
            <Text style={styles.sectionTitle}>No food emojis found</Text>
            <Text style={[styles.caption, styles.emptyCopy]}>Try another food name or emoji.</Text>
            <GlassButton title="Clear search" onPress={clearSearch} style={styles.emptyAction} />
          </View>}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.32)" },
  sheet: { height: "88%", maxHeight: "100%", flexShrink: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", backgroundColor: COLORS.card },
  tallSheet: { height: "100%" },
  header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EAE2DB" },
  title: { ...TYPOGRAPHY.pageTitle, flex: 1, color: COLORS.text },
  close: { width: 48, height: 48 },
  headerSearch: { width: 44, minHeight: 44, justifyContent: "center", alignItems: "center" },
  pinnedControls: { paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  scrollingControls: { gap: 12 },
  categoryScroll: { flexGrow: 0, flexShrink: 0 },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 20 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingLeft: 14, paddingRight: 4, borderRadius: 16, backgroundColor: "#F6F1EC" },
  searchInput: { ...TYPOGRAPHY.input, color: COLORS.text, flex: 1, minWidth: 0, paddingVertical: 14, paddingHorizontal: 0 },
  clear: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  categories: { gap: 8 },
  category: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: "#E6DED5", backgroundColor: "#FFFCF8" },
  activeCategory: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryLabel: { ...TYPOGRAPHY.captionMedium, color: COLORS.text },
  activeCategoryLabel: { color: COLORS.white },
  sections: { gap: 24 },
  section: { gap: 12 },
  sectionTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.text },
  caption: { ...TYPOGRAPHY.caption, color: COLORS.textLight },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { minWidth: 52, minHeight: 84, paddingHorizontal: 4, paddingVertical: 12, justifyContent: "center", alignItems: "center", gap: 7, borderRadius: 16, borderWidth: 2, borderColor: "transparent", backgroundColor: "#F6F1EC" },
  selectedTile: { borderColor: COLORS.primary, backgroundColor: "#F0E3D6" },
  emoji: { fontSize: 28, textAlign: "center" },
  label: { ...TYPOGRAPHY.caption, alignSelf: "stretch", color: COLORS.text, textAlign: "center" },
  selectedLabel: { fontWeight: "600" },
  check: { position: "absolute", top: 3, right: 3, width: 15, height: 15, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary },
  pressed: { backgroundColor: "#EDE3DA" },
  disabled: { opacity: 0.5 },
  empty: { alignItems: "center", gap: 12, paddingVertical: 24 },
  emptyCopy: { textAlign: "center" },
  emptyAction: { alignSelf: "stretch" },
});
