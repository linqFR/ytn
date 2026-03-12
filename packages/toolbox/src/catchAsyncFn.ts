export const catchAsyncFn = (fn: Function) => async (...args: any[]) => {
  try {
    const res = await fn(...args);
    return [null, res];
  } catch (err) {
    return [err, null];
  }
};
export default catchAsyncFn;
