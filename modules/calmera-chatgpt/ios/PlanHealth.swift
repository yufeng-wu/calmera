import Foundation
import HealthKit

// Read-only Apple Health summary for Insights. Returns per-day totals (-1 for
// no data) and a small profile; raw samples never leave this file.
final class PlanHealth {
  private let store = HKHealthStore()
  private let calendar = Calendar.current

  private var quantityTypes: [String: (HKQuantityTypeIdentifier, HKUnit, HKStatisticsOptions)] {
    [
      "activeEnergy": (.activeEnergyBurned, .kilocalorie(), .cumulativeSum),
      "steps": (.stepCount, .count(), .cumulativeSum),
      "weight": (.bodyMass, .gramUnit(with: .kilo), .discreteAverage),
    ]
  }
  private var readTypes: Set<HKObjectType> {
    var types = Set<HKObjectType>(quantityTypes.values.compactMap { HKObjectType.quantityType(forIdentifier: $0.0) })
    if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
    types.insert(HKObjectType.workoutType())
    types.insert(HKObjectType.characteristicType(forIdentifier: .dateOfBirth)!)
    types.insert(HKObjectType.characteristicType(forIdentifier: .biologicalSex)!)
    return types
  }
  private var writeTypes: Set<HKSampleType> {
    #if targetEnvironment(simulator)
    var types = Set<HKSampleType>(quantityTypes.values.compactMap { HKObjectType.quantityType(forIdentifier: $0.0) })
    if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
    types.insert(HKObjectType.workoutType())
    return types
    #else
    return []
    #endif
  }

  var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

  func requestAccess() async throws -> Bool {
    guard isAvailable else { return false }
    try await store.requestAuthorization(toShare: writeTypes, read: readTypes)
    return true
  }

  func summary(days: Int) async throws -> [String: Any] {
    guard isAvailable else { return ["available": false] }
    let span = max(1, min(days, 120))
    let end = calendar.startOfDay(for: Date()).addingTimeInterval(86400)
    let start = calendar.date(byAdding: .day, value: -span, to: end)!
    var series: [String: [Double?]] = [:]
    for (key, (identifier, unit, option)) in quantityTypes {
      series[key] = try await daily(identifier, unit: unit, option: option, start: start, end: end, span: span)
    }
    series["sleepHours"] = try await sleep(start: start, end: end, span: span)
    series["exerciseMinutes"] = try await workoutMinutes(start: start, end: end, span: span)
    var profile: [String: Any] = [:]
    if let birth = try? store.dateOfBirthComponents(), let date = calendar.date(from: birth) {
      profile["age"] = calendar.dateComponents([.year], from: date, to: Date()).year
    }
    if let sex = try? store.biologicalSex().biologicalSex {
      profile["sex"] = sex == .female ? "female" : sex == .male ? "male" : nil
    }
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    let dates = (0..<span).map { formatter.string(from: calendar.date(byAdding: .day, value: $0, to: start)!) }
    return ["available": true, "dates": dates, "series": series.mapValues { $0.map { $0 ?? -1 } }, "profile": profile]
  }

