// A believable week shown until the person has three logged days of their own.
import { localDateKey, normalizeDay } from "../nutritionStore.mjs";

const MENU = [
  [["Breakfast", "08:10", "Greek yogurt with berries", 220, 18, 26, 5], ["Lunch", "12:40", "Chicken rice bowl", 640, 38, 78, 16], ["Snack", "15:30", "Milk tea with boba", 340, 4, 62, 8], ["Dinner", "19:20", "Salmon with broccoli", 520, 36, 22, 30]],
  [["Lunch", "13:05", "Beef noodle soup", 690, 32, 86, 20], ["Snack", "16:00", "Chocolate cookie", 210, 3, 28, 10], ["Dinner", "20:10", "Pepperoni pizza", 820, 30, 88, 36], ["Snack", "22:15", "Ice cream", 270, 4, 30, 14]],
  [["Breakfast", "08:30", "Oatmeal with banana", 310, 9, 58, 6], ["Lunch", "12:30", "Turkey sandwich", 480, 30, 50, 15], ["Dinner", "19:00", "Tofu stir fry with rice", 590, 24, 74, 20]],
  [["Breakfast", "09:00", "Egg and avocado toast", 380, 16, 30, 22], ["Lunch", "12:50", "Chicken rice bowl", 640, 38, 78, 16], ["Snack", "15:45", "Iced latte", 190, 9, 18, 8], ["Dinner", "19:40", "Shrimp tacos", 560, 30, 52, 24]],
  [["Lunch", "13:20", "Burger and fries", 980, 34, 92, 50], ["Snack", "17:00", "Bubble tea", 360, 3, 66, 9], ["Dinner", "21:45", "Instant ramen", 480, 10, 64, 20]],
  [["Breakfast", "10:30", "Pancakes", 520, 10, 82, 16], ["Lunch", "14:00", "Sushi rolls", 620, 24, 96, 12], ["Dinner", "20:30", "Pepperoni pizza", 820, 30, 88, 36], ["Snack", "22:30", "Chocolate", 230, 3, 26, 13]],
  [["Breakfast", "08:15", "Greek yogurt with berries", 220, 18, 26, 5], ["Lunch", "12:45", "Chicken salad", 450, 36, 20, 24], ["Dinner", "19:10", "Beef and broccoli with rice", 640, 34, 70, 20]],
];

export function sampleDays(today = new Date()) {
  const days = {};
  MENU.forEach((meals, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - index);
    const key = localDateKey(date);
    days[key] = normalizeDay({ foodEntries: meals.map(([mealType, localTime, foodName, calories, protein, carbs, fat], position) => ({
      id: index * 10 + position, mealType, localTime, foodName, calories, protein, carbs, fat,
    })) });
  });
  return days;
}

export const SAMPLE_GOALS = { calorieGoal: 2000, proteinGoal: 120, carbsGoal: 230, fatGoal: 65 };
