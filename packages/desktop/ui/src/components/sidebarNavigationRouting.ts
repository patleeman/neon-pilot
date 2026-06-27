function routeMatchesPrefix(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function shouldUseDocumentNavigationForSidebarRoute(
  currentPathname: string,
  nextRoute: string,
  extensionRoutes: readonly string[] = [],
): boolean {
  if (currentPathname === nextRoute) return false;

  if (currentPathname.startsWith('/ext/') && nextRoute.startsWith('/ext/')) return true;

  const currentExtensionRoute = extensionRoutes.find((route) => routeMatchesPrefix(currentPathname, route));
  const nextExtensionRoute = extensionRoutes.find((route) => routeMatchesPrefix(nextRoute, route));

  return Boolean(currentExtensionRoute && nextExtensionRoute && currentExtensionRoute !== nextExtensionRoute);
}
