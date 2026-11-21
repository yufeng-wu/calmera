// What one screen of the connect flow leaves for the next. Memory only, read once.
let logging = null;
let keyOutcome = null;

// Today asked for a connection because someone tapped Voice; once there is one, it opens.
export const logAfterConnect = intent => { logging = intent; };
export const takeLogAfterConnect = () => { const value = logging; logging = null; return value; };

// The key page saved a key; the connection page shows what its check found.
export const leaveKeyOutcome = outcome => { keyOutcome = outcome; };
export const takeKeyOutcome = () => { const value = keyOutcome; keyOutcome = null; return value; };
