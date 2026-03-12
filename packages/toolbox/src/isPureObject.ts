export const isPureObject = (val: any) => !!val && typeof val === "object" && !Array.isArray(val);
export default isPureObject;
