function timestamp() {
  return new Date().toISOString();
}

const logger = {
  info: (...args) => console.log(`[${timestamp()}]`, ...args),
  warn: (...args) => console.warn(`[${timestamp()}]`, ...args),
  error: (...args) => console.error(`[${timestamp()}]`, ...args),
};

module.exports = { logger };
