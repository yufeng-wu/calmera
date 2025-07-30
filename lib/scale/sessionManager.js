// sessionManager.js
// Lightweight global manager for accessing and mutating the active cooking session and its log.
// NOTE: A live session (Session instance) is supplied by useCookingSession via `setActiveSession`.
// Other UI (e.g. edit screens) can then read/update entries without needing backend fetches.

let _session = null;

export const setActiveSession = (session) => {
  _session = session;
};

export const clearActiveSession = () => {
  _session = null;
};

export const getLogEntryById = (id) => {
  if (!_session) return null;
  return _session.log[id] || null;
};

export const updateLogEntryById = (id, updates = {}) => {
  if (!_session) return false;
  const entry = _session.log[id];
  if (!entry) return false;
  Object.assign(entry, updates);
  return true;
};

export const deleteLogEntryById = (id) => {
  if (!_session) return false;
  if (_session.log[id]) {
    delete _session.log[id];
    return true;
  }
  return false;
};
