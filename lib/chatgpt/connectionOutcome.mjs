// Authorization/credential presence is independent from optional model and
// welcome details. A later read failure must not undo a confirmed connection.
export async function readChatGPTConnection(client, {
  authorize = false, knownConnected = false, readWelcome = false,
  isCurrent = () => true, onConnection = () => {},
} = {}) {
  if (!isCurrent()) return null;
  const connected = knownConnected || (authorize ? (await client.connect(), true) : Boolean(await client.connected()));
  if (!isCurrent()) return null;
  onConnection(connected);
  if (!isCurrent()) return null;
  if (!connected) return { connected: false, choices: [], selected: "", detailsError: false, welcomed: null };

  let choices = [], selected = "", detailsError = false, welcomed = null;
  try {
    const catalog = await client.models();
    if (!isCurrent()) return null;
    const storedModel = await client.getSelectedModel();
    if (!isCurrent()) return null;
    if (!Array.isArray(catalog)) throw new Error("invalid_model_catalog");
    choices = catalog;
    selected = choices.find(item => item.slug === storedModel)?.slug || choices[0]?.slug || "";
  } catch {
    if (!isCurrent()) return null;
    // Do not present an assumed choice when either model read failed.
    detailsError = true;
  }
  if (readWelcome) {
    try { welcomed = Boolean(await client.hasWelcomed()); }
    catch { /* A failed optional welcome read does not affect the connection. */ }
  }
  if (!isCurrent()) return null;
  return { connected: true, choices, selected, detailsError, welcomed };
}
