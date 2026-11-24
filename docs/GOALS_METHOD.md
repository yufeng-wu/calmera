# How the goals survey suggests numbers

The survey (`app/src/app/(root)/goals-survey.jsx`, maths in `app/src/lib/goals/goalsSurvey.mjs`) turns seven answers into starting goals. It gives general wellness information, not a prescription: every number comes from a published guideline, the user can change all of them, and the screen says so. This file is the record of where each number comes from, so a change to the maths comes with a change here.

## Questions

Age, height, weight, sex (female, male or prefer not to say), activity at work, workouts a week and aim (lose, stay the same, build muscle). Body fat was dropped in November 2026: self-reported values are too noisy to improve the estimate and had made protein targets worse.

## Steps

1. **Calories at rest.** Mifflin–St Jeor: `10 × kg + 6.25 × cm − 5 × age + s`, with `s` = +5 (male), −161 (female) or −78 (prefer not to say, the midpoint). It is the most accurate of the common equations for healthy adults (Frankenfield et al., *J Am Diet Assoc* 2005).
2. **Daily needs.** Rest × activity factor. The factor is a job base (sitting 1.2, standing 1.35, walking 1.5, heavy work 1.7) plus a workout bonus (0, 0.05, 0.1, 0.15, 0.2 for 0, 1–2, 3–4, 5–6, 7+ a week), capped at 1.9. These are the conventional Mifflin multipliers (1.2–1.9) split in two, so a desk worker who lifts and a builder who doesn't both land where they should. The split is Calmera's reading of the convention, not a published table, and the screen calls it an estimate.
3. **Aim.** Lose: 500 kcal under daily needs, never below 1,200 kcal (female) or 1,500 kcal (male or prefer not to say). Both numbers are the 2013 AHA/ACC/TOS obesity guideline's prescription (a 500–750 kcal deficit, or 1,200–1,500 kcal/day for women and 1,500–1,800 for men). Build muscle: about 10% over daily needs, between 200 and 350 kcal. Stay the same: daily needs.
4. **No cut when it isn't appropriate.** Under 18, with a BMI under 18.5 (WHO underweight cut-off), or when daily needs are already at the minimum, the suggestion is maintenance and the screen explains why.
5. **Protein.** Grams per kg from the joint position of the Academy of Nutrition and Dietetics, Dietitians of Canada and ACSM (2016): 1.2–2.0 g/kg for active people, towards the top when cutting. Calmera uses 1.2 (stay the same), 1.6 (lose) or 1.4 (build muscle), each +0.4 with three or more workouts a week, so 1.6 g/kg (the point where Morton et al., *Br J Sports Med* 2018, found gains level off) is reached by anyone training. The kilograms are the person's weight capped at a BMI of 25, so a 120 kg person is not sent 240 g a day. The result is never below the RDA of 0.8 g/kg of actual weight and never above 35% of calories, the top of the Dietary Reference Intake range.
6. **Fat.** 30% of calories, inside the DRI acceptable range of 20–35%.
7. **Carbohydrate.** What is left, never under the RDA of 130 g. If that would be breached, fat drops towards 20%, then protein towards its RDA, and only then do calories rise. That happens at the calorie minimum for very small people.
8. **Rounding.** Calories to 10, grams to 5, after every check.

## Sources

- Mifflin MD et al. A new predictive equation for resting energy expenditure in healthy individuals. *Am J Clin Nutr* 1990. Frankenfield D et al. Comparison of predictive equations for resting metabolic rate. *J Am Diet Assoc* 2005. https://pubmed.ncbi.nlm.nih.gov/15883556/
- Jensen MD et al. 2013 AHA/ACC/TOS Guideline for the Management of Overweight and Obesity in Adults. *Circulation* 2014. https://www.ahajournals.org/doi/10.1161/01.cir.0000437739.71477.ee
- Thomas DT, Erdman KA, Burke LM. Position of the Academy of Nutrition and Dietetics, Dietitians of Canada, and the American College of Sports Medicine: Nutrition and Athletic Performance. *J Acad Nutr Diet* 2016. https://pubmed.ncbi.nlm.nih.gov/26917108/
- Morton RW et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength. *Br J Sports Med* 2018. https://bjsm.bmj.com/content/52/6/376
- Jäger R et al. International Society of Sports Nutrition position stand: protein and exercise. *J Int Soc Sports Nutr* 2017. https://pubmed.ncbi.nlm.nih.gov/28642676/
- Institute of Medicine. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. National Academies Press, 2005. https://nap.nationalacademies.org/catalog/10490
- World Health Organization. A healthy lifestyle – WHO recommendations (BMI classification). https://www.who.int/europe/news-room/fact-sheets/item/a-healthy-lifestyle---who-recommendations

## What the screen says

- Lead: a starting point, changeable anytime.
- Under the numbers, one sentence: "Suggested based on Mifflin–St Jeor: about N kcal at rest × F for activity ≈ T kcal a day, minus 500 kcal to lose weight." The ending changes with the aim rule that applied. Protein, fat and carbs aren't explained on screen; this file is the record.
- A standing note under the button: a starting point only, not dietary or medical advice; Calmera isn't a medical service; talk to a doctor or registered dietitian before changing how you eat.
