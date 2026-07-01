import {
  parse
} from "./chunk-UAAOHH22.js";
import {
  selectSvgElement
} from "./chunk-OHE3XP7Z.js";
import "./chunk-3SRZ3QRU.js";
import "./chunk-WUKCNXVM.js";
import "./chunk-6MDUTAEC.js";
import "./chunk-6VHAQ3SA.js";
import "./chunk-UBGTM6NT.js";
import "./chunk-UAGG7T7U.js";
import "./chunk-W36H76PU.js";
import "./chunk-4KEGZHDS.js";
import "./chunk-3JXHP33F.js";
import "./chunk-WYYX6M5Q.js";
import {
  configureSvgSize
} from "./chunk-W2QZXKKH.js";
import "./chunk-LFSJ2B73.js";
import {
  __name,
  log
} from "./chunk-5XVP6SZQ.js";
import "./chunk-MZHE4QUL.js";

// node_modules/.pnpm/mermaid@11.13.0/node_modules/mermaid/dist/chunks/mermaid.core/infoDiagram-LFFYTUFH.mjs
var parser = {
  parse: /* @__PURE__ */ __name(async (input) => {
    const ast = await parse("info", input);
    log.debug(ast);
  }, "parse")
};
var DEFAULT_INFO_DB = {
  version: "11.13.0" + (true ? "" : "-tiny")
};
var getVersion = /* @__PURE__ */ __name(() => DEFAULT_INFO_DB.version, "getVersion");
var db = {
  getVersion
};
var draw = /* @__PURE__ */ __name((text, id, version) => {
  log.debug("rendering info diagram\n" + text);
  const svg = selectSvgElement(id);
  configureSvgSize(svg, 100, 400, true);
  const group = svg.append("g");
  group.append("text").attr("x", 100).attr("y", 40).attr("class", "version").attr("font-size", 32).style("text-anchor", "middle").text(`v${version}`);
}, "draw");
var renderer = { draw };
var diagram = {
  parser,
  db,
  renderer
};
export {
  diagram
};
