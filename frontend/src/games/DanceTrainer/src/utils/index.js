// Modular math and utility helpers
/**
 * Calculate Euclidean angle between three joints
 * @param {{x: number, y: number}} a 
 * @param {{x: number, y: number}} b - Vertex
 * @param {{x: number, y: number}} c 
 * @returns {number} Angle in degrees
 */
export function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360.0 - angle;
  }
  return Math.round(angle);
}

/**
 * Format score into formatted string
 * @param {number} score 
 * @returns {string}
 */
export function formatScore(score = 0) {
  return score.toLocaleString();
}
