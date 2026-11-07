// Starting goals from published guidelines, nothing invented in the app.
// Every number here traces to a source listed in docs/GOALS_METHOD.md.
// Survey state always stores kilograms and centimetres. Display units must never
// enter the recommendation calculation or apply a second conversion.

// Mifflin–St Jeor sex constants. "Prefer not to say" takes the midpoint of the two.
const SEX_CONSTANT = { male: 5, female: -161, na: -78 };
// Adult minimums from the 2013 AHA/ACC/TOS obesity guideline (1,200–1,500 women,
// 1,500–1,800 men). "Prefer not to say" takes the higher one, so nobody is sent too low.
export const CALORIE_FLOORS = { female: 1200, male: 1500, na: 1500 };
// Conventional Mifflin multipliers, split between a job base and a workout bonus
// so a desk worker who lifts and a builder who doesn't both land where they should.
export const WORK_FACTORS = { sedentary: 1.2, light: 1.35, moderate: 1.5, active: 1.7 };
export const WORKOUT_BONUS = { sedentary: 0, light: 0.05, moderate: 0.1, high: 0.15, very_high: 0.2 };
const MAX_ACTIVITY = 1.9;
// Fixed 500 kcal deficit (AHA/ACC/TOS); gain is a modest surplus of about 10%.
export const DEFICIT = 500;
const SURPLUS = { share: 0.1, min: 200, max: 350 };
// Protein in g per kg: 1.2–2.0 g/kg is the joint ACSM / Academy / Dietitians of
// Canada range for active people, higher when cutting, 1.6 once training 3+ days.
const PROTEIN_PER_KG = { maintain: [1.2, 1.6], lose: [1.6, 2.0], gain: [1.4, 1.8] };
const PROTEIN_RDA = 0.8; // g per kg of actual weight; never below this
const PROTEIN_MAX_SHARE = 0.35; // DRI acceptable range tops out at 35% of calories
const FAT_SHARE = 0.3; // DRI acceptable range 20–35%
const FAT_MIN_SHARE = 0.2;
export const CARBS_RDA = 130; // g per day
const HEALTHY_BMI = 25; // protein is scaled to a weight inside the healthy BMI range
const UNDERWEIGHT_BMI = 18.5; // WHO cut-off; no cut is suggested below it
export const ADULT_AGE = 18;

const round = (value, step) => Math.round(value / step) * step;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function surveyBmr({ weightKg, heightCm, age, sex }) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (SEX_CONSTANT[sex] ?? SEX_CONSTANT.na);
}

export function surveyActivityFactor({ workActivity, exerciseActivity }) {
  const base = WORK_FACTORS[workActivity] ?? WORK_FACTORS.sedentary;
  const bonus = WORKOUT_BONUS[exerciseActivity] ?? 0;
  return Math.min(MAX_ACTIVITY, Math.round((base + bonus) * 100) / 100);
}

// A chosen aim the suggestion can't follow becomes "maintain", with the reason:
// "minor" (under 18), "underweight" (BMI under 18.5) or "at-minimum" (needs
// already at the adult calorie minimum, so there is nothing to cut).
export function surveyGoals(input) {
  const { weightKg, heightCm, age, sex, workActivity, exerciseActivity, goal } = input;
  const bmr = surveyBmr(input);
  const activityFactor = surveyActivityFactor({ workActivity, exerciseActivity });
  const tdee = bmr * activityFactor;
  const floor = CALORIE_FLOORS[sex] ?? CALORIE_FLOORS.na;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  let aim = goal;
  let reason = null;
  if (age < ADULT_AGE) [aim, reason] = ["maintain", "minor"];
  else if (goal === "lose" && bmi < UNDERWEIGHT_BMI) [aim, reason] = ["maintain", "underweight"];
  else if (goal === "lose" && tdee <= floor) [aim, reason] = ["maintain", "at-minimum"];

  let calories = tdee;
  if (aim === "lose") calories = Math.max(floor, tdee - DEFICIT);
  if (aim === "gain") calories = tdee + clamp(tdee * SURPLUS.share, SURPLUS.min, SURPLUS.max);

  const trained = ["moderate", "high", "very_high"].includes(exerciseActivity);
  const proteinPerKg = PROTEIN_PER_KG[aim]?.[trained ? 1 : 0] ?? PROTEIN_PER_KG.maintain[0];
  const referenceKg = Math.min(weightKg, HEALTHY_BMI * heightM * heightM);
  const proteinFloor = PROTEIN_RDA * weightKg;
  const proteinWanted = Math.max(proteinFloor, proteinPerKg * referenceKg);
  let protein = Math.min(proteinWanted, (calories * PROTEIN_MAX_SHARE) / 4);

  let fat = (calories * FAT_SHARE) / 9;
  let carbs = (calories - protein * 4 - fat * 9) / 4;
  // Keep carbohydrate at its RDA: trim fat to 20%, then protein to its RDA,
  // then lift calories. Lifting only happens at the calorie minimum.
  if (carbs < CARBS_RDA) {
    fat = Math.max((calories * FAT_MIN_SHARE) / 9, (calories - protein * 4 - CARBS_RDA * 4) / 9);
    carbs = (calories - protein * 4 - fat * 9) / 4;
  }
  if (carbs < CARBS_RDA) {
    protein = Math.max(proteinFloor, (calories - fat * 9 - CARBS_RDA * 4) / 4);
    carbs = (calories - protein * 4 - fat * 9) / 4;
  }
  if (carbs < CARBS_RDA) {
    carbs = CARBS_RDA;
    calories = protein * 4 + fat * 9 + carbs * 4;
  }

  const calorieGoal = round(calories, 10);
  const tdeeRounded = round(tdee, 10);
  return {
    calorieGoal,
    proteinGoal: round(protein, 5),
    carbsGoal: round(carbs, 5),
    fatGoal: round(fat, 5),
    details: {
      bmr: Math.round(bmr),
      activityFactor,
      tdee: tdeeRounded,
      aim,
      reason,
      change: calorieGoal - tdeeRounded,
      atFloor: aim === "lose" && tdee - DEFICIT < floor,
      floor,
      proteinPerKg,
      proteinCapped: round(protein, 5) < round(proteinWanted, 5),
      referenceKg: Math.round(referenceKg),
      scaledToHealthyWeight: referenceKg < weightKg - 0.5,
    },
  };
}

// Done commits the visible wheel default even when no wheel movement occurred.
// Existing non-null values retain their precision; changing display units alone
// does not round or convert canonical state.
export function surveyPickerCommit(field, values) {
  const { pendingAge = 25, weightKg, weightUnit, heightCm, heightUnit, feet = 5, inches = 9 } = values;
  if (field === "age") return { age: Number(pendingAge) };
  if (field === "weight") return { weightKg: weightKg ?? (weightUnit === "kg" ? 70 : 154 / 2.20462) };
  if (field === "height") return { heightCm: heightCm ?? (heightUnit === "cm" ? 175 : (feet * 12 + inches) * 2.54) };
  return {};
}

// Only canonical inference inputs identify a recommendation; display-unit
// switches must preserve it, while changed details must require recalculation.
export function surveyInputSignature({ age, sex, weightKg, heightCm, workActivity, exerciseActivity, goal }) {
  return JSON.stringify([age, sex, weightKg, heightCm, workActivity, exerciseActivity, goal]);
}
