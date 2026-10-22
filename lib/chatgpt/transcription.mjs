// Pure orchestration: the native recognizer is injected for synthetic tests.
export async function transcribeLocalClip(speech, uri, language) {
  if (!speech || !speech.supportsOnDeviceRecognition()) throw new Error("on_device_voice_unavailable");
  if (typeof uri !== "string" || !uri.startsWith("file://")) throw new Error("invalid_voice_clip");
  const permissions = await speech.requestPermissionsAsync();
  if (!permissions.granted) throw new Error("voice_permission_required");
  return new Promise((resolve, reject) => {
    let transcript = "", finished = false;
    const subscriptions = [];
    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      subscriptions.forEach(item => item.remove());
      if (error) reject(new Error(error));
      else if (!transcript.trim()) reject(new Error("no_food_detected"));
      else resolve(transcript.trim());
    };
    const timeout = setTimeout(() => { speech.abort(); finish("voice_timeout"); }, 45000);
    subscriptions.push(speech.addListener("result", event => {
      if (typeof event.results?.[0]?.transcript === "string") transcript = event.results[0].transcript;
    }));
    subscriptions.push(speech.addListener("error", () => finish("on_device_voice_unavailable")));
    subscriptions.push(speech.addListener("end", () => finish()));
    try {
      speech.start({ lang: language, requiresOnDeviceRecognition: true, continuous: false,
        interimResults: false, recordingOptions: { persist: false }, audioSource: { uri } });
    } catch { finish("on_device_voice_unavailable"); }
  });
}
