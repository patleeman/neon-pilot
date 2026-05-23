export const LOCAL_API_REQUEST_PROTOCOL = 'desktop';
export const LOCAL_API_LOOPBACK_IP = '127.0.0.1';

export function buildLocalApiRequestSocket(): { remoteAddress: string } {
  return { remoteAddress: LOCAL_API_LOOPBACK_IP };
}
