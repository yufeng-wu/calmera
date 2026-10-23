// Ordered from named dishes to ingredients so a banana smoothie reads as a drink.
// Local presentation metadata only: meal records and model output stay unchanged.
// Rows are [id, emoji, label, aliases]. IDs are stored as saved choices, so never
// rename or remove one. Dishes Unicode has no emoji for use their nearest emoji.
const catalog = [
  ["baguette", "🥖", "Baguette", ["baguette", "baguettes", "banh mi", "bánh mì", "french bread", "法棍"]],
  ["sandwich", "🥪", "Sandwich", ["sandwich", "sandwiches", "panini", "sub", "hoagie", "三明治", "三文治"]],
  ["burger", "🍔", "Burger", ["burger", "burgers", "hamburger", "cheeseburger", "汉堡", "漢堡"]],
  ["pizza", "🍕", "Pizza", ["pizza", "pizzas", "披萨", "披薩"]],
  ["stuffed-flatbread", "🥙", "Pita wrap", ["shawarma", "gyro", "gyros", "doner", "döner", "kebab wrap", "souvlaki", "pita wrap", "falafel wrap", "沙威玛", "沙威瑪"]],
  ["falafel", "🧆", "Falafel", ["falafel", "falafels", "felafel"]],
  ["tamale", "🫔", "Tamale", ["tamale", "tamales", "tamal"]],
  ["taco", "🌮", "Taco", ["taco", "tacos", "quesadilla", "quesadillas", "墨西哥夹饼"]],
  ["burrito", "🌯", "Burrito", ["burrito", "burritos", "enchilada", "enchiladas", "wrap", "wraps", "墨西哥卷", "spring roll", "spring rolls", "egg roll", "egg rolls", "summer roll", "summer rolls", "fresh rolls", "lumpia", "cha gio", "chả giò", "goi cuon", "gỏi cuốn", "春卷", "春捲"]],
  ["hot-dog", "🌭", "Hot dog", ["hot dog", "hot dogs", "corn dog", "热狗", "熱狗"]],
  ["rice-ball", "🍙", "Rice ball", ["onigiri", "rice ball", "rice balls", "musubi", "spam musubi", "おにぎり", "饭团", "飯糰"]],
  ["bento", "🍱", "Bento", ["bento", "bento box", "弁当", "便当", "便當"]],
  ["tempura", "🍤", "Tempura", ["tempura", "fried shrimp", "ebi fry", "coconut shrimp", "天妇罗", "天婦羅"]],
  ["sushi", "🍣", "Sushi", ["sushi", "sashimi", "nigiri", "maki", "california roll", "寿司", "壽司", "刺身", "poke", "poké", "poke bowl", "kimbap", "gimbap", "김밥", "紫菜包饭", "紫菜包飯"]],
  ["dumplings", "🥟", "Dumplings", ["dumpling", "dumplings", "gyoza", "wonton", "wontons", "xiaolongbao", "xiao long bao", "soup dumplings", "potstickers", "shumai", "siu mai", "har gow", "dim sum", "mandu", "momo", "momos", "pierogi", "pierogies", "pelmeni", "empanada", "empanadas", "饺子", "餃子", "馄饨", "雲吞", "包子", "小笼包", "小籠包", "烧卖", "燒賣", "bao", "baos", "bao bun", "bao buns", "gua bao", "char siu bao", "steamed bun", "steamed buns", "pork belly bun", "刈包", "割包", "叉烧包", "叉燒包", "samosa", "samosas", "singara"]],
  ["oden", "🍢", "Skewers", ["oden", "skewer", "skewers", "kebab", "kebabs", "satay", "yakitori", "kabob", "串", "烤串", "关东煮", "關東煮", "tteokbokki", "ddeokbokki", "topokki", "tteok bokki", "떡볶이", "炒年糕", "辣炒年糕"]],
  ["fried-rice", "🍚", "Fried rice", ["fried rice", "nasi goreng", "炒饭", "炒飯"]],
  ["noodles", "🍜", "Noodles", ["noodle", "noodles", "ramen", "udon", "soba", "pho", "phở", "pad thai", "chow mein", "lo mein", "japchae", "laksa", "yakisoba", "dan dan", "拉面", "拉麵", "국수", "냉면", "米粉", "面条", "麵條", "炒面", "炒麵", "粉丝", "粉絲", "河粉"]],
  ["pasta", "🍝", "Pasta", ["pasta", "spaghetti", "lasagna", "lasagne", "macaroni", "ravioli", "penne", "fettuccine", "linguine", "gnocchi", "意面", "意大利面", "意大利麵"]],
  ["paella", "🥘", "Pan dish", ["paella", "shakshuka", "jambalaya", "frittata", "skillet", "海鲜饭", "海鮮飯"]],
  ["curry", "🍛", "Curry", ["curry", "curries", "tikka masala", "masala", "korma", "vindaloo", "butter chicken", "biryani", "dal", "dhal", "daal", "rendang", "massaman", "咖喱"]],
  ["salad", "🥗", "Salad", ["salad", "salads", "slaw", "coleslaw", "沙拉", "色拉"]],
  ["flatbread", "🫓", "Flatbread", ["naan", "roti", "chapati", "chapatti", "paratha", "pita", "arepa", "arepas", "injera", "lavash", "tortilla", "tortillas", "flatbread", "烙饼", "烙餅", "煎饼", "煎餅"]],
  ["fondue", "🫕", "Fondue", ["fondue"]],
  ["soup", "🍲", "Soup or stew", ["soup", "soups", "stew", "stews", "chowder", "hot pot", "hotpot", "jjigae", "찌개", "된장국", "미역국", "국밥", "congee", "jook", "tom yum", "gumbo", "chili con carne", "borscht", "火锅", "火鍋", "炖菜", "燉菜", "汤", "湯", "粥", "mapo tofu", "麻婆豆腐"]],
  ["bean-sprouts", "🌱", "Bean sprouts", ["bean sprout", "bean sprouts", "soybean sprouts", "mung bean sprouts", "kongnamul", "sukju", "콩나물", "숙주", "豆芽", "黄豆芽", "黃豆芽", "绿豆芽", "綠豆芽"]],
  ["kimchi", "🥬", "Kimchi", ["radish kimchi", "kkakdugi", "깍두기", "萝卜泡菜", "蘿蔔泡菜", "萝卜块泡菜", "kimchi", "kim chi", "김치", "韩国泡菜", "韓國泡菜", "辣白菜"]],
  ["pickles", "🥒", "Pickles", ["pickled", "pickle", "pickles", "giardiniera", "pickled vegetables", "danmuji", "泡菜", "酸菜", "腌菜", "醃菜"]],
  ["fries", "🍟", "Fries", ["french fries", "fries", "chips", "crisps", "potato chips", "tortilla chips", "pita chips", "nachos", "薯条", "薯條", "薯片"]],
  ["waffle", "🧇", "Waffle", ["waffle", "waffles", "华夫饼", "華夫餅"]],
  ["pancakes", "🥞", "Pancakes", ["pancake", "pancakes", "crepe", "crepes", "kimchi pancake", "scallion pancake", "pajeon", "jeon", "파전", "松饼", "鬆餅"]],
  ["cupcake", "🧁", "Cupcake", ["cupcake", "cupcakes", "muffin", "muffins", "纸杯蛋糕"]],
  ["cake", "🍰", "Cake", ["cake", "cakes", "cheesecake", "tiramisu", "poke cake", "蛋糕"]],
  ["mooncake", "🥮", "Mooncake", ["mooncake", "mooncakes", "月饼", "月餅"]],
  ["pie", "🥧", "Pie", ["pie", "pies", "tart", "tarts", "baklava", "strudel", "苹果派", "蘋果派", "蛋挞", "蛋撻"]],
  ["custard", "🍮", "Pudding or flan", ["flan", "custard", "pudding", "creme brulee", "crème brûlée", "panna cotta", "布丁"]],
  ["fortune-cookie", "🥠", "Fortune cookie", ["fortune cookie", "fortune cookies"]],
  ["cookie", "🍪", "Cookie", ["cookie", "cookies", "biscuit", "biscuits", "曲奇", "饼干", "餅乾"]],
  ["shaved-ice", "🍧", "Shaved ice", ["shaved ice", "bingsu", "patbingsu", "halo halo", "刨冰", "빙수"]],
  ["ice-cream", "🍨", "Ice cream", ["ice cream", "ice cream sandwich", "gelato", "sorbet", "冰淇淋", "冰激凌", "雪糕"]],
  ["dango", "🍡", "Mochi or dango", ["mochi", "dango", "daifuku", "tangyuan", "麻糬", "团子", "糰子", "汤圆", "湯圓", "大福"]],
  ["chocolate", "🍫", "Chocolate", ["chocolate", "巧克力"]],
  ["doughnut", "🍩", "Doughnut", ["donut", "donuts", "doughnut", "doughnuts", "甜甜圈"]],
  ["pretzel", "🥨", "Pretzel", ["pretzel", "pretzels", "椒盐卷饼"]],
  ["rice-cracker", "🍘", "Rice cake or cracker", ["rice cake", "rice cakes", "rice cracker", "rice crackers", "senbei", "米饼", "米餅", "仙贝", "仙貝"]],
  ["popcorn", "🍿", "Popcorn", ["popcorn", "爆米花"]],
  ["candy", "🍬", "Candy", ["candy", "candies", "sweets", "gummy", "gummies", "糖果"]],
  ["bar", "🥣", "Grain or protein bar", ["oat bar", "granola bar", "protein bar", "energy bar", "燕麦棒", "燕麥棒", "蛋白棒", "能量棒"]],
  ["bubble-tea", "🧋", "Bubble tea", ["bubble tea", "boba", "milk tea", "pearl milk tea", "珍珠奶茶", "奶茶"]],
  ["smoothie", "🥤", "Smoothie or shake", ["smoothie", "smoothies", "milkshake", "milkshakes", "protein shake", "shake", "果昔", "奶昔"]],
  ["juice", "🧃", "Juice", ["juice", "果汁"]],
  ["coffee", "☕", "Coffee", ["coffee", "espresso", "cappuccino", "latte", "americano", "mocha", "flat white", "cold brew", "咖啡", "拿铁", "拿鐵"]],
  ["tea", "🍵", "Tea", ["tea", "matcha", "matcha latte", "chai", "chai latte", "茶"]],
  ["mate", "🧉", "Mate", ["mate", "yerba mate"]],
  ["milk", "🥛", "Milk", ["milk", "kefir", "牛奶", "豆奶", "豆浆", "豆漿", "燕麦奶", "燕麥奶"]],
  ["water", "💧", "Water", ["water", "sparkling water", "矿泉水", "礦泉水", "白开水", "白開水", "饮用水", "飲用水"]],
  ["soda", "🥤", "Soft drink", ["soda", "cola", "lemonade", "soft drink", "kombucha", "dr pepper", "ginger ale", "ginger beer", "root beer", "可乐", "可樂", "汽水"]],
  ["beer", "🍺", "Beer", ["beer", "ale", "lager", "ipa", "啤酒"]],
  ["wine", "🍷", "Wine", ["wine", "葡萄酒", "红酒", "紅酒"]],
  ["champagne", "🥂", "Sparkling wine", ["champagne", "prosecco", "cava", "sparkling wine", "香槟", "香檳"]],
  ["cocktail", "🍸", "Cocktail", ["cocktail", "cocktails", "martini", "margarita", "mojito", "negroni", "鸡尾酒", "雞尾酒"]],
  ["spirits", "🥃", "Spirits", ["whiskey", "whisky", "bourbon", "rum", "vodka", "gin", "tequila", "baijiu", "soju", "白酒", "烧酒", "燒酒"]],
  ["sake", "🍶", "Sake", ["sake", "清酒", "米酒"]],
  ["oats", "🥣", "Oats or cereal", ["oat", "oats", "oatmeal", "porridge", "cereal", "granola", "muesli", "燕麦", "燕麥", "麦片", "麥片"]],
  ["yogurt", "🥣", "Yogurt", ["yogurt", "yoghurt", "skyr", "酸奶"]],
  ["bread", "🍞", "Bread", ["bread", "toast", "sourdough", "brioche", "soda bread", "面包", "麵包", "吐司", "馒头", "饅頭"]],
  ["croissant", "🥐", "Croissant", ["croissant", "croissants", "可颂", "可頌", "牛角包"]],
  ["bagel", "🥯", "Bagel", ["bagel", "bagels", "贝果", "貝果"]],
  ["rice", "🍚", "Rice", ["rice", "risotto", "pilaf", "pulao", "jollof", "米饭", "米飯", "糙米", "白米", "bibimbap", "dolsot", "비빔밥", "拌饭", "拌飯", "石锅拌饭", "石鍋拌飯"]],
  ["fried-egg", "🍳", "Cooked egg", ["fried egg", "fried eggs", "scrambled egg", "scrambled eggs", "sunny side up", "over easy", "huevos rancheros", "煎蛋", "炒蛋", "荷包蛋"]],
  ["egg", "🥚", "Egg", ["egg", "eggs", "omelet", "omelette", "tea egg", "tea eggs", "鸡蛋", "雞蛋", "蒸蛋"]],
  ["butter", "🧈", "Butter", ["butter", "ghee", "黄油", "黃油"]],
  ["cheese", "🧀", "Cheese", ["cheese", "cheddar", "mozzarella", "parmesan", "feta", "paneer", "halloumi", "cottage cheese", "奶酪", "芝士", "起司"]],
  ["tofu", "🫘", "Tofu", ["tofu", "tempeh", "豆腐", "豆干"]],
  ["peas", "🫛", "Peas or edamame", ["pea", "peas", "edamame", "snow peas", "snap peas", "sugar snap peas", "豌豆", "毛豆", "荷兰豆", "荷蘭豆"]],
  ["beans", "🫘", "Beans or lentils", ["bean", "beans", "lentil", "lentils", "chickpea", "chickpeas", "鹰嘴豆", "鷹嘴豆", "扁豆", "黑豆", "红豆", "紅豆"]],
  ["meat-on-bone", "🍖", "Ribs or roast", ["ribs", "spare ribs", "short ribs", "galbi", "kalbi", "char siu", "drumstick", "barbecue", "bbq", "排骨", "叉烧", "叉燒"]],
  ["chicken", "🍗", "Chicken", ["chicken", "turkey", "poultry", "duck", "鸡肉", "雞肉", "鸡胸", "雞胸", "鸡腿", "雞腿", "火鸡", "火雞", "鸭", "鴨"]],
  ["meat", "🥩", "Meat", ["beef", "steak", "pork", "lamb", "bulgogi", "brisket", "carne asada", "牛肉", "牛排", "猪肉", "豬肉", "羊肉"]],
  ["bacon", "🥓", "Bacon", ["bacon", "培根"]],
  ["squid", "🦑", "Squid", ["squid", "calamari", "octopus", "鱿鱼", "魷魚", "章鱼", "章魚"]],
  ["crab", "🦀", "Crab or lobster", ["crab", "crabs", "lobster", "crawfish", "crayfish", "螃蟹", "龙虾", "龍蝦"]],
  ["fish", "🐟", "Fish", ["fish", "salmon", "tuna", "cod", "trout", "tilapia", "mackerel", "sardine", "sardines", "ceviche", "三文鱼", "三文魚", "鲑鱼", "鮭魚", "金枪鱼", "鮪魚", "鳕鱼", "鱈魚", "鱼肉", "魚肉"]],
  ["shrimp", "🦐", "Shrimp", ["shrimp", "prawn", "prawns", "虾", "蝦"]],
  ["seafood", "🦪", "Shellfish", ["oyster", "oysters", "mussel", "mussels", "clam", "clams", "scallop", "scallops", "牡蛎", "牡蠣", "蛤蜊", "扇贝", "扇貝"]],
  ["banana", "🍌", "Banana", ["banana", "bananas", "plantain", "plantains", "香蕉"]],
  ["apple", "🍎", "Apple", ["apple", "apples", "苹果", "蘋果"]],
  ["orange", "🍊", "Orange", ["orange", "oranges", "mandarin", "clementine", "tangerine", "橙子", "橘子", "柑橘"]],
  ["berries", "🫐", "Berries", ["blueberry", "blueberries", "blackberry", "blackberries", "raspberry", "raspberries", "berries", "蓝莓", "藍莓", "树莓", "樹莓"]],
  ["strawberry", "🍓", "Strawberry", ["strawberry", "strawberries", "草莓"]],
  ["cherries", "🍒", "Cherries", ["cherry", "cherries", "樱桃", "櫻桃", "车厘子", "車厘子"]],
  ["grapes", "🍇", "Grapes", ["grape", "grapes", "raisin", "raisins", "葡萄"]],
  ["watermelon", "🍉", "Watermelon", ["watermelon", "西瓜"]],
  ["melon", "🍈", "Melon", ["melon", "cantaloupe", "honeydew", "哈密瓜", "甜瓜"]],
  ["pineapple", "🍍", "Pineapple", ["pineapple", "pineapples", "菠萝", "菠蘿", "凤梨", "鳳梨"]],
  ["mango", "🥭", "Mango", ["mango", "mangoes", "芒果"]],
  ["peach", "🍑", "Peach", ["peach", "peaches", "nectarine", "apricot", "桃子", "水蜜桃"]],
  ["pear", "🍐", "Pear", ["pear", "pears", "梨子", "雪梨"]],
  ["kiwi", "🥝", "Kiwi", ["kiwi", "kiwifruit", "猕猴桃", "獼猴桃", "奇异果", "奇異果"]],
  ["lemon", "🍋", "Lemon", ["lemon", "lemons", "lime", "limes", "柠檬", "檸檬"]],
  ["coconut", "🥥", "Coconut", ["coconut", "coconut water", "椰子", "椰汁"]],
  ["avocado", "🥑", "Avocado", ["avocado", "avocados", "guacamole", "牛油果", "鳄梨", "鱷梨"]],
  ["olive", "🫒", "Olives", ["olive", "olives", "橄榄", "橄欖"]],
  ["broccoli", "🥦", "Broccoli", ["broccoli", "西兰花", "西蘭花", "花椰菜"]],
  ["greens", "🥬", "Leafy greens", ["lettuce", "spinach", "kale", "cabbage", "bok choy", "choy sum", "gai lan", "生菜", "菠菜", "白菜", "青菜", "羽衣甘蓝", "羽衣甘藍"]],
  ["carrot", "🥕", "Carrot", ["carrot", "carrots", "胡萝卜", "胡蘿蔔"]],
  ["tomato", "🍅", "Tomato", ["tomato", "tomatoes", "番茄", "西红柿", "西紅柿"]],
  ["cucumber", "🥒", "Cucumber", ["cucumber", "cucumbers", "zucchini", "黄瓜", "黃瓜", "青瓜"]],
  ["eggplant", "🍆", "Eggplant", ["eggplant", "eggplants", "aubergine", "brinjal", "茄子"]],
  ["chili", "🌶️", "Chili pepper", ["pickled pepper", "pickled peppers", "pickled jalapenos", "pickled jalapeños", "pepperoncini", "chili", "chilli", "chilies", "chillies", "jalapeno", "jalapeño", "hot pepper", "hot peppers", "辣椒"]],
  ["bell-pepper", "🫑", "Bell pepper", ["peppers", "bell pepper", "bell peppers", "stuffed pepper", "stuffed peppers", "capsicum", "青椒", "彩椒"]],
  ["sweet-potato", "🍠", "Sweet potato", ["sweet potato", "sweet potatoes", "yam", "红薯", "紅薯", "地瓜", "紫薯"]],
  ["potato", "🥔", "Potato", ["potato", "potatoes", "hash browns", "土豆", "马铃薯", "馬鈴薯"]],
  ["corn", "🌽", "Corn", ["corn", "玉米"]],
  ["mushroom", "🍄", "Mushroom", ["mushroom", "mushrooms", "shiitake", "蘑菇", "香菇", "金针菇", "金針菇"]],
  ["onion", "🧅", "Onion", ["onion", "onions", "scallion", "scallions", "洋葱", "洋蔥"]],
  ["garlic", "🧄", "Garlic", ["garlic", "大蒜"]],
  ["ginger", "🫚", "Ginger", ["ginger", "生姜", "生薑"]],
  ["chestnut", "🌰", "Chestnut", ["chestnut", "chestnuts", "water chestnut", "water chestnuts", "栗子"]],
  ["nuts", "🥜", "Nuts", ["nut", "nuts", "almond", "almonds", "peanut", "peanuts", "walnut", "walnuts", "cashew", "cashews", "pistachio", "pistachios", "peanut butter", "坚果", "堅果", "杏仁", "花生", "核桃", "腰果"]],
  ["honey", "🍯", "Honey", ["honey", "蜂蜜"]],
  ["sauce", "🥣", "Sauce or dip", ["sauce", "dip", "dressing", "hummus", "salsa", "酱汁", "醬汁", "蘸酱", "蘸醬"]],
];
const fallback = Object.freeze({ id: "meal", emoji: "🥡", label: "Meal" });

