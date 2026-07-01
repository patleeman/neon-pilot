import {
  __export
} from "./chunk-MZHE4QUL.js";

// neon-pilot-shared-react:neon-pilot-shared-react-dom
var neon_pilot_shared_react_dom_exports = {};
__export(neon_pilot_shared_react_dom_exports, {
  createPortal: () => createPortal,
  default: () => neon_pilot_shared_react_dom_default,
  findDOMNode: () => findDOMNode,
  flushSync: () => flushSync,
  hydrate: () => hydrate,
  render: () => render,
  unmountComponentAtNode: () => unmountComponentAtNode,
  unstable_batchedUpdates: () => unstable_batchedUpdates,
  version: () => version
});
var ReactDom = globalThis.__NEON_PILOT_REACT_DOM__;
if (!ReactDom) throw new Error("Neon Pilot React DOM host runtime is unavailable.");
var createPortal = ReactDom.createPortal;
var flushSync = ReactDom.flushSync;
var findDOMNode = ReactDom.findDOMNode;
var hydrate = ReactDom.hydrate;
var render = ReactDom.render;
var unmountComponentAtNode = ReactDom.unmountComponentAtNode;
var unstable_batchedUpdates = ReactDom.unstable_batchedUpdates;
var version = ReactDom.version;
var neon_pilot_shared_react_dom_default = ReactDom;

export {
  createPortal,
  flushSync,
  unstable_batchedUpdates,
  neon_pilot_shared_react_dom_default,
  neon_pilot_shared_react_dom_exports
};
