// packages/desktop/ui/src/deferred-resume/deferredResumeIndicator.ts
function parseIsoTimestamp(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return Number.NaN;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : Number.NaN;
}
function describeDeferredResumeStatus(resume, nowMs = Date.now()) {
  if (resume.status === "ready") {
    return "ready now";
  }
  if (!Number.isSafeInteger(nowMs)) {
    return "due now";
  }
  const deltaMs = parseIsoTimestamp(resume.dueAt) - nowMs;
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return "due now";
  }
  const totalSeconds = Math.floor(deltaMs / 1e3);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `in ${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `in ${minutes}m ${seconds}s`;
  }
  return `in ${seconds}s`;
}
function formatDeferredResumeWhen(resume) {
  const target = resume.status === "ready" ? resume.readyAt ?? resume.dueAt : resume.dueAt;
  const date = new Date(target);
  if (Number.isNaN(date.getTime())) {
    return target;
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export {
  describeDeferredResumeStatus,
  formatDeferredResumeWhen
};