export const FOOD_ICON_CATALOG = Object.freeze(catalog.map(([id, emoji, label, aliases]) => Object.freeze({
  id,
  emoji,
  label,
  aliases: Object.freeze(aliases),
})));

function normalize(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC")
    .toLowerCase()
    .replace(/[‐‑–—-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

// Chinese and Korean names run words together (김치찌개, 麻婆豆腐), so match inside them.
function matches(name, alias) {
  if (/[\p{Script=Han}\p{Script=Hangul}]/u.test(alias)) return name.includes(alias);
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(name);
}

/** A display hint, never a claim about ingredients or nutritional content. */
export function getFoodIcon(foodName) {
  const name = normalize(foodName);
  if (!name) return fallback;
  // The longest matching phrase wins, so "peanut butter" beats "butter" and
  // "kimchi fried rice" stays fried rice; otherwise the earlier row wins.
  let entry = null, best = 0;
  for (const item of FOOD_ICON_CATALOG) {
    for (const alias of item.aliases) {
      const words = alias.split(" ").length;
      if (words > best && matches(name, alias)) { entry = item; best = words; }
    }
  }
  if (!entry) return fallback;
  return { id: entry.id, emoji: entry.emoji, label: entry.label };
}

export function getFoodEmoji(foodName) {
  return getFoodIcon(foodName).emoji;
}
