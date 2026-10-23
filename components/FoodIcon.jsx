import { memo } from "react";
import { Text } from "react-native";
import { SvgAst, parse } from "react-native-svg";
import { FOOD_ICON_ART } from "@/lib/foodIconArt.mjs";

// Apple emoji leave padding inside the glyph box; drawings fill theirs, so they
// are scaled to the same visual size as an emoji at `size` points.
export const ART_SCALE = 1.12;

// Parse each drawing once per app run rather than on every mount in long lists.
const parsed = new Map();
const artFor = key => {
  if (!key || !FOOD_ICON_ART[key]) return null;
  if (!parsed.has(key)) {
    try { parsed.set(key, parse(FOOD_ICON_ART[key])); } catch { parsed.set(key, null); }
  }
  return parsed.get(key);
};

/** Decorative food picture: a drawing when one exists, otherwise the emoji. */
function FoodIcon({ icon, size }) {
  const ast = artFor(icon?.art);
  if (ast) {
    const side = Math.round(size * ART_SCALE);
    return <SvgAst ast={ast} override={{ width: side, height: side, accessible: false }} />;
  }
  return <Text allowFontScaling={false} accessible={false} style={{ fontSize: size, textAlign: "center" }}>{icon?.emoji}</Text>;
}

export default memo(FoodIcon, (a, b) => a.size === b.size && a.icon?.art === b.icon?.art && a.icon?.emoji === b.icon?.emoji);
