// Small dependency-free unique id generator (timestamp + random suffix).
// Sorts roughly chronologically, which is handy for default list ordering.
function generateId(prefix) {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${time}${rand}` : `${time}${rand}`;
}

module.exports = { generateId };
