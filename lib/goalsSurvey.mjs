// Survey state always stores kilograms and centimetres. Display units must never
// enter the recommendation calculation or apply a second conversion.
export function surveyBmr({ weightKg, heightCm, age, sex, bodyFat = null }) {
  if (bodyFat !== null) return 370 + 21.6 * weightKg * (1 - bodyFat / 100);
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

export function surveyGoals(input) {
  const { weightKg, bodyFat = null, workActivity, exerciseActivity, goal } = input;
  const factors = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725, active: 1.8, very_high: 1.9 };
  const activityFactor = ((factors[workActivity] ?? 1.2) + (factors[exerciseActivity] ?? 1.55)) / 2;
  let calorieGoal = surveyBmr(input) * activityFactor;
  if (goal === "lose") calorieGoal -= 250;
  if (goal === "gain") calorieGoal += 250;
  calorieGoal = Math.round(calorieGoal);
  const proteinGoal = Math.round(weightKg * (bodyFat !== null ? 2.2 : 2));
  const fatGoal = Math.round(weightKg * 0.8);
  const carbsGoal = Math.max(0, Math.round((calorieGoal - proteinGoal * 4 - fatGoal * 9) / 4));
  return { calorieGoal, proteinGoal, carbsGoal, fatGoal };
}

// Done commits the visible wheel default even when no wheel movement occurred.
// Existing non-null values retain their precision; changing display units alone
// does not round or convert canonical state.
export function surveyPickerCommit(field, values) {
  const { pendingAge = 25, weightKg, weightUnit, heightCm, heightUnit, bodyFat,
    feet = 5, inches = 9 } = values;
  if (field === "age") return { age: Number(pendingAge) };
  if (field === "weight") return { weightKg: weightKg ?? (weightUnit === "kg" ? 70 : 154 / 2.20462) };
  if (field === "height") return { heightCm: heightCm ?? (heightUnit === "cm" ? 175 : (feet * 12 + inches) * 2.54) };
  if (field === "bodyFat") return { bodyFat: bodyFat ?? 20 };
  return {};
}

// Only canonical inference inputs identify a recommendation; display-unit
// switches must preserve it, while changed details must require recalculation.
export function surveyInputSignature({ age, sex, weightKg, heightCm, bodyFat = null,
  workActivity, exerciseActivity, goal }) {
  return JSON.stringify([age, sex, weightKg, heightCm, bodyFat, workActivity, exerciseActivity, goal]);
}
