function contributionText(items) {
  return JSON.stringify(Array.isArray(items) ? items : []).toLowerCase();
}

function requireTerms(problems, text, terms, label) {
  for (const term of terms) {
    if (!text.includes(term)) problems.push(`${label} must include ${term}`);
  }
}

export function analyzeBundledAuthoringManifest(testCase, manifest, sources = {}) {
  const contributes = manifest?.contributes && typeof manifest.contributes === 'object' ? manifest.contributes : {};
  const applications = Array.isArray(contributes.applications) ? contributes.applications : [];
  const views = Array.isArray(contributes.views) ? contributes.views : [];
  const nav = Array.isArray(contributes.nav) ? contributes.nav : [];
  const mainViews = views.filter((view) => view?.location === 'main');
  const problems = [];
  const backendText = String(sources.backend ?? '').toLowerCase();
  const frontendText = String(sources.frontend ?? '').toLowerCase();
  const actionText = contributionText(manifest?.backend?.actions);
  const actionIds = new Set((manifest?.backend?.actions ?? []).map((action) => action?.id).filter(Boolean));
  const commandText = contributionText(contributes.commands);

  if (manifest?.schemaVersion !== 2) problems.push('schemaVersion must be 2');
  if (manifest?.packageType !== 'user') problems.push('packageType must be user');
  if (manifest?.id !== testCase.extensionId) problems.push(`manifest id must be ${testCase.extensionId}`);
  for (const check of testCase.behaviorChecks ?? []) {
    if (!actionIds.has(check.actionId)) problems.push(`missing required callable action ${check.actionId}`);
  }

  if (testCase.productKind === 'capability') {
    if (applications.length !== 0) problems.push('capability must not declare an application');
    if (mainViews.length !== 0) problems.push('capability must not declare a main view');
    if (!Array.isArray(contributes.tools) || contributes.tools.length === 0) problems.push('capability must contribute an agent tool');
    requireTerms(problems, contributionText(contributes.tools), ['save', 'search'], 'agent tool contract');
    requireTerms(problems, commandText, ['count'], 'command contract');
    if (!backendText.includes('ctx.storage.')) problems.push('capability must persist facts with ctx.storage');
    if (!/(trim\(\)|required|empty)/u.test(backendText)) problems.push('capability must reject empty facts');
  }

  if (testCase.productKind === 'page' || testCase.productKind === 'application') {
    if (applications.length !== 1) problems.push('requested application must declare exactly one explicit application');
    const app = applications[0];
    const qualifiedId = app ? `${manifest.id}:${app.id}` : '';
    if (app?.instancePolicy !== 'singleton') problems.push('application must be singleton');
    const startView = mainViews.find((view) => view?.route === app?.startRoute && view?.applicationId === qualifiedId);
    if (!startView) problems.push('application startRoute must resolve to an owned main view');
    for (const view of mainViews) {
      if (view?.applicationId !== qualifiedId) problems.push(`main view ${view?.id ?? '<unknown>'} has the wrong applicationId`);
      if (view?.openPolicy !== 'internal') problems.push(`main view ${view?.id ?? '<unknown>'} must use openPolicy internal`);
    }
    for (const item of nav) {
      if (item?.applicationId !== qualifiedId) problems.push(`nav ${item?.id ?? '<unknown>'} has the wrong applicationId`);
    }
    if (testCase.productKind === 'application') {
      if (mainViews.length < 3) problems.push('multi-page application must declare at least three main views');
      if (!app?.sidebarView) problems.push('multi-page application must own a sidebar view');
      if (!views.some((view) => view?.id === app?.sidebarView && view?.location === 'sidebar')) {
        problems.push('application sidebarView must resolve to a sidebar view');
      }
      if (!Array.isArray(app?.navigationSlots) || app.navigationSlots.length === 0)
        problems.push('application must declare navigation slots');
      requireTerms(problems, contributionText(nav), ['models', 'downloads', 'runtime'], 'application navigation');
      requireTerms(problems, commandText, ['open', 'refresh'], 'application commands');
      if (!backendText.includes('ctx.storage.')) problems.push('application must persist records with ctx.storage');
      if (!/(emptystate|nothing|no models)/u.test(frontendText)) problems.push('application must implement a useful empty state');
      if (!/(errorstate|error)/u.test(frontendText)) problems.push('application must implement an error state');
    } else {
      requireTerms(problems, actionText, ['list', 'add', 'update', 'delete'], 'reading-list actions');
      requireTerms(problems, commandText, ['open', 'add'], 'reading-list commands');
      if (!backendText.includes('ctx.storage.')) problems.push('reading list must persist records with ctx.storage');
      if (!`${frontendText}\n${backendText}`.includes('confirm')) problems.push('reading list must confirm deletion');
    }
  }

  if (testCase.productKind === 'application-contribution') {
    if (applications.length !== 0) problems.push('existing-application contribution must not declare an application');
    if (mainViews.length === 0) problems.push('existing-application contribution must declare a main view');
    for (const view of mainViews) {
      if (view?.applicationId !== testCase.targetApplicationId)
        problems.push(`main view ${view?.id ?? '<unknown>'} targets the wrong application`);
      if (view?.openPolicy !== 'internal') problems.push(`main view ${view?.id ?? '<unknown>'} must use openPolicy internal`);
    }
    for (const item of nav) {
      if (item?.applicationId !== testCase.targetApplicationId)
        problems.push(`nav ${item?.id ?? '<unknown>'} targets the wrong application`);
    }
    if (!nav.some((item) => item?.slot === 'tools')) problems.push('Agent contribution must register navigation in the tools slot');
    requireTerms(problems, contributionText(nav), ['review'], 'Agent navigation');
    if (!backendText.includes('ctx.storage.')) problems.push('Agent reviews must persist records with ctx.storage');
  }

  return { ok: problems.length === 0, problems };
}
