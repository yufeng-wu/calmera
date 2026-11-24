// A refresh owns all of its reads, including when one fails before another.
export async function completeNutritionRefresh(requests) {
  const results = await Promise.allSettled(requests);
  const failure = results.find(result => result.status === "rejected");
  if (failure) throw failure.reason;
  return results.map(result => result.value);
}
