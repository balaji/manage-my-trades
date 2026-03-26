/**
 * @param {string[]} existingNames
 * @param {string[]} activeNames
 * @returns {string[]}
 */
export function getRemovedSeriesNames(existingNames, activeNames) {
  const active = new Set(activeNames);
  return existingNames.filter((name) => !active.has(name));
}
