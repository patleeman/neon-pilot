const ALLOWED_HOST_ENVIRONMENT_KEYS = [
  'PATH',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TMPDIR',
  'USER',
  'LOGNAME',
  'SHELL',
  '__CF_USER_TEXT_ENCODING',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
];

export function buildBenchmarkBaseEnv(hostEnv) {
  return Object.fromEntries(
    ALLOWED_HOST_ENVIRONMENT_KEYS.map((name) => [name, hostEnv[name]]).filter((entry) => typeof entry[1] === 'string'),
  );
}
