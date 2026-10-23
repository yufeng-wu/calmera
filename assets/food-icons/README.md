# Calmera food drawings

Original drawings made for Calmera (no third-party artwork, no attribution needed) for dishes Unicode has no emoji for. They are rendered beside Apple emoji, so they follow Apple's emoji rendering style.

After adding or editing a drawing, run `node scripts/generate-food-icon-art.mjs` and reference its file name as the `art` of a row in `lib/foodIcons.mjs`. `tests/food-icons.test.mjs` checks the generated module is current and that each drawing stays renderer-safe.


- 64×64 viewBox, subject fills ~58×52, centred, slight 3/4 top-down view like Apple's 🍚 🍲 🥗.
- Apple-emoji-like rendering: every shape shaded with a linear/radial gradient, light from upper left,
  small white specular highlights (stroke or ellipse, 35–85% opacity), darker crevices for depth.
  No outlines (a faint translucent edge on glass is fine), no text; at most a faint contact shadow.
- Saturated but natural food colours. Vary the vessel (white porcelain, celadon, clay, dark stone)
  so similar dishes don't share a silhouette; let the food, not the bowl, carry the shape.
- Silhouette first: the dish must be recognisable at 24–28 px. Avoid fine detail that turns to noise.
- react-native-svg compatible only: svg, g, defs, path, circle, ellipse, rect, linearGradient,
  radialGradient, stop, clipPath. Presentation attributes only (no <style>, no CSS classes, no filter,
  mask, pattern, image, text, use). Prefix every id with a short unique icon prefix (e.g. "tb-").
- Keep each file under ~4.5 KB (the test limit is 5,000 bytes); integers or one decimal place.
- Content should span about 58 of the 64 units in its larger dimension, centred (the committed files are normalised this way).