  private func daily(_ identifier: HKQuantityTypeIdentifier, unit: HKUnit, option: HKStatisticsOptions,
                     start: Date, end: Date, span: Int) async throws -> [Double?] {
    guard let type = HKQuantityType.quantityType(forIdentifier: identifier) else { return Array(repeating: nil, count: span) }
    return try await withCheckedThrowingContinuation { continuation in
      let query = HKStatisticsCollectionQuery(quantityType: type,
        quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end),
        options: option, anchorDate: start, intervalComponents: DateComponents(day: 1))
      query.initialResultsHandler = { _, collection, error in
        if let error = error as? HKError, error.code == .errorNoData {
          continuation.resume(returning: Array(repeating: nil, count: span)); return
        }
        if let error { continuation.resume(throwing: error); return }
        var values = [Double?](repeating: nil, count: span)
        collection?.enumerateStatistics(from: start, to: end.addingTimeInterval(-1)) { stats, _ in
          let index = self.calendar.dateComponents([.day], from: start, to: stats.startDate).day ?? -1
          guard values.indices.contains(index) else { return }
          let quantity = option == .cumulativeSum ? stats.sumQuantity() : stats.averageQuantity()
          values[index] = quantity?.doubleValue(for: unit)
        }
        continuation.resume(returning: values)
      }
      store.execute(query)
    }
  }

  // Sleep is attributed to the day it ends on (the morning after).
  private func sleep(start: Date, end: Date, span: Int) async throws -> [Double?] {
    guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return Array(repeating: nil, count: span) }
    let samples: [HKCategorySample] = try await withCheckedThrowingContinuation { continuation in
      let query = HKSampleQuery(sampleType: type, predicate: HKQuery.predicateForSamples(withStart: start.addingTimeInterval(-43200), end: end),
        limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, results, error in
        if let error { continuation.resume(throwing: error); return }
        continuation.resume(returning: (results as? [HKCategorySample]) ?? [])
      }
      store.execute(query)
    }
    // Raw values cover iOS 15: 1 asleep/unspecified, 3 core, 4 deep, 5 REM.
    let asleep: Set<Int> = [1, 3, 4, 5]
    var values = [Double?](repeating: nil, count: span)
    for sample in samples where asleep.contains(sample.value) {
      let index = calendar.dateComponents([.day], from: start, to: calendar.startOfDay(for: sample.endDate)).day ?? -1
      guard values.indices.contains(index) else { continue }
      values[index] = (values[index] ?? 0) + sample.endDate.timeIntervalSince(sample.startDate) / 3600
    }
    return values
  }

  // Workout minutes per day; works with or without an Apple Watch.
  private func workoutMinutes(start: Date, end: Date, span: Int) async throws -> [Double?] {
    let samples: [HKWorkout] = try await withCheckedThrowingContinuation { continuation in
      let query = HKSampleQuery(sampleType: .workoutType(), predicate: HKQuery.predicateForSamples(withStart: start, end: end),
        limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, results, error in
        if let error { continuation.resume(throwing: error); return }
        continuation.resume(returning: (results as? [HKWorkout]) ?? [])
      }
      store.execute(query)
    }
    var values = [Double?](repeating: nil, count: span)
    for workout in samples {
      let index = calendar.dateComponents([.day], from: start, to: calendar.startOfDay(for: workout.startDate)).day ?? -1
      guard values.indices.contains(index) else { continue }
      values[index] = (values[index] ?? 0) + workout.duration / 60
    }
    return values
  }

  // Simulator only: writes a believable 60 days so the Activity rows have data.
  func seedSample() async throws -> Int {
    #if targetEnvironment(simulator)
    var samples: [HKSample] = []
    let today = calendar.startOfDay(for: Date())
    for offset in 0..<60 {
      let day = calendar.date(byAdding: .day, value: -offset, to: today)!
      let weekday = calendar.component(.weekday, from: day)
      let workout = [2, 4, 6].contains(weekday)
      let wave = sin(Double(offset) / 3.0)
      func add(_ id: HKQuantityTypeIdentifier, _ unit: HKUnit, _ value: Double, hour: Int, minutes: Int = 60) {
        guard let type = HKQuantityType.quantityType(forIdentifier: id) else { return }
        let start = day.addingTimeInterval(Double(hour) * 3600)
        samples.append(HKQuantitySample(type: type, quantity: HKQuantity(unit: unit, doubleValue: value),
          start: start, end: start.addingTimeInterval(Double(minutes) * 60)))
      }
      add(.stepCount, .count(), (workout ? 9800 : 6200) + wave * 1400, hour: 12, minutes: 480)
      add(.activeEnergyBurned, .kilocalorie(), (workout ? 640 : 380) + wave * 60, hour: 12, minutes: 480)
      if workout {
        let start = day.addingTimeInterval(18 * 3600)
        samples.append(HKWorkout(activityType: weekday == 4 ? .running : .traditionalStrengthTraining,
          start: start, end: start.addingTimeInterval((48 + wave * 8) * 60)))
      }
      if offset % 3 == 0 { add(.bodyMass, .gramUnit(with: .kilo), 72.4 - Double(60 - offset) * 0.012, hour: 7, minutes: 1) }
      if let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
        let hours = 7.0 + wave * 0.7 - (weekday == 7 || weekday == 1 ? -0.4 : 0.3)
        let wake = day.addingTimeInterval(7 * 3600)
        samples.append(HKCategorySample(type: sleepType, value: 1,
          start: wake.addingTimeInterval(-hours * 3600), end: wake))
      }
    }
    try await store.save(samples)
    return samples.count
    #else
    return 0
    #endif
  }
}
