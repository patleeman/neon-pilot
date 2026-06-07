export function shouldUseDocumentNavigationForSidebarRoute(currentPathname: string, nextRoute: string): boolean {
  return currentPathname.startsWith('/ext/') && nextRoute.startsWith('/ext/') && currentPathname !== nextRoute;
}
