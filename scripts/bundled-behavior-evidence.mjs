export function isSuccessfulBehaviorResult(resultValue) {
  if (!resultValue || typeof resultValue !== 'object' || Array.isArray(resultValue)) return true;
  if (resultValue.ok === false || typeof resultValue.error === 'string') return false;
  for (const key of ['result', 'details']) {
    if (key in resultValue && !isSuccessfulBehaviorResult(resultValue[key])) return false;
  }
  return true;
}
