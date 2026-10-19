// Ordered from named dishes to ingredients so a banana smoothie reads as a drink.
// Local presentation metadata only: meal records and model output stay unchanged.
const catalog = [
  ["sandwich", "🥪", "Sandwich", ["sandwich", "sandwiches", "panini", "三明治", "三文治"]],
  ["burger", "🍔", "Burger", ["burger", "burgers", "hamburger", "cheeseburger", "汉堡", "漢堡"]],
  ["pizza", "🍕", "Pizza", ["pizza", "pizzas", "披萨", "披薩"]],
  ["taco", "🌮", "Taco", ["taco", "tacos", "墨西哥夹饼"]],
  ["burrito", "🌯", "Burrito", ["burrito", "burritos", "wrap", "wraps", "墨西哥卷"]],
  ["hot-dog", "🌭", "Hot dog", ["hot dog", "hot dogs", "热狗", "熱狗"]],
  ["sushi", "🍣", "Sushi", ["sushi", "sashimi", "寿司", "壽司", "刺身"]],
  ["dumplings", "🥟", "Dumplings", ["dumpling", "dumplings", "gyoza", "wonton", "wontons", "饺子", "餃子", "馄饨", "雲吞", "包子", "小笼包"]],
  ["fried-rice", "🍚", "Fried rice", ["fried rice", "炒饭", "炒飯"]],
  ["noodles", "🍜", "Noodles", ["noodle", "noodles", "ramen", "udon", "pho", "chow mein", "拉面", "拉麵", "米粉", "面条", "麵條", "炒面", "炒麵", "粉丝", "粉絲"]],
  ["pasta", "🍝", "Pasta", ["pasta", "spaghetti", "lasagna", "lasagne", "macaroni", "ravioli", "意面", "意大利面", "意大利麵"]],
  ["curry", "🍛", "Curry", ["curry", "curries", "咖喱"]],
  ["salad", "🥗", "Salad", ["salad", "salads", "沙拉", "色拉"]],
  ["soup", "🍲", "Soup or stew", ["soup", "soups", "stew", "stews", "chowder", "hot pot", "hotpot", "火锅", "火鍋", "炖菜", "燉菜", "汤", "湯", "粥"]],
  ["fries", "🍟", "Fries", ["french fries", "fries", "薯条", "薯條"]],
  ["pancakes", "🥞", "Pancakes", ["pancake", "pancakes", "waffle", "waffles", "松饼", "鬆餅", "华夫饼", "華夫餅"]],
  ["cake", "🍰", "Cake", ["cake", "cakes", "cheesecake", "cupcake", "cupcakes", "蛋糕"]],
  ["pie", "🥧", "Pie", ["pie", "pies", "tart", "tarts", "苹果派", "蘋果派", "蛋挞", "蛋撻"]],
  ["cookie", "🍪", "Cookie", ["cookie", "cookies", "biscuit", "biscuits", "曲奇", "饼干", "餅乾"]],
  ["ice-cream", "🍨", "Ice cream", ["ice cream", "gelato", "sorbet", "冰淇淋", "冰激凌", "雪糕"]],
  ["chocolate", "🍫", "Chocolate", ["chocolate", "巧克力"]],
  ["doughnut", "🍩", "Doughnut", ["donut", "donuts", "doughnut", "doughnuts", "甜甜圈"]],
  ["bar", "🥣", "Grain or protein bar", ["oat bar", "granola bar", "protein bar", "energy bar", "燕麦棒", "燕麥棒", "蛋白棒", "能量棒"]],
  ["smoothie", "🥤", "Smoothie or shake", ["smoothie", "smoothies", "milkshake", "milkshakes", "protein shake", "果昔", "奶昔"]],
  ["juice", "🧃", "Juice", ["juice", "果汁"]],
  ["coffee", "☕", "Coffee", ["coffee", "espresso", "cappuccino", "latte", "americano", "mocha", "咖啡", "拿铁", "拿鐵"]],
  ["tea", "🍵", "Tea", ["tea", "matcha", "boba", "茶"]],
  ["milk", "🥛", "Milk", ["milk", "牛奶", "豆奶", "豆浆", "豆漿", "燕麦奶", "燕麥奶"]],
  ["water", "💧", "Water", ["water", "矿泉水", "礦泉水", "白开水", "白開水", "饮用水", "飲用水"]],
  ["soda", "🥤", "Soft drink", ["soda", "cola", "lemonade", "soft drink", "可乐", "可樂", "汽水"]],
  ["beer", "🍺", "Beer", ["beer", "ale", "lager", "啤酒"]],
  ["wine", "🍷", "Wine", ["wine", "葡萄酒", "红酒", "紅酒"]],
  ["oats", "🥣", "Oats or cereal", ["oat", "oats", "oatmeal", "porridge", "cereal", "granola", "燕麦", "燕麥", "麦片", "麥片"]],
  ["yogurt", "🥣", "Yogurt", ["yogurt", "yoghurt", "酸奶"]],
  ["bread", "🍞", "Bread", ["bread", "toast", "sourdough", "baguette", "面包", "麵包", "吐司", "馒头", "饅頭"]],
  ["croissant", "🥐", "Croissant", ["croissant", "croissants", "可颂", "可頌", "牛角包"]],
  ["bagel", "🥯", "Bagel", ["bagel", "bagels", "贝果", "貝果"]],
  ["rice", "🍚", "Rice", ["rice", "risotto", "米饭", "米飯", "糙米", "白米"]],
  ["egg", "🥚", "Egg", ["egg", "eggs", "omelet", "omelette", "鸡蛋", "雞蛋", "煎蛋", "炒蛋", "蒸蛋"]],
  ["cheese", "🧀", "Cheese", ["cheese", "cheddar", "mozzarella", "parmesan", "奶酪", "芝士", "起司"]],
  ["tofu", "🫘", "Tofu", ["tofu", "tempeh", "豆腐", "豆干"]],
  ["beans", "🫘", "Beans or lentils", ["bean", "beans", "lentil", "lentils", "chickpea", "chickpeas", "edamame", "鹰嘴豆", "鷹嘴豆", "扁豆", "毛豆", "黑豆", "红豆", "紅豆"]],
  ["chicken", "🍗", "Chicken", ["chicken", "turkey", "poultry", "鸡肉", "雞肉", "鸡胸", "雞胸", "鸡腿", "雞腿", "火鸡", "火雞"]],
  ["meat", "🥩", "Meat", ["beef", "steak", "pork", "lamb", "ribs", "牛肉", "牛排", "猪肉", "豬肉", "羊肉", "排骨"]],
  ["bacon", "🥓", "Bacon", ["bacon", "培根"]],
  ["fish", "🐟", "Fish", ["fish", "salmon", "tuna", "cod", "trout", "tilapia", "三文鱼", "三文魚", "鲑鱼", "鮭魚", "金枪鱼", "鮪魚", "鳕鱼", "鱈魚", "鱼肉", "魚肉"]],
  ["shrimp", "🦐", "Shrimp", ["shrimp", "prawn", "prawns", "虾", "蝦"]],
  ["seafood", "🦪", "Shellfish", ["oyster", "oysters", "mussel", "mussels", "clam", "clams", "scallop", "scallops", "牡蛎", "牡蠣", "蛤蜊", "扇贝", "扇貝"]],
  ["banana", "🍌", "Banana", ["banana", "bananas", "香蕉"]],
  ["apple", "🍎", "Apple", ["apple", "apples", "苹果", "蘋果"]],
  ["orange", "🍊", "Orange", ["orange", "oranges", "mandarin", "clementine", "橙子", "橘子", "柑橘"]],
  ["berries", "🫐", "Berries", ["blueberry", "blueberries", "blackberry", "blackberries", "raspberry", "raspberries", "蓝莓", "藍莓", "树莓", "樹莓"]],
  ["strawberry", "🍓", "Strawberry", ["strawberry", "strawberries", "草莓"]],
  ["grapes", "🍇", "Grapes", ["grape", "grapes", "葡萄"]],
  ["watermelon", "🍉", "Watermelon", ["watermelon", "西瓜"]],
  ["pineapple", "🍍", "Pineapple", ["pineapple", "pineapples", "菠萝", "菠蘿", "凤梨", "鳳梨"]],
  ["mango", "🥭", "Mango", ["mango", "mangoes", "芒果"]],
  ["peach", "🍑", "Peach", ["peach", "peaches", "桃子", "水蜜桃"]],
  ["pear", "🍐", "Pear", ["pear", "pears", "梨子", "雪梨"]],
  ["kiwi", "🥝", "Kiwi", ["kiwi", "kiwifruit", "猕猴桃", "獼猴桃", "奇异果", "奇異果"]],
  ["lemon", "🍋", "Lemon", ["lemon", "lemons", "柠檬", "檸檬"]],
  ["avocado", "🥑", "Avocado", ["avocado", "avocados", "牛油果", "鳄梨", "鱷梨"]],
  ["broccoli", "🥦", "Broccoli", ["broccoli", "西兰花", "西蘭花", "花椰菜"]],
  ["greens", "🥬", "Leafy greens", ["lettuce", "spinach", "kale", "cabbage", "bok choy", "生菜", "菠菜", "白菜", "青菜", "羽衣甘蓝", "羽衣甘藍"]],
  ["carrot", "🥕", "Carrot", ["carrot", "carrots", "胡萝卜", "胡蘿蔔"]],
  ["tomato", "🍅", "Tomato", ["tomato", "tomatoes", "番茄", "西红柿", "西紅柿"]],
  ["cucumber", "🥒", "Cucumber", ["cucumber", "cucumbers", "pickle", "pickles", "黄瓜", "黃瓜", "青瓜"]],
  ["sweet-potato", "🍠", "Sweet potato", ["sweet potato", "sweet potatoes", "红薯", "紅薯", "地瓜", "紫薯"]],
  ["potato", "🥔", "Potato", ["potato", "potatoes", "土豆", "马铃薯", "馬鈴薯"]],
  ["corn", "🌽", "Corn", ["corn", "玉米"]],
  ["mushroom", "🍄", "Mushroom", ["mushroom", "mushrooms", "蘑菇", "香菇", "金针菇", "金針菇"]],
  ["nuts", "🥜", "Nuts", ["nut", "nuts", "almond", "almonds", "peanut", "peanuts", "walnut", "walnuts", "cashew", "cashews", "坚果", "堅果", "杏仁", "花生", "核桃", "腰果"]],
  ["sauce", "🥣", "Sauce or dip", ["sauce", "dip", "dressing", "hummus", "酱汁", "醬汁", "蘸酱", "蘸醬"]],
];

const fallback = Object.freeze({ id: "meal", emoji: "🍽️", label: "Meal" });

export const FOOD_ICON_CATALOG = Object.freeze(catalog.map(([id, emoji, label, aliases]) => Object.freeze({
  id,
  emoji,
  label,
  aliases: Object.freeze(aliases),
})));

function normalize(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC")
    .replace(/\s*[-–—]\s*calmera\s+(?:(?:phone|photo|voice)\s+)*test\b.*$/iu, "")
    .toLowerCase()
    .replace(/[‐‑–—-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function matches(name, alias) {
  if (/\p{Script=Han}/u.test(alias)) return name.includes(alias);
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(name);
}

/** A display hint, never a claim about ingredients or nutritional content. */
export function getFoodIcon(foodName) {
  const name = normalize(foodName);
  if (!name) return fallback;
  const entry = FOOD_ICON_CATALOG.find((item) => item.aliases.some((alias) => matches(name, alias)));
  if (!entry) return fallback;
  return { id: entry.id, emoji: entry.emoji, label: entry.label };
}

export function getFoodEmoji(foodName) {
  return getFoodIcon(foodName).emoji;
}
