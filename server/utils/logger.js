const logger = {
  info: (message, data = {}) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
      if (Object.keys(data).length > 0) console.log(data);
    }
  },
  warn: (message, data = {}) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
      if (Object.keys(data).length > 0) console.warn(data);
    }
  },
  error: (message, data = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
    if (Object.keys(data).length > 0) console.error(data);
  },
  debug: (message, data = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`);
      if (Object.keys(data).length > 0) console.log(data);
    }
  }
};

export default logger;


