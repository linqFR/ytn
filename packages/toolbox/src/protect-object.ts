export const protectObject = (obj: any, deep = true, frozen = true) => {
  if (frozen) Object.freeze(obj);
  return new Proxy(obj, {
    set: () => { throw new Error("Object is protected."); }
  });
};
export default protectObject;
