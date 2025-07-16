import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
  Platform,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import { styles as createStyles } from "@/assets/styles/create.styles";
import { useRouter } from "expo-router";
import { COLORS } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import { USERS_API_URL } from "@/constants/api";
import { useRefreshSignal } from "@/context/EntriesRefreshContext";
import PageLoader from "@/components/PageLoader";
import { Picker } from "@react-native-picker/picker";
import { Modal } from "react-native";

const windowWidth = Dimensions.get("window").width;

const FormRow = ({ label, children }) => (
  <View style={styles.formRow}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.controlContainer}>{children}</View>
  </View>
);

const Stepper = ({ value, onChange, min = 0, max = 999, step = 1 }) => (
  <View style={styles.stepperContainer}>
    <TouchableOpacity
      style={styles.stepperButton}
      onPress={() => onChange(Math.max(min, value - step))}
    >
      <Ionicons name="remove" size={20} color={COLORS.primary} />
    </TouchableOpacity>
    <Text style={styles.stepperValue}>{value}</Text>
    <TouchableOpacity
      style={styles.stepperButton}
      onPress={() => onChange(Math.min(max, value + step))}
    >
      <Ionicons name="add" size={20} color={COLORS.primary} />
    </TouchableOpacity>
  </View>
);

const SegmentedControl = ({
  options,
  selectedValue,
  onValueChange,
  style,
  buttonStyle,
  horizontalScroll = false,
}) => {
  if (horizontalScroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.segmentRow,
          style,
          { flexWrap: "nowrap" },
        ]}
      >
        {options.map(({ label, value }) => (
          <TouchableOpacity
            key={value}
            style={[
              styles.segmentButton,
              buttonStyle,
              styles.segmentButtonScroll,
              selectedValue === value && styles.segmentButtonActive,
            ]}
            onPress={() => onValueChange(value)}
          >
            <Text
              style={[
                styles.segmentText,
                selectedValue === value && styles.segmentTextActive,
                label === "Prefer not to say" && { fontSize: 10 },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }
  return (
    <View style={[styles.segmentRow, style]}>
      {options.map(({ label, value }) => (
        <TouchableOpacity
          key={value}
          style={[
            styles.segmentButton,
            buttonStyle,
            selectedValue === value && styles.segmentButtonActive,
          ]}
          onPress={() => onValueChange(value)}
        >
          <Text
            style={[
              styles.segmentText,
              selectedValue === value && styles.segmentTextActive,
              label === "Prefer not to say" && { fontSize: 11 },
            ]}
          >
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// Helper: VerticalPicker component
const VerticalPicker = ({
  visible,
  value,
  onChange,
  items,
  onClose,
  label,
}) => {
  const [tempValue, setTempValue] = useState(value);

  // Reset temp value when picker opens
  React.useEffect(() => {
    if (visible) {
      setTempValue(value);
    }
  }, [visible, value]);

  const handleDone = () => {
    if (onChange) onChange(tempValue);
    if (onClose) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.3)",
        }}
      >
        <SlideUpModalWrapper>
          <View
            style={{
              backgroundColor: COLORS.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <Text
                style={{ fontSize: 18, fontWeight: "600", color: COLORS.text }}
              >
                {label}
              </Text>
              <TouchableOpacity onPress={handleDone}>
                <Text
                  style={{
                    color: COLORS.primary,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  Done
                </Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={tempValue}
              onValueChange={(v) => setTempValue(v)}
              itemStyle={{ fontSize: 22, height: 180 }}
            >
              {items.map((item) => (
                <Picker.Item key={item} label={String(item)} value={item} />
              ))}
            </Picker>
          </View>
        </SlideUpModalWrapper>
      </View>
    </Modal>
  );
};

// Slide-up wrapper for modal content
const SlideUpModalWrapper = ({ children }) => {
  // Slide the modal content up from the bottom while keeping the modal background fade handled by <Modal animationType="fade">.
  const slideAnim = React.useRef(new Animated.Value(300)).current; // start just below the screen

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    // Reset position for the next time the modal is opened
    return () => {
      slideAnim.setValue(300);
    };
  }, [slideAnim]);

  return (
    <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
      {children}
    </Animated.View>
  );
};

export default function GoalsSurvey() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { setShouldRefreshGoals } = useRefreshSignal();

  // Ref to allow programmatic scrolling
  const scrollViewRef = React.useRef(null);

  // State
  const [age, setAge] = useState(null);
  const [sex, setSex] = useState(null);
  // Optional body fat percentage (null when not provided)
  const [bodyFat, setBodyFat] = useState(null);

  // Recommendation result
  const [recommendation, setRecommendation] = useState(null);
  const [weightKg, setWeightKg] = useState(null);
  const [weightUnit, setWeightUnit] = useState("kg");
  const [heightCm, setHeightCm] = useState(null);
  const [heightUnit, setHeightUnit] = useState("cm");
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(false);

  // Scroll to bottom when recommendation card appears
  React.useEffect(() => {
    if (recommendation && scrollViewRef.current) {
      // slight delay to ensure layout is complete
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [recommendation]);

  // Picker modal state
  const [picker, setPicker] = useState({ field: null, visible: false });

  // Numeric value arrays (with 1 decimal)
  // Age 15 - 100
  const ageItems = Array.from({ length: 86 }, (_, i) => i + 15);

  // Body fat percentage 5% - 50%
  const bodyFatItems = Array.from({ length: 46 }, (_, i) => 5 + i);
  const weightKgItems = Array.from({ length: 1710 }, (_, i) =>
    (30 + i * 0.1).toFixed(1)
  );
  const weightLbsItems = Array.from({ length: 820 }, (_, i) =>
    (66 + i * 0.1).toFixed(1)
  );

  // Integer parts for dual-column selectors
  const weightKgIntItems = Array.from({ length: 171 }, (_, i) => 30 + i);
  const weightLbsIntItems = Array.from({ length: 285 }, (_, i) => 66 + i);
  const heightCmIntItems = Array.from({ length: 131 }, (_, i) => 120 + i);
  const heightCmItems = Array.from({ length: 1301 }, (_, i) =>
    (120 + i * 0.1).toFixed(1)
  );
  const heightFtItems = Array.from({ length: 5 }, (_, i) => 4 + i);
  const heightInItems = Array.from({ length: 12 }, (_, i) => i);

  // Conversion utils
  const toLbs = (kg) => Math.round(kg * 2.20462);
  const toKg = (lbs) => lbs / 2.20462;
  const cmToFeetIn = (cm) => {
    const totalInches = cm / 2.54;
    return {
      ft: Math.floor(totalInches / 12),
      in: Math.round(totalInches % 12),
    };
  };
  const feetInToCm = (ft, inch) => (ft * 12 + (inch || 0)) * 2.54;

  const currentWeight = weightUnit === "kg" ? weightKg : toLbs(weightKg);
  const { ft: currentFt, in: currentIn } = cmToFeetIn(
    heightCm !== null ? heightCm : 175
  );

  const setHeightFromFt = (ft) => setHeightCm(feetInToCm(ft, currentIn));
  const setHeightFromIn = (inch) => setHeightCm(feetInToCm(currentFt, inch));

  const sexOptions = [
    { label: "Female", value: "female" },
    { label: "Male", value: "male" },
    { label: "Prefer not to say", value: "na" },
  ];

  const activityOptions = [
    { label: "Sedentary", value: "sedentary" },
    { label: "Light", value: "light" },
    { label: "Moderate", value: "moderate" },
    { label: "High", value: "high" },
  ];

  const goalOptions = [
    { label: "Lose", value: "lose" },
    { label: "Maintain", value: "maintain" },
    { label: "Gain", value: "gain" },
  ];

  // Expanded activity levels
  const workActivityOptions = [
    {
      label: "Sedentary",
      value: "sedentary",
      desc: "Desk job, mostly sitting",
      example: "e.g. Office worker, programmer, driver",
    },
    {
      label: "Light",
      value: "light",
      desc: "Mostly standing, light movement",
      example: "e.g. Teacher, cashier, retail",
    },
    {
      label: "Moderate",
      value: "moderate",
      desc: "On feet, walking often",
      example: "e.g. Nurse, waiter, delivery",
    },
    {
      label: "Active",
      value: "active",
      desc: "Physically demanding work",
      example: "e.g. Construction, mover, athlete",
    },
  ];
  const exerciseActivityOptions = [
    { label: "0", value: "sedentary" },
    { label: "1-2", value: "light" },
    { label: "3-4", value: "moderate" },
    { label: "5-6", value: "high" },
    { label: "7+", value: "very_high" },
  ];
  const [workActivity, setWorkActivity] = useState(null);
  const [exerciseActivity, setExerciseActivity] = useState(null);

  // Goal helper text
  const goalHelper = {
    lose: "Aim for fat loss through a slight calorie deficit",
    maintain: "Keep current weight and body composition",
    gain: "Build muscle or increase body mass with a surplus",
  };

  const handleSubmit = () => {
    if (
      !age ||
      !weightKg ||
      !heightCm ||
      !sex ||
      !workActivity ||
      !exerciseActivity ||
      !goal
    ) {
      return Alert.alert(
        "Missing Info",
        "Please complete all the required fields."
      );
    }

    // Convert units
    const wKg = weightUnit === "kg" ? weightKg : toKg(weightKg);
    const hCm = heightCm;

    // Calculate BMR
    let bmr;
    if (bodyFat !== null) {
      const leanMass = wKg * (1 - bodyFat / 100);
      bmr = 370 + 21.6 * leanMass; // Katch-McArdle
    } else {
      if (sex === "male") {
        bmr = 10 * wKg + 6.25 * hCm - 5 * age + 5; // Mifflin-St Jeor male
      } else {
        bmr = 10 * wKg + 6.25 * hCm - 5 * age - 161; // female / other
      }
    }

    // Activity factor
    const factorMap = {
      sedentary: 1.2,
      light: 1.375,
      // Updated to the evidence-based PAL for a moderately active lifestyle
      moderate: 1.55, // was 1.46
      high: 1.725,
      // Work-specific option (physically demanding job)
      active: 1.8,
      very_high: 1.9,
    };
    // Combine work-related and exercise-related activity multipliers.
    const workFactor = factorMap[workActivity] ?? 1.2;
    const exerciseFactor = factorMap[exerciseActivity] ?? 1.55;
    // Simple heuristic: use the mean of both factors to estimate overall PAL.
    const activityFactor = (workFactor + exerciseFactor) / 2;
    const tdee = bmr * activityFactor;

    // Adjust for goal
    let calorieGoal = tdee;
    if (goal === "lose") calorieGoal -= 500;
    if (goal === "gain") calorieGoal += 250;
    calorieGoal = Math.round(calorieGoal);

    // Macro breakdown
    const proteinGoal = Math.round(wKg * (bodyFat !== null ? 2.2 : 2)); // g
    const fatGoal = Math.round(wKg * 0.8); // g
    const remainingCals = calorieGoal - proteinGoal * 4 - fatGoal * 9;
    const carbsGoal = Math.max(0, Math.round(remainingCals / 4));

    setRecommendation({
      calorieGoal,
      proteinGoal,
      carbsGoal,
      fatGoal,
    });
  };

  const handleSaveMacros = async () => {
    if (!recommendation) return;
    // Show global loader while we save the macros
    setLoading(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${USERS_API_URL}/update-user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          calorieGoal: recommendation.calorieGoal,
          proteinGoal: recommendation.proteinGoal,
          carbsGoal: recommendation.carbsGoal,
          fatGoal: recommendation.fatGoal,
          localDate: new Date().toLocaleDateString("en-CA"),
        }),
      });
      if (!resp.ok) throw new Error("Failed to update goals");
      setShouldRefreshGoals(true);
      setLoading(false);
      Alert.alert("Success", "Macro goals updated successfully.", [
        {
          text: "OK",
          onPress: () => router.replace("/(tabs)/settings"),
        },
      ]);
    } catch (err) {
      setLoading(false);
      Alert.alert("Error", err.message);
    }
  };

  // Numeric field display helpers
  const displayAge = age !== null ? Number(age).toString() : "Required";
  const displayWeight =
    weightKg !== null
      ? weightUnit === "kg"
        ? Number(weightKg).toFixed(1)
        : Number(toLbs(weightKg)).toFixed(1)
      : "Required";
  const displayHeight =
    heightCm !== null
      ? heightUnit === "cm"
        ? `${Number(heightCm).toFixed(1)} cm`
        : `${currentFt} ft ${Math.round(currentIn)} in`
      : "Required";

  if (loading) {
    return <PageLoader />;
  }

  return (
    <View style={styles.container}>
      <View style={createStyles.header}>
        <TouchableOpacity
          style={createStyles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={createStyles.headerTitle}>Macro Goal Survey</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.formContainer}
      >
        {/* Age */}
        <FormRow label="Age">
          <TouchableOpacity
            style={styles.pickerField}
            onPress={() => setPicker({ field: "age", visible: true })}
          >
            <Text style={styles.pickerValue}>
              {displayAge === "Required" ? "Required" : `${displayAge} yrs`}
            </Text>
          </TouchableOpacity>
        </FormRow>
        {/* Weight */}
        <FormRow label="Weight">
          <View style={styles.weightRow}>
            <TouchableOpacity
              style={styles.pickerField}
              onPress={() => setPicker({ field: "weight", visible: true })}
            >
              <Text style={styles.pickerValue}>
                {displayWeight === "Required"
                  ? "Required"
                  : `${displayWeight} ${weightUnit}`}
              </Text>
            </TouchableOpacity>
            <SegmentedControl
              options={[
                { label: "kg", value: "kg" },
                { label: "lbs", value: "lbs" },
              ]}
              selectedValue={weightUnit}
              onValueChange={setWeightUnit}
              style={styles.weightUnitSegment}
              buttonStyle={styles.weightUnitButton}
            />
          </View>
        </FormRow>
        {/* Height */}
        <FormRow label="Height">
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              style={styles.pickerField}
              onPress={() => setPicker({ field: "height", visible: true })}
            >
              <Text style={styles.pickerValue}>
                {displayHeight === "Required" ? "Required" : displayHeight}
              </Text>
            </TouchableOpacity>
            <SegmentedControl
              options={[
                { label: "cm", value: "cm" },
                { label: "ft/in", value: "ft" },
              ]}
              selectedValue={heightUnit}
              onValueChange={setHeightUnit}
              style={styles.heightUnitSegment}
              buttonStyle={styles.heightUnitButton}
            />
          </View>
        </FormRow>
        {/* Body Fat % (optional) */}
        <FormRow label="Body Fat">
          <TouchableOpacity
            style={styles.pickerField}
            onPress={() => setPicker({ field: "bodyFat", visible: true })}
          >
            <Text style={styles.pickerValue}>
              {bodyFat !== null ? `${bodyFat} %` : "Optional"}
            </Text>
          </TouchableOpacity>
        </FormRow>
        {/* Sex */}
        <FormRow label="Sex">
          <SegmentedControl
            options={sexOptions}
            selectedValue={sex}
            onValueChange={setSex}
          />
        </FormRow>
        {/* Work Activity Level */}
        <View style={styles.columnFormRow}>
          <Text style={[styles.label, { marginBottom: 12 }]}>
            How active are you at your job?
          </Text>
          <SegmentedControl
            options={workActivityOptions.map((o) => ({
              label: o.label,
              value: o.value,
            }))}
            selectedValue={workActivity}
            onValueChange={setWorkActivity}
          />
          {workActivity && (
            <Text style={styles.helperText}>
              {workActivityOptions.find((o) => o.value === workActivity)?.desc}
            </Text>
          )}
          {workActivity &&
            workActivityOptions.find((o) => o.value === workActivity)
              ?.example && (
              <Text style={styles.exampleText}>
                {
                  workActivityOptions.find((o) => o.value === workActivity)
                    ?.example
                }
              </Text>
            )}
        </View>
        {/* Exercise Activity Level */}
        <View style={styles.columnFormRow}>
          <Text style={[styles.label, { marginBottom: 12 }]}>
            How many times do you usually exercise per week?
          </Text>
          <SegmentedControl
            options={exerciseActivityOptions.map((o) => ({
              label: o.label,
              value: o.value,
            }))}
            selectedValue={exerciseActivity}
            onValueChange={setExerciseActivity}
          />
          {/* No description for numeric exercise selection */}
        </View>
        {/* Goal */}
        <View style={styles.columnFormRow}>
          <Text style={[styles.label, { marginBottom: 12 }]}>
            What is your goal?
          </Text>
          <SegmentedControl
            options={goalOptions}
            selectedValue={goal}
            onValueChange={setGoal}
          />
          {goal && <Text style={styles.helperText}>{goalHelper[goal]}</Text>}
        </View>
        {/* Get Recommendation Button */}
        <View style={{ marginTop: 32, marginBottom: 32 }}>
          <TouchableOpacity
            style={createStyles.estimateButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={createStyles.estimateButtonText}>
              {loading ? "Please wait..." : "Get Recommendation"}
            </Text>
            {!loading && (
              <Ionicons name="bulb-outline" size={18} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>

        {recommendation && (
          <View style={styles.recommendBox}>
            <Text style={styles.recommendTitle}>Recommended Macros</Text>
            <Text style={styles.recommendText}>
              Calories: {recommendation.calorieGoal} kcal
            </Text>
            <Text style={styles.recommendText}>
              Protein: {recommendation.proteinGoal} g
            </Text>
            <Text style={styles.recommendText}>
              Carbs: {recommendation.carbsGoal} g
            </Text>
            <Text style={styles.recommendText}>
              Fat: {recommendation.fatGoal} g
            </Text>

            <TouchableOpacity
              style={[createStyles.estimateButton, { marginTop: 16 }]}
              onPress={handleSaveMacros}
              disabled={loading}
            >
              <Text style={createStyles.estimateButtonText}>
                {loading ? "Saving..." : "Save and Update Macro Goals"}
              </Text>
            </TouchableOpacity>

            {/* Updated explanation text */}
            <Text
              style={[styles.methodText, { textAlign: "left", marginTop: 18 }]}
            >
              Based on the Mifflin-St Jeor formula (or Katch-McArdle if you
              provide body fat %), your Basal Metabolic Rate (BMR, the calories
              your body burns at rest) is{" "}
              <Text style={{ fontWeight: "600" }}>
                {Math.round(
                  bodyFat !== null
                    ? 370 +
                        21.6 *
                          (weightUnit === "kg"
                            ? weightKg
                            : toKg(weightKg) * (1 - bodyFat / 100))
                    : sex === "male"
                    ? 10 * (weightUnit === "kg" ? weightKg : toKg(weightKg)) +
                      6.25 * heightCm -
                      5 * age +
                      5
                    : 10 * (weightUnit === "kg" ? weightKg : toKg(weightKg)) +
                      6.25 * heightCm -
                      5 * age -
                      161
                )}
              </Text>{" "}
              kcal/day.
            </Text>
            <Text style={[styles.methodText, { textAlign: "left" }]}>
              Factoring in your activity levels, your estimated Total Daily
              Energy Expenditure (TDEE) is{" "}
              <Text style={{ fontWeight: "600" }}>
                {recommendation.calorieGoal +
                  (goal === "lose" ? 500 : goal === "gain" ? -250 : 0)}
              </Text>{" "}
              kcal/day.
            </Text>
            <Text style={[styles.methodText, { textAlign: "left" }]}>
              Based on your goal of{" "}
              <Text style={{ fontWeight: "bold" }}>
                {goalOptions.find((g) => g.value === goal)?.label}
              </Text>
              , a{" "}
              {goal === "lose"
                ? "calorie deficit of 500 kcal/day"
                : goal === "gain"
                ? "calorie surplus of 250 kcal/day"
                : "maintenance (no deficit or surplus)"}{" "}
              is reasonable, so we recommend{" "}
              <Text style={{ fontWeight: "600" }}>
                {recommendation.calorieGoal}
              </Text>{" "}
              kcal/day.
            </Text>
            <Text style={styles.disclaimerText}>
              Disclaimer: These numbers are only estimates. For the most
              accurate assessment of your nutritional needs, please consult a
              qualified health professional or use clinical measurement methods.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Pickers */}
      <VerticalPicker
        visible={picker.visible && picker.field === "age"}
        value={age !== null ? age : 25}
        onChange={(v) => {
          setAge(Number(v));
        }}
        items={ageItems}
        onClose={() => setPicker({ field: null, visible: false })}
        label="Select Age"
      />
      {/* Weight dual-column picker */}
      <Modal
        visible={picker.visible && picker.field === "weight"}
        transparent
        animationType="fade"
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        >
          <SlideUpModalWrapper>
            <View
              style={{
                backgroundColor: COLORS.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: COLORS.text,
                  }}
                >
                  Weight ({weightUnit})
                </Text>
                <TouchableOpacity
                  onPress={() => setPicker({ field: null, visible: false })}
                >
                  <Text
                    style={{
                      color: COLORS.primary,
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    Done
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Picker
                    selectedValue={Math.floor(
                      Number(
                        displayWeight !== "Required"
                          ? displayWeight
                          : weightUnit === "kg"
                          ? 70
                          : 154
                      )
                    )}
                    onValueChange={(v) => {
                      const decimal = Math.round(
                        (Number(
                          displayWeight !== "Required"
                            ? displayWeight
                            : weightUnit === "kg"
                            ? 70
                            : 154
                        ) *
                          10) %
                          10
                      );
                      const newDisplay = Number(`${v}.${decimal}`);
                      if (weightUnit === "kg") setWeightKg(newDisplay);
                      else setWeightKg(toKg(newDisplay));
                    }}
                    itemStyle={{ fontSize: 22, height: 180 }}
                  >
                    {(weightUnit === "kg"
                      ? weightKgIntItems
                      : weightLbsIntItems
                    ).map((intVal) => (
                      <Picker.Item
                        key={intVal}
                        label={String(intVal)}
                        value={intVal}
                      />
                    ))}
                  </Picker>
                </View>

                <View style={{ paddingHorizontal: 4 }}>
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: "600",
                      color: COLORS.text,
                    }}
                  >
                    .
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Picker
                    selectedValue={Math.round(
                      (Number(
                        displayWeight !== "Required"
                          ? displayWeight
                          : weightUnit === "kg"
                          ? 70
                          : 154
                      ) *
                        10) %
                        10
                    )}
                    onValueChange={(v) => {
                      const integer = Math.floor(
                        Number(
                          displayWeight !== "Required"
                            ? displayWeight
                            : weightUnit === "kg"
                            ? 70
                            : 154
                        )
                      );
                      const newDisplay = Number(`${integer}.${v}`);
                      if (weightUnit === "kg") setWeightKg(newDisplay);
                      else setWeightKg(toKg(newDisplay));
                    }}
                    itemStyle={{ fontSize: 22, height: 180 }}
                  >
                    {Array.from({ length: 10 }, (_, i) => i).map((d) => (
                      <Picker.Item key={d} label={String(d)} value={d} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
          </SlideUpModalWrapper>
        </View>
      </Modal>
      {/* Height cm dual-column picker */}
      <Modal
        visible={
          picker.visible && picker.field === "height" && heightUnit === "cm"
        }
        transparent
        animationType="fade"
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        >
          <SlideUpModalWrapper>
            <View
              style={{
                backgroundColor: COLORS.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: COLORS.text,
                  }}
                >
                  Select Height (cm)
                </Text>
                <TouchableOpacity
                  onPress={() => setPicker({ field: null, visible: false })}
                >
                  <Text
                    style={{
                      color: COLORS.primary,
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    Done
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Picker
                    selectedValue={Math.floor(
                      heightCm !== null ? heightCm : 175
                    )}
                    onValueChange={(v) => {
                      const decimal = Math.round(
                        ((heightCm !== null ? heightCm : 175) * 10) % 10
                      );
                      setHeightCm(Number(`${v}.${decimal}`));
                    }}
                    itemStyle={{ fontSize: 22, height: 180 }}
                  >
                    {heightCmIntItems.map((intVal) => (
                      <Picker.Item
                        key={intVal}
                        label={String(intVal)}
                        value={intVal}
                      />
                    ))}
                  </Picker>
                </View>

                <View style={{ paddingHorizontal: 4 }}>
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: "600",
                      color: COLORS.text,
                    }}
                  >
                    .
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Picker
                    selectedValue={Math.round(
                      ((heightCm !== null ? heightCm : 175) * 10) % 10
                    )}
                    onValueChange={(v) => {
                      const integer = Math.floor(
                        heightCm !== null ? heightCm : 175
                      );
                      setHeightCm(Number(`${integer}.${v}`));
                    }}
                    itemStyle={{ fontSize: 22, height: 180 }}
                  >
                    {Array.from({ length: 10 }, (_, i) => i).map((d) => (
                      <Picker.Item key={d} label={String(d)} value={d} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
          </SlideUpModalWrapper>
        </View>
      </Modal>

      {/* Body Fat % dual-column picker */}
      <Modal
        visible={picker.visible && picker.field === "bodyFat"}
        transparent
        animationType="fade"
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        >
          <SlideUpModalWrapper>
            <View
              style={{
                backgroundColor: COLORS.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    setBodyFat(null);
                    setPicker({ field: null, visible: false });
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.destructive ?? "red",
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    Clear
                  </Text>
                </TouchableOpacity>

                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: COLORS.text,
                  }}
                >
                  Body Fat %
                </Text>

                <TouchableOpacity
                  onPress={() => setPicker({ field: null, visible: false })}
                >
                  <Text
                    style={{
                      color: COLORS.primary,
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    Done
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Picker
                    selectedValue={bodyFat !== null ? Math.floor(bodyFat) : 20}
                    onValueChange={(v) => {
                      const decimal =
                        bodyFat !== null ? (bodyFat * 10) % 10 : 0;
                      setBodyFat(Number(`${v}.${decimal}`));
                    }}
                    itemStyle={{ fontSize: 22, height: 180 }}
                  >
                    {Array.from({ length: 46 }, (_, i) => 5 + i).map(
                      (intVal) => (
                        <Picker.Item
                          key={intVal}
                          label={String(intVal)}
                          value={intVal}
                        />
                      )
                    )}
                  </Picker>
                </View>

                {/* Dot separator */}
                <View style={{ paddingHorizontal: 4 }}>
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: "600",
                      color: COLORS.text,
                    }}
                  >
                    .
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Picker
                    selectedValue={
                      bodyFat !== null ? Math.round((bodyFat * 10) % 10) : 0
                    }
                    onValueChange={(v) => {
                      const integer =
                        bodyFat !== null ? Math.floor(bodyFat) : 20;
                      setBodyFat(Number(`${integer}.${v}`));
                    }}
                    itemStyle={{ fontSize: 22, height: 180 }}
                  >
                    {Array.from({ length: 10 }, (_, i) => i).map((dec) => (
                      <Picker.Item key={dec} label={String(dec)} value={dec} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
          </SlideUpModalWrapper>
        </View>
      </Modal>
      {/* Height ft/in pickers */}
      <Modal
        visible={
          picker.visible && picker.field === "height" && heightUnit === "ft"
        }
        transparent
        animationType="fade"
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        >
          <SlideUpModalWrapper>
            <View
              style={{
                backgroundColor: COLORS.card,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: COLORS.text,
                  }}
                >
                  Select Height
                </Text>
                <TouchableOpacity
                  onPress={() => setPicker({ field: null, visible: false })}
                >
                  <Text
                    style={{
                      color: COLORS.primary,
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "600",
                      marginBottom: 8,
                      color: COLORS.text,
                    }}
                  >
                    Feet
                  </Text>
                  <Picker
                    selectedValue={currentFt}
                    onValueChange={(v) => setHeightFromFt(Number(v))}
                    itemStyle={{ fontSize: 22, height: 180 }}
                  >
                    {heightFtItems.map((item) => (
                      <Picker.Item
                        key={item}
                        label={String(item)}
                        value={item}
                      />
                    ))}
                  </Picker>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "600",
                      marginBottom: 8,
                      color: COLORS.text,
                    }}
                  >
                    Inches
                  </Text>
                  <Picker
                    selectedValue={Math.round(currentIn)}
                    onValueChange={(v) => setHeightFromIn(Number(v))}
                    itemStyle={{ fontSize: 22, height: 180 }}
                  >
                    {heightInItems.map((item) => (
                      <Picker.Item
                        key={item}
                        label={String(item)}
                        value={item}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
          </SlideUpModalWrapper>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  formContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100, // Space for footer
    paddingTop: 8,
  },
  formRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    gap: 8,
  },
  columnFormRow: {
    paddingVertical: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text,
    flexShrink: 0,
    marginRight: 4,
    minWidth: 48,
  },
  controlContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
    minWidth: 36,
    textAlign: "center",
  },
  segmentRow: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 2,
    marginTop: 0,
    flex: 1,
    minWidth: 0,
    gap: 0,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderRadius: 16,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonScroll: {
    minWidth: 90,
    flex: 0,
  },
  segmentButtonActive: {
    backgroundColor: COLORS.primary,
  },
  segmentText: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text,
  },
  segmentTextActive: {
    color: COLORS.white,
  },
  weightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  weightUnitSegment: {
    flex: 0,
    marginLeft: 8,
    minWidth: 0,
    width: 100,
  },
  weightUnitButton: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
  },
  imperialHeightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
    paddingRight: 8,
  },
  heightUnitSegment: {
    flex: 0,
    marginLeft: 8,
    minWidth: 0,
    width: 100,
  },
  heightUnitButton: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
  },
  unitLabel: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: "500",
    marginLeft: -4,
    marginRight: 8,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: "center",
    marginTop: 12,
  },
  exampleText: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: "center",
    marginTop: 2,
    fontStyle: "italic",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  pickerField: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 0,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 80,
    marginRight: 0,
  },
  pickerValue: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  recommendBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recommendTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
    textAlign: "center",
  },
  recommendText: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
    textAlign: "center",
  },
  methodText: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 12,
  },
});
