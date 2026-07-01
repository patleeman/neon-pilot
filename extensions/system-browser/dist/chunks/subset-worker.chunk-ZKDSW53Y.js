import {
  CB,
  NQ
} from "./chunk-L34WPDSR.js";
import "./chunk-ML6OT2ZF.js";
import "./chunk-LVCRN73N.js";
import "./chunk-MZHE4QUL.js";

// node_modules/.pnpm/@excalidraw+excalidraw@0.18.1_@types+react-dom@18.3.7_@types+react@18.3.28__@types+reac_35ce6435019f999df7993d08bf01f01f/node_modules/@excalidraw/excalidraw/dist/prod/subset-worker.chunk.js
var s = import.meta.url ? new URL(import.meta.url) : void 0;
typeof window > "u" && typeof self < "u" && (self.onmessage = async (e) => {
  switch (e.data.command) {
    case CB.Subset:
      let a = await NQ(e.data.arrayBuffer, e.data.codePoints);
      self.postMessage(a, { transfer: [a] });
      break;
  }
});
export {
  s as WorkerUrl
};
