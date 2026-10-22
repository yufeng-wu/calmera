import { Image } from "expo-image";

export const OPENAI_BLOSSOM_SYMBOL = "openai.blossom";

// Keep the official artwork monochrome and decorative; the surrounding row or
// button already supplies its accessible ChatGPT label. Never apply tintColor.
export default function OpenAILogo() {
  return <Image source={require("../assets/brand/openai-blossom-black.png")}
    style={{ width: 20, height: 20 }} contentFit="contain" pointerEvents="none"
    accessible={false} accessibilityElementsHidden importantForAccessibility="no" />;
}
