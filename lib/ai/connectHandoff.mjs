// What one screen of the connect flow leaves for the next. Memory only, read once.
let logging = null;
let connected = null;

// Today asked for a connection because someone tapped Voice; once there is one, it opens.
export const logAfterConnect = intent => { logging = intent; };
export const takeLogAfterConnect = () => { const value = logging; logging = null; return value; };

// The connect page just connected; the connection page shows what its check found.
export const leaveConnectOutcome = outcome => { connected = outcome; };
export const takeConnectOutcome = () => { const value = connected; connected = null; return value; };
