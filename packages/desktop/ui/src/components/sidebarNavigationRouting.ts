function routeMatchesPrefix(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function shouldUseDocumentNavigationForSidebarRoute(
  currentPathname: string,
  nextRoute: string,
  documentNavigationRoutes: readonly string[] = [],
): boolean {
  if (currentPathname === nextRoute) return false;

  if (currentPathname.startsWith('/ext/') && nextRoute.startsWith('/ext/')) return true;

  const currentDocumentRoute = documentNavigationRoutes.find((route) => routeMatchesPrefix(currentPathname, route));
  const nextDocumentRoute = documentNavigationRoutes.find((route) => routeMatchesPrefix(nextRoute, route));

  return Boolean(currentDocumentRoute && nextDocumentRoute && currentDocumentRoute !== nextDocumentRoute);
}
