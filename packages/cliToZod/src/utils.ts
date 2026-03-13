/**
 * @function isPureObject
 * @description
 * Private utility to determine if an entity is a strict, indexable object
 * rather than an Array or a null value.
 */
export const isPureObject = (item: any): item is Record<PropertyKey, any> => {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return false;
  }
  const proto = Object.getPrototypeOf(item);
  return proto === Object.prototype || proto === null;
};