import {
  selectSvgElement
} from "./chunk-OHE3XP7Z.js";
import {
  isEmpty_default
} from "./chunk-WYYX6M5Q.js";
import {
  JSON_SCHEMA,
  load
} from "./chunk-DY7SKRPC.js";
import {
  registerLayoutLoaders
} from "./chunk-PPDDAKUP.js";
import "./chunk-UX4ZW5NO.js";
import "./chunk-4BT5OUUG.js";
import "./chunk-5MKII24I.js";
import "./chunk-6OSHIOEL.js";
import "./chunk-FS4EKEA2.js";
import "./chunk-YQXEAVBN.js";
import {
  dedent,
  registerIconPacks
} from "./chunk-WPOIQFST.js";
import {
  cleanAndMerge,
  decodeEntities,
  encodeEntities,
  isDetailedError,
  removeDirectives,
  utils_default
} from "./chunk-RN3EZD2P.js";
import "./chunk-SEMVLTEP.js";
import {
  UnknownDiagramError,
  addDirective,
  assignWithDepth_default,
  configureSvgSize,
  defaultConfig,
  detectType,
  detectors,
  evaluate,
  frontMatterRegex,
  getConfig,
  getDiagram,
  getDiagramLoader,
  getEffectiveHtmlLabels,
  getSiteConfig,
  purify,
  registerDiagram,
  registerLazyLoadedDiagrams,
  reset,
  saveConfigFromInitialize,
  setConfig,
  setSiteConfig,
  styles_default,
  themes_default,
  updateSiteConfig
} from "./chunk-W2QZXKKH.js";
import "./chunk-LFSJ2B73.js";
import {
  __name,
  log,
  select_default,
  setLogLevel
} from "./chunk-5XVP6SZQ.js";
import {
  __commonJS,
  __toESM
} from "./chunk-MZHE4QUL.js";

// node_modules/.pnpm/@excalidraw+markdown-to-text@0.1.2/node_modules/@excalidraw/markdown-to-text/dist/index.js
var require_dist = __commonJS({
  "node_modules/.pnpm/@excalidraw+markdown-to-text@0.1.2/node_modules/@excalidraw/markdown-to-text/dist/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.removeMarkdown = void 0;
    var removeMarkdown2 = function(markdown, options) {
      if (options === void 0) {
        options = {
          listUnicodeChar: ""
        };
      }
      options = options || {};
      options.listUnicodeChar = options.hasOwnProperty("listUnicodeChar") ? options.listUnicodeChar : false;
      options.stripListLeaders = options.hasOwnProperty("stripListLeaders") ? options.stripListLeaders : true;
      options.gfm = options.hasOwnProperty("gfm") ? options.gfm : true;
      options.useImgAltText = options.hasOwnProperty("useImgAltText") ? options.useImgAltText : true;
      options.preserveLinks = options.hasOwnProperty("preserveLinks") ? options.preserveLinks : false;
      var output = markdown || "";
      output = output.replace(/^(-\s*?|\*\s*?|_\s*?){3,}\s*$/gm, "");
      try {
        if (options.stripListLeaders) {
          if (options.listUnicodeChar)
            output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, options.listUnicodeChar + " $1");
          else
            output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, "$1");
        }
        if (options.gfm) {
          output = output.replace(/\n={2,}/g, "\n").replace(/~{3}.*\n/g, "").replace(/~~/g, "").replace(/`{3}.*\n/g, "");
        }
        if (options.preserveLinks) {
          output = output.replace(/\[(.*?)\][\[\(](.*?)[\]\)]/g, "$1 ($2)");
        }
        output = output.replace(/<[^>]*>/g, "").replace(/^[=\-]{2,}\s*$/g, "").replace(/\[\^.+?\](\: .*?$)?/g, "").replace(/\s{0,2}\[.*?\]: .*?$/g, "").replace(/\!\[(.*?)\][\[\(].*?[\]\)]/g, options.useImgAltText ? "$1" : "").replace(/\[(.*?)\][\[\(].*?[\]\)]/g, "$1").replace(/^\s{0,3}>\s?/g, "").replace(/(^|\n)\s{0,3}>\s?/g, "\n\n").replace(/^\s{1,2}\[(.*?)\]: (\S+)( ".*?")?\s*$/g, "").replace(/^(\n)?\s{0,}#{1,6}\s+| {0,}(\n)?\s{0,}#{0,} {0,}(\n)?\s{0,}$/gm, "$1$2$3").replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, "$2").replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, "$2").replace(/(`{3,})(.*?)\1/gm, "$2").replace(/`(.+?)`/g, "$1").replace(/\n{2,}/g, "\n\n");
      } catch (e) {
        console.error(e);
        return markdown;
      }
      return output;
    };
    exports.removeMarkdown = removeMarkdown2;
  }
});

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/constants.js
var DEFAULT_FONT_SIZE = 20;
var SVG_TO_SHAPE_MAPPER = {
  rect: "rectangle",
  circle: "ellipse"
};
var MERMAID_CONFIG = {
  startOnLoad: false,
  flowchart: { curve: "linear" },
  themeVariables: {
    fontSize: `${DEFAULT_FONT_SIZE}px`
  },
  maxEdges: 500,
  maxTextSize: 5e4
};

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/converter/GraphConverter.js
var GraphConverter = class {
  constructor({ converter }) {
    this.convert = (graph, config) => {
      return this.converter(graph, {
        ...config,
        fontSize: config.fontSize || DEFAULT_FONT_SIZE
      });
    };
    this.converter = converter;
  }
};

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/interfaces.js
var VERTEX_TYPE;
(function(VERTEX_TYPE2) {
  VERTEX_TYPE2["ROUND"] = "round";
  VERTEX_TYPE2["STADIUM"] = "stadium";
  VERTEX_TYPE2["DOUBLECIRCLE"] = "doublecircle";
  VERTEX_TYPE2["CIRCLE"] = "circle";
  VERTEX_TYPE2["DIAMOND"] = "diamond";
  VERTEX_TYPE2["CYLINDER"] = "cylinder";
})(VERTEX_TYPE || (VERTEX_TYPE = {}));
var LABEL_STYLE_PROPERTY;
(function(LABEL_STYLE_PROPERTY2) {
  LABEL_STYLE_PROPERTY2["COLOR"] = "color";
})(LABEL_STYLE_PROPERTY || (LABEL_STYLE_PROPERTY = {}));
var CONTAINER_STYLE_PROPERTY;
(function(CONTAINER_STYLE_PROPERTY2) {
  CONTAINER_STYLE_PROPERTY2["FILL"] = "fill";
  CONTAINER_STYLE_PROPERTY2["STROKE"] = "stroke";
  CONTAINER_STYLE_PROPERTY2["STROKE_WIDTH"] = "stroke-width";
  CONTAINER_STYLE_PROPERTY2["STROKE_DASHARRAY"] = "stroke-dasharray";
})(CONTAINER_STYLE_PROPERTY || (CONTAINER_STYLE_PROPERTY = {}));

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/converter/helpers.js
var import_markdown_to_text = __toESM(require_dist(), 1);
var MERMAID_EDGE_TYPE_MAPPER = {
  arrow_circle: {
    endArrowhead: "circle"
  },
  arrow_cross: {
    endArrowhead: "bar"
  },
  arrow_open: {
    endArrowhead: null,
    startArrowhead: null
  },
  double_arrow_circle: {
    endArrowhead: "circle",
    startArrowhead: "circle"
  },
  double_arrow_cross: {
    endArrowhead: "bar",
    startArrowhead: "bar"
  },
  double_arrow_point: {
    endArrowhead: "arrow",
    startArrowhead: "arrow"
  }
};
var computeExcalidrawArrowType = (mermaidArrowType) => {
  return MERMAID_EDGE_TYPE_MAPPER[mermaidArrowType];
};
var getText = (element) => {
  let text = element.text;
  if (element.labelType === "markdown") {
    text = (0, import_markdown_to_text.removeMarkdown)(element.text);
  }
  return removeFontAwesomeIcons(text);
};
var removeFontAwesomeIcons = (input) => {
  const fontAwesomeRegex = /\s?(fa|fab):[a-zA-Z0-9-]+/g;
  return input.replace(fontAwesomeRegex, "");
};
var computeExcalidrawVertexStyle = (style) => {
  const excalidrawProperty = {};
  Object.keys(style).forEach((property) => {
    switch (property) {
      case CONTAINER_STYLE_PROPERTY.FILL: {
        excalidrawProperty.backgroundColor = style[property];
        excalidrawProperty.fillStyle = "solid";
        break;
      }
      case CONTAINER_STYLE_PROPERTY.STROKE: {
        excalidrawProperty.strokeColor = style[property];
        break;
      }
      case CONTAINER_STYLE_PROPERTY.STROKE_WIDTH: {
        excalidrawProperty.strokeWidth = Number(style[property]?.split("px")[0]);
        break;
      }
      case CONTAINER_STYLE_PROPERTY.STROKE_DASHARRAY: {
        excalidrawProperty.strokeStyle = "dashed";
        break;
      }
    }
  });
  return excalidrawProperty;
};
var computeExcalidrawVertexLabelStyle = (style) => {
  const excalidrawProperty = {};
  Object.keys(style).forEach((property) => {
    switch (property) {
      case LABEL_STYLE_PROPERTY.COLOR: {
        excalidrawProperty.strokeColor = style[property];
        break;
      }
    }
  });
  return excalidrawProperty;
};

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/converter/types/flowchart.js
var localPoint = (x, y) => [x, y];
var SUBGRAPH_LABEL_HORIZONTAL_PADDING = 32;
var SUBGRAPH_LABEL_WIDTH_RATIO = 0.62;
var VERTEX_LABEL_HORIZONTAL_PADDING = 12;
var MIN_VERTEX_LABEL_FONT_SIZE = 12;
var estimateLabelWidth = (text, fontSize) => {
  return Math.max(20, Math.ceil(text.length * fontSize * SUBGRAPH_LABEL_WIDTH_RATIO));
};
var computeVertexLabelFontSize = (vertexType, text, width, fontSize) => {
  const safeFontSize = fontSize || DEFAULT_FONT_SIZE;
  if (vertexType !== VERTEX_TYPE.CYLINDER || !text || text.includes("\n")) {
    return safeFontSize;
  }
  const availableWidth = Math.max(20, width - VERTEX_LABEL_HORIZONTAL_PADDING);
  const estimatedWidth = estimateLabelWidth(text, safeFontSize);
  if (estimatedWidth <= availableWidth) {
    return safeFontSize;
  }
  return Math.max(MIN_VERTEX_LABEL_FONT_SIZE, Math.floor(availableWidth / (text.length * SUBGRAPH_LABEL_WIDTH_RATIO)));
};
var computeGroupIds = (graph) => {
  const tree = {};
  graph.subGraphs.map((subGraph) => {
    subGraph.nodeIds.forEach((nodeId) => {
      tree[subGraph.id] = {
        id: subGraph.id,
        parent: null,
        isLeaf: false
      };
      tree[nodeId] = {
        id: nodeId,
        parent: subGraph.id,
        isLeaf: graph.vertices[nodeId] !== void 0
      };
    });
  });
  const mapper = {};
  [...Object.keys(graph.vertices), ...graph.subGraphs.map((c) => c.id)].forEach((id30) => {
    if (!tree[id30]) {
      return;
    }
    let curr = tree[id30];
    const groupIds = [];
    if (!curr.isLeaf) {
      groupIds.push(`subgraph_group_${curr.id}`);
    }
    while (true) {
      if (curr.parent) {
        groupIds.push(`subgraph_group_${curr.parent}`);
        curr = tree[curr.parent];
      } else {
        break;
      }
    }
    mapper[id30] = groupIds;
  });
  return {
    getGroupIds: (elementId) => {
      return mapper[elementId] || [];
    },
    getParentId: (elementId) => {
      return tree[elementId] ? tree[elementId].parent : null;
    }
  };
};
var FlowchartToExcalidrawSkeletonConverter = new GraphConverter({
  converter: (graph, options) => {
    const elements = [];
    const fontSize = options.fontSize;
    const { getGroupIds, getParentId } = computeGroupIds(graph);
    graph.subGraphs.reverse().forEach((subGraph) => {
      const groupIds = getGroupIds(subGraph.id);
      const subGraphText = getText(subGraph);
      const safeFontSize = fontSize || 16;
      const estimatedTextWidth = estimateLabelWidth(subGraphText, safeFontSize);
      const minSubGraphWidth = estimatedTextWidth + SUBGRAPH_LABEL_HORIZONTAL_PADDING * 2;
      const width = Math.max(subGraph.width, minSubGraphWidth);
      const x = subGraph.x - (width - subGraph.width) / 2;
      const containerStyle = computeExcalidrawVertexStyle(subGraph.containerStyle);
      const labelStyle = computeExcalidrawVertexLabelStyle(subGraph.labelStyle);
      const containerElement = {
        id: subGraph.id,
        type: "rectangle",
        groupIds,
        x,
        y: subGraph.y,
        width,
        height: subGraph.height,
        label: {
          groupIds,
          text: subGraphText,
          fontSize,
          verticalAlign: "top",
          ...labelStyle
        },
        ...containerStyle
      };
      elements.push(containerElement);
    });
    Object.values(graph.vertices).forEach((vertex) => {
      if (!vertex) {
        return;
      }
      const groupIds = getGroupIds(vertex.id);
      const vertexText = getText(vertex);
      const vertexLabelFontSize = computeVertexLabelFontSize(vertex.type, vertexText, vertex.width, fontSize);
      const containerStyle = computeExcalidrawVertexStyle(vertex.containerStyle);
      const labelStyle = computeExcalidrawVertexLabelStyle(vertex.labelStyle);
      let containerElement = {
        id: vertex.id,
        type: "rectangle",
        groupIds,
        x: vertex.x,
        y: vertex.y,
        width: vertex.width,
        height: vertex.height,
        strokeWidth: 2,
        label: {
          groupIds,
          text: vertexText,
          fontSize: vertexLabelFontSize,
          ...labelStyle
        },
        link: vertex.link || null,
        ...containerStyle
      };
      switch (vertex.type) {
        case VERTEX_TYPE.STADIUM: {
          containerElement = { ...containerElement, roundness: { type: 3 } };
          break;
        }
        case VERTEX_TYPE.ROUND: {
          containerElement = { ...containerElement, roundness: { type: 3 } };
          break;
        }
        case VERTEX_TYPE.DOUBLECIRCLE: {
          const CIRCLE_MARGIN = 5;
          groupIds.push(`doublecircle_${vertex.id}}`);
          const innerCircle = {
            type: "ellipse",
            groupIds,
            x: vertex.x + CIRCLE_MARGIN,
            y: vertex.y + CIRCLE_MARGIN,
            width: vertex.width - CIRCLE_MARGIN * 2,
            height: vertex.height - CIRCLE_MARGIN * 2,
            strokeWidth: 2,
            roundness: { type: 3 },
            label: {
              groupIds,
              text: vertexText,
              fontSize: vertexLabelFontSize,
              ...labelStyle
            }
          };
          containerElement = { ...containerElement, groupIds, type: "ellipse" };
          elements.push(innerCircle);
          break;
        }
        case VERTEX_TYPE.CIRCLE: {
          containerElement.type = "ellipse";
          break;
        }
        case VERTEX_TYPE.DIAMOND: {
          containerElement.type = "diamond";
          break;
        }
      }
      elements.push(containerElement);
    });
    graph.edges.forEach((edge) => {
      let groupIds = [];
      const startParentId = getParentId(edge.start);
      const endParentId = getParentId(edge.end);
      if (startParentId && startParentId === endParentId) {
        groupIds = getGroupIds(startParentId);
      }
      const { startX, startY, reflectionPoints } = edge;
      const points = reflectionPoints.map((point3) => localPoint(point3.x - reflectionPoints[0].x, point3.y - reflectionPoints[0].y));
      const arrowType = computeExcalidrawArrowType(edge.type || "arrow_point");
      const startVertex = elements.find((e) => e.id === edge.start);
      const endVertex = elements.find((e) => e.id === edge.end);
      if (!startVertex || !endVertex) {
        return;
      }
      const arrowId = `${edge.start}_${edge.end}`;
      const containerElement = {
        id: arrowId,
        type: "arrow",
        groupIds,
        x: startX,
        y: startY,
        // 4 and 2 are the Excalidraw's stroke width of thick and thin respectively
        // TODO: use constant exported from Excalidraw package
        strokeWidth: edge.stroke === "thick" ? 4 : 2,
        strokeStyle: edge.stroke === "dotted" ? "dashed" : void 0,
        points,
        ...edge.text ? { label: { text: getText(edge), fontSize, groupIds } } : {},
        roundness: {
          type: 2
        },
        ...arrowType,
        start: {
          id: startVertex.id || ""
        },
        end: {
          id: endVertex.id || ""
        }
      };
      elements.push(containerElement);
    });
    return {
      elements
    };
  }
});

// node_modules/.pnpm/nanoid@4.0.2/node_modules/nanoid/index.browser.js
var nanoid = (size = 21) => crypto.getRandomValues(new Uint8Array(size)).reduce((id30, byte) => {
  byte &= 63;
  if (byte < 36) {
    id30 += byte.toString(36);
  } else if (byte < 62) {
    id30 += (byte - 26).toString(36).toUpperCase();
  } else if (byte > 62) {
    id30 += "-";
  } else {
    id30 += "_";
  }
  return id30;
}, "");

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/converter/types/graphImage.js
var GraphImageConverter = new GraphConverter({
  converter: (graph) => {
    const imageId = nanoid();
    const { width, height } = graph;
    const imageElement = {
      type: "image",
      x: 0,
      y: 0,
      width,
      height,
      status: "saved",
      fileId: imageId
    };
    const files = {
      [imageId]: {
        id: imageId,
        mimeType: graph.mimeType,
        dataURL: graph.dataURL
      }
    };
    return { files, elements: [imageElement] };
  }
});

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/converter/transformToExcalidrawSkeleton.js
var point = (x, y) => [x, y];
var normalizeText = (text) => {
  return text.replace(/\\n/g, "\n");
};
var transformToExcalidrawLineSkeleton = (line2) => {
  const lineElement = {
    type: "line",
    x: line2.startX,
    y: line2.startY,
    points: [
      point(0, 0),
      point(line2.endX - line2.startX, line2.endY - line2.startY)
    ],
    width: line2.endX - line2.startX,
    height: line2.endY - line2.startY,
    strokeStyle: line2.strokeStyle || "solid",
    strokeColor: line2.strokeColor || "#000",
    strokeWidth: line2.strokeWidth || 1
  };
  if (line2.groupId) {
    Object.assign(lineElement, { groupIds: [line2.groupId] });
  }
  if (line2.id) {
    Object.assign(lineElement, { id: line2.id });
  }
  return lineElement;
};
var transformToExcalidrawTextSkeleton = (element) => {
  const textElement = {
    type: "text",
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    text: normalizeText(element.text) || "",
    fontSize: element.fontSize,
    verticalAlign: "top",
    strokeColor: element.color
  };
  if (element.groupId) {
    Object.assign(textElement, { groupIds: [element.groupId] });
  }
  if (element.id) {
    Object.assign(textElement, { id: element.id });
  }
  return textElement;
};
var transformToExcalidrawContainerSkeleton = (element) => {
  const label = {
    text: normalizeText(element?.label?.text || ""),
    fontSize: element?.label?.fontSize,
    textAlign: element.label?.textAlign,
    verticalAlign: element.label?.verticalAlign || "middle",
    strokeColor: element.label?.color || "#000",
    ...element.groupId ? { groupIds: [element.groupId] } : {}
  };
  let extraProps = {};
  if (element.type === "rectangle" && element.subtype === "activation") {
    extraProps = {
      backgroundColor: "#e9ecef",
      fillStyle: "solid"
    };
  }
  const container = {
    id: element.id,
    type: element.type,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    label,
    strokeStyle: element?.strokeStyle,
    strokeWidth: element?.strokeWidth,
    strokeColor: element?.strokeColor,
    backgroundColor: element?.bgColor,
    fillStyle: "solid",
    ...extraProps
  };
  if (element.groupId) {
    Object.assign(container, { groupIds: [element.groupId] });
  }
  return container;
};
var transformToExcalidrawArrowSkeleton = (arrow) => {
  const arrowElement = {
    type: "arrow",
    x: arrow.startX,
    y: arrow.startY,
    points: arrow.points?.map(([x, y]) => point(x, y)) || [
      point(0, 0),
      point(arrow.endX - arrow.startX, arrow.endY - arrow.startY)
    ],
    width: arrow.endX - arrow.startX,
    height: arrow.endY - arrow.startY,
    strokeStyle: arrow?.strokeStyle || "solid",
    endArrowhead: arrow?.endArrowhead || null,
    startArrowhead: arrow?.startArrowhead || null,
    label: {
      text: normalizeText(arrow?.label?.text || ""),
      fontSize: 16,
      textAlign: arrow?.label?.textAlign,
      verticalAlign: arrow?.label?.verticalAlign
    },
    roundness: {
      type: 2
    },
    start: arrow.start,
    end: arrow.end
  };
  if (arrow.groupId) {
    Object.assign(arrowElement, { groupIds: [arrow.groupId] });
  }
  return arrowElement;
};

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/converter/types/sequence.js
var GROUP_RECT_PADDING = 10;
var GROUP_LABEL_FONT_SIZE = 16;
var GROUP_LABEL_VERTICAL_OFFSET = 24;
var GROUP_LABEL_HORIZONTAL_OFFSET = 4;
var isTransparentFill = (fill) => {
  if (!fill) {
    return true;
  }
  const normalizedFill = fill.trim().toLowerCase();
  return normalizedFill === "transparent" || normalizedFill === "none" || normalizedFill === "rgba(0,0,0,0)" || normalizedFill === "rgba(0, 0, 0, 0)";
};
var estimateTextWidth = (text, fontSize) => {
  return Math.max(20, Math.round(text.length * fontSize * 0.6));
};
var addGroupId = (element, groupId, includeLabel = true) => {
  const mutableElement = element;
  const existingGroupIds = mutableElement.groupIds ?? [];
  if (!existingGroupIds.includes(groupId)) {
    mutableElement.groupIds = [...existingGroupIds, groupId];
  }
  if (!includeLabel || !mutableElement.label) {
    return;
  }
  const labelGroupIds = mutableElement.label.groupIds ?? [];
  if (!labelGroupIds.includes(groupId)) {
    mutableElement.label.groupIds = [...labelGroupIds, groupId];
  }
};
var SequenceToExcalidrawSkeletonConvertor = new GraphConverter({
  converter: (chart) => {
    const elements = [];
    const activations = [];
    Object.values(chart.nodes).forEach((node2) => {
      if (!node2 || !node2.length) {
        return;
      }
      node2.forEach((element) => {
        let excalidrawElement;
        switch (element.type) {
          case "line":
            excalidrawElement = transformToExcalidrawLineSkeleton(element);
            break;
          case "rectangle":
          case "ellipse":
            excalidrawElement = transformToExcalidrawContainerSkeleton(element);
            break;
          case "text":
            excalidrawElement = transformToExcalidrawTextSkeleton(element);
            break;
          default:
            throw `unknown type ${element.type}`;
            break;
        }
        if (element.type === "rectangle" && element?.subtype === "activation") {
          activations.push(excalidrawElement);
        } else {
          elements.push(excalidrawElement);
        }
      });
    });
    Object.values(chart.lines).forEach((line2) => {
      if (!line2) {
        return;
      }
      elements.push(transformToExcalidrawLineSkeleton(line2));
    });
    Object.values(chart.arrows).forEach((arrow) => {
      if (!arrow) {
        return;
      }
      elements.push(transformToExcalidrawArrowSkeleton(arrow));
      if (arrow.sequenceNumber) {
        elements.push(transformToExcalidrawContainerSkeleton(arrow.sequenceNumber));
      }
    });
    elements.push(...activations);
    if (chart.loops) {
      const { lines, texts, nodes } = chart.loops;
      lines.forEach((line2) => {
        elements.push(transformToExcalidrawLineSkeleton(line2));
      });
      texts.forEach((text) => {
        elements.push(transformToExcalidrawTextSkeleton(text));
      });
      nodes.forEach((node2) => {
        elements.push(transformToExcalidrawContainerSkeleton(node2));
      });
    }
    if (chart.groups) {
      chart.groups.forEach((group) => {
        const { actorKeys, name } = group;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = 0;
        let maxY = 0;
        if (!actorKeys.length) {
          return;
        }
        const actors = elements.filter((ele) => {
          if (ele.id) {
            const hyphenIndex = ele.id.indexOf("-");
            const id30 = ele.id.substring(0, hyphenIndex);
            return actorKeys.includes(id30);
          }
          return false;
        });
        if (!actors.length) {
          return;
        }
        actors.forEach((actor) => {
          if (actor.x === void 0 || actor.y === void 0 || actor.width === void 0 || actor.height === void 0) {
            return;
          }
          minX = Math.min(minX, actor.x);
          minY = Math.min(minY, actor.y);
          maxX = Math.max(maxX, actor.x + actor.width);
          maxY = Math.max(maxY, actor.y + actor.height);
        });
        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
          return;
        }
        const groupRectX = minX - GROUP_RECT_PADDING;
        const groupRectY = minY - GROUP_RECT_PADDING;
        const groupRectWidth = maxX - minX + GROUP_RECT_PADDING * 2;
        const groupRectHeight = maxY - minY + GROUP_RECT_PADDING * 2;
        const groupRectId = nanoid();
        const groupId = nanoid();
        const groupRect = transformToExcalidrawContainerSkeleton({
          type: "rectangle",
          x: groupRectX,
          y: groupRectY,
          width: groupRectWidth,
          height: groupRectHeight,
          bgColor: isTransparentFill(group.fill) ? void 0 : group.fill,
          strokeColor: "#1f1f1f",
          strokeWidth: 1,
          id: groupRectId,
          groupId
        });
        elements.unshift(groupRect);
        elements.forEach((ele) => {
          if (ele.id === groupRectId) {
            return;
          }
          if (ele.x === void 0 || ele.y === void 0 || ele.width === void 0 || ele.height === void 0) {
            return;
          }
          if (ele.x >= minX && ele.x + ele.width <= maxX && ele.y >= minY && ele.y + ele.height <= maxY) {
            addGroupId(ele, groupId);
          }
        });
        if (name) {
          const groupLabel = transformToExcalidrawTextSkeleton({
            type: "text",
            id: nanoid(),
            text: name,
            x: groupRectX + GROUP_LABEL_HORIZONTAL_OFFSET,
            y: groupRectY - GROUP_LABEL_VERTICAL_OFFSET,
            width: estimateTextWidth(name, GROUP_LABEL_FONT_SIZE),
            height: GROUP_LABEL_FONT_SIZE + 8,
            fontSize: GROUP_LABEL_FONT_SIZE,
            color: "#1f1f1f",
            groupId
          });
          addGroupId(groupLabel, groupId, false);
          elements.push(groupLabel);
        }
      });
    }
    return { elements };
  }
});

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/converter/types/class.js
var classToExcalidrawSkeletonConvertor = new GraphConverter({
  converter: (chart) => {
    const elements = [];
    chart.nodes.forEach((node2) => {
      if (!node2 || !node2.length) {
        return;
      }
      node2.forEach((element) => {
        let excalidrawElement;
        switch (element.type) {
          case "line":
            excalidrawElement = transformToExcalidrawLineSkeleton(element);
            break;
          case "rectangle":
          case "ellipse":
            excalidrawElement = transformToExcalidrawContainerSkeleton(element);
            break;
          case "text":
            excalidrawElement = transformToExcalidrawTextSkeleton(element);
            break;
          default:
            throw `unknown type ${element.type}`;
            break;
        }
        elements.push(excalidrawElement);
      });
    });
    Object.values(chart.lines).forEach((line2) => {
      if (!line2) {
        return;
      }
      elements.push(transformToExcalidrawLineSkeleton(line2));
    });
    Object.values(chart.arrows).forEach((arrow) => {
      if (!arrow) {
        return;
      }
      const excalidrawElement = transformToExcalidrawArrowSkeleton(arrow);
      elements.push(excalidrawElement);
    });
    Object.values(chart.text).forEach((ele) => {
      const excalidrawElement = transformToExcalidrawTextSkeleton(ele);
      elements.push(excalidrawElement);
    });
    Object.values(chart.namespaces).forEach((namespace) => {
      const classIds = Object.keys(namespace.classes);
      const children = [...classIds];
      const chartElements = [...chart.lines, ...chart.arrows, ...chart.text];
      classIds.forEach((classId) => {
        const childIds = chartElements.filter((ele) => ele.metadata && ele.metadata.classId === classId).map((ele) => ele.id);
        if (childIds.length) {
          children.push(...childIds);
        }
      });
      const frame = {
        type: "frame",
        id: nanoid(),
        name: namespace.id,
        children
      };
      elements.push(frame);
    });
    return { elements };
  }
});

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/converter/types/er.js
var erToExcalidrawSkeletonConvertor = new GraphConverter({
  converter: (chart) => {
    const elements = [];
    chart.nodes.forEach((node2) => {
      if (!node2 || !node2.length) {
        return;
      }
      node2.forEach((element) => {
        let excalidrawElement;
        switch (element.type) {
          case "line":
            excalidrawElement = transformToExcalidrawLineSkeleton(element);
            break;
          case "rectangle":
          case "ellipse":
            excalidrawElement = transformToExcalidrawContainerSkeleton(element);
            break;
          case "text":
            excalidrawElement = transformToExcalidrawTextSkeleton(element);
            break;
          default:
            throw `unknown type ${element.type}`;
        }
        elements.push(excalidrawElement);
      });
    });
    chart.lines.forEach((line2) => {
      elements.push(transformToExcalidrawLineSkeleton(line2));
    });
    chart.arrows.forEach((arrow) => {
      elements.push(transformToExcalidrawArrowSkeleton(arrow));
    });
    chart.text.forEach((textElement) => {
      elements.push(transformToExcalidrawTextSkeleton(textElement));
    });
    return { elements };
  }
});

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/converter/types/state.js
var point2 = (x, y) => [x, y];
var DEFAULT_STATE_NODE_LABEL_FONT_SIZE = 16;
var MIN_STATE_NODE_LABEL_FONT_SIZE = 14;
var STATE_NODE_LABEL_FONT_SIZE_STEP = 1;
var DEFAULT_STATE_FILLED_COLOR = "#000000";
var EXCALIDRAW_BOUND_TEXT_PADDING = 5;
var STATE_NODE_LABEL_HORIZONTAL_PADDING = EXCALIDRAW_BOUND_TEXT_PADDING * 2;
var STATE_NODE_LABEL_VERTICAL_PADDING = EXCALIDRAW_BOUND_TEXT_PADDING * 2;
var EXCALIDRAW_LINE_HEIGHT = 1.25;
var STATE_PSEUDO_STATE_SHAPES_WITHOUT_LABEL = /* @__PURE__ */ new Set([
  "choice",
  "fork",
  "join",
  "stateStart",
  "stateEnd",
  "divider"
]);
var getStateEndGroupIds = (node2) => node2.shape === "stateEnd" ? [`state_end_group_${node2.id}`] : void 0;
var getNodeText = (node2) => {
  if (node2.shape === "rectWithTitle" && node2.description.length) {
    return [node2.text, ...node2.description].join("\n");
  }
  return node2.text;
};
var labelMeasureContext;
var getLabelMeasureContext = () => {
  if (labelMeasureContext !== void 0) {
    return labelMeasureContext;
  }
  if (typeof document === "undefined") {
    labelMeasureContext = null;
    return labelMeasureContext;
  }
  try {
    labelMeasureContext = document.createElement("canvas").getContext("2d");
  } catch {
    labelMeasureContext = null;
  }
  return labelMeasureContext;
};
var measureLabelLineWidthAtFontSize = (line2, fontSize) => {
  const context = getLabelMeasureContext();
  if (!context) {
    return line2.length * fontSize * 0.6;
  }
  context.font = `${fontSize}px Excalifont, sans-serif`;
  return context.measureText(line2).width;
};
var wrapLabelWord = (word, fontSize, maxWidth) => {
  if (measureLabelLineWidthAtFontSize(word, fontSize) <= maxWidth) {
    return [word];
  }
  const wrappedParts = [];
  let currentPart = "";
  for (const char2 of word) {
    const candidatePart = `${currentPart}${char2}`;
    if (currentPart && measureLabelLineWidthAtFontSize(candidatePart, fontSize) > maxWidth) {
      wrappedParts.push(currentPart);
      currentPart = char2;
      continue;
    }
    currentPart = candidatePart;
  }
  if (currentPart) {
    wrappedParts.push(currentPart);
  }
  return wrappedParts;
};
var wrapLabelLine = (line2, fontSize, maxWidth) => {
  if (!line2.trim()) {
    return line2;
  }
  if (measureLabelLineWidthAtFontSize(line2, fontSize) <= maxWidth) {
    return line2;
  }
  const words = line2.split(/\s+/).filter(Boolean);
  const wrappedLines = [];
  let currentLine = "";
  for (const word of words) {
    const wrappedWordParts = wrapLabelWord(word, fontSize, maxWidth);
    for (const [wordPartIndex, wordPart] of wrappedWordParts.entries()) {
      const separator = currentLine ? wordPartIndex === 0 ? " " : "" : "";
      const candidateLine = currentLine ? `${currentLine}${separator}${wordPart}` : wordPart;
      if (measureLabelLineWidthAtFontSize(candidateLine, fontSize) <= maxWidth) {
        currentLine = candidateLine;
        continue;
      }
      if (currentLine) {
        wrappedLines.push(currentLine);
      }
      currentLine = wordPart;
    }
    if (wrappedWordParts.length > 1) {
      continue;
    }
  }
  wrappedLines.push(currentLine);
  return wrappedLines.join("\n");
};
var getWrappedLabelMetrics = (lines, fontSize, availableWidth) => {
  const wrappedText = lines.map((line2) => wrapLabelLine(line2, fontSize, availableWidth)).join("\n");
  const wrappedLines = wrappedText.split("\n");
  const width = Math.max(...wrappedLines.map((line2) => measureLabelLineWidthAtFontSize(line2, fontSize)));
  const height = wrappedLines.length * fontSize * EXCALIDRAW_LINE_HEIGHT;
  return {
    width,
    height
  };
};
var findLargestLabelFontSizeThatFitsBounds = (text, availableWidth, availableHeight, fallbackFontSize) => {
  const lines = text.split("\n");
  for (let fontSize = DEFAULT_STATE_NODE_LABEL_FONT_SIZE; fontSize >= MIN_STATE_NODE_LABEL_FONT_SIZE; fontSize -= STATE_NODE_LABEL_FONT_SIZE_STEP) {
    const { height } = getWrappedLabelMetrics(lines, fontSize, availableWidth);
    if (height <= availableHeight) {
      return fontSize;
    }
  }
  return fallbackFontSize;
};
var getNodeLabelFontSize = (node2) => {
  const text = getNodeText(node2);
  if (!text || STATE_PSEUDO_STATE_SHAPES_WITHOUT_LABEL.has(node2.shape)) {
    return DEFAULT_STATE_NODE_LABEL_FONT_SIZE;
  }
  const availableWidth = Math.max(1, node2.width - STATE_NODE_LABEL_HORIZONTAL_PADDING);
  const availableHeight = Math.max(1, node2.height - STATE_NODE_LABEL_VERTICAL_PADDING);
  const lines = text.split("\n");
  if (lines.length > 1) {
    const longestLineWidth = Math.max(...lines.map((line2) => measureLabelLineWidthAtFontSize(line2, DEFAULT_STATE_NODE_LABEL_FONT_SIZE)));
    if (longestLineWidth <= availableWidth) {
      return DEFAULT_STATE_NODE_LABEL_FONT_SIZE;
    }
  }
  return findLargestLabelFontSizeThatFitsBounds(text, availableWidth, availableHeight, lines.length === 1 ? DEFAULT_STATE_NODE_LABEL_FONT_SIZE : MIN_STATE_NODE_LABEL_FONT_SIZE);
};
var createLabel = (node2) => {
  if (STATE_PSEUDO_STATE_SHAPES_WITHOUT_LABEL.has(node2.shape)) {
    return void 0;
  }
  const text = getNodeText(node2);
  if (!text) {
    return void 0;
  }
  return {
    text,
    fontSize: getNodeLabelFontSize(node2),
    verticalAlign: node2.shape === "rectWithTitle" || node2.shape === "roundedWithTitle" ? "top" : "middle",
    ...computeExcalidrawVertexLabelStyle(node2.labelStyle)
  };
};
var createContainerElement = (node2) => {
  const baseStyle = computeExcalidrawVertexStyle(node2.containerStyle);
  const label = createLabel(node2);
  const elementType = node2.shape === "choice" ? "diamond" : node2.shape === "stateStart" || node2.shape === "stateEnd" ? "ellipse" : "rectangle";
  const hasRoundedCorners = node2.shape === "rect" || node2.shape === "rectWithTitle" || node2.shape === "roundedWithTitle";
  const isFilledStateNode = node2.shape === "stateStart" || node2.shape === "fork" || node2.shape === "join";
  const fillColor = baseStyle.backgroundColor || baseStyle.strokeColor || DEFAULT_STATE_FILLED_COLOR;
  const strokeColor = baseStyle.strokeColor || baseStyle.backgroundColor || DEFAULT_STATE_FILLED_COLOR;
  return {
    id: node2.id,
    type: elementType,
    ...getStateEndGroupIds(node2) ? { groupIds: getStateEndGroupIds(node2) } : {},
    x: node2.x,
    y: node2.y,
    width: node2.width,
    height: node2.height,
    ...label ? { label } : {},
    ...baseStyle,
    ...hasRoundedCorners ? { roundness: { type: 3 } } : {},
    ...isFilledStateNode ? {
      backgroundColor: fillColor,
      strokeColor,
      fillStyle: "solid"
    } : {}
  };
};
var createDividerLineElement = (node2) => {
  if (!node2.dividerLine) {
    return null;
  }
  const baseStyle = computeExcalidrawVertexStyle(node2.containerStyle);
  return {
    id: `${node2.id}__divider`,
    type: "line",
    x: node2.dividerLine.startX,
    y: node2.dividerLine.startY,
    width: node2.dividerLine.endX - node2.dividerLine.startX,
    height: node2.dividerLine.endY - node2.dividerLine.startY,
    points: [
      point2(0, 0),
      point2(node2.dividerLine.endX - node2.dividerLine.startX, node2.dividerLine.endY - node2.dividerLine.startY)
    ],
    strokeColor: baseStyle.strokeColor || "#000",
    strokeWidth: baseStyle.strokeWidth || 1
  };
};
var createEndStateInnerEllipse = (node2) => {
  const outerStyle = computeExcalidrawVertexStyle(node2.containerStyle);
  const inset = Math.max(2, Math.min(node2.width, node2.height) * 0.32);
  const fillColor = node2.endInnerColor || outerStyle.strokeColor || outerStyle.backgroundColor || DEFAULT_STATE_FILLED_COLOR;
  return {
    id: `${node2.id}__inner`,
    type: "ellipse",
    groupIds: getStateEndGroupIds(node2),
    x: node2.x + inset,
    y: node2.y + inset,
    width: Math.max(1, node2.width - inset * 2),
    height: Math.max(1, node2.height - inset * 2),
    backgroundColor: fillColor,
    strokeColor: fillColor,
    fillStyle: "solid",
    strokeWidth: 1
  };
};
var createArrowElement = (edge) => {
  const points = edge.reflectionPoints.map((currentPoint, index, array) => {
    const startPoint = array[0];
    if (index === 0) {
      return point2(0, 0);
    }
    return point2(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y);
  });
  return {
    id: edge.id,
    type: "arrow",
    x: edge.startX,
    y: edge.startY,
    width: edge.endX - edge.startX,
    height: edge.endY - edge.startY,
    points,
    strokeColor: edge.strokeColor || "#000",
    strokeWidth: edge.strokeWidth || 2,
    strokeStyle: edge.strokeStyle || "solid",
    endArrowhead: edge.isNoteEdge ? null : "triangle",
    roundness: { type: 2 },
    start: { id: edge.start },
    end: { id: edge.end },
    ...edge.text ? {
      label: {
        text: edge.text,
        fontSize: 16
      }
    } : {}
  };
};
var stateToExcalidrawSkeletonConvertor = new GraphConverter({
  converter: (chart) => {
    const elements = [];
    chart.nodes.forEach((node2) => {
      if (!node2.isRenderable) {
        return;
      }
      const containerElement = createContainerElement(node2);
      elements.push(containerElement);
      const dividerLineElement = createDividerLineElement(node2);
      if (dividerLineElement) {
        elements.push(dividerLineElement);
      }
      if (node2.shape === "stateEnd") {
        elements.push(createEndStateInnerEllipse(node2));
      }
    });
    chart.edges.forEach((edge) => {
      elements.push(createArrowElement(edge));
    });
    return { elements };
  }
});

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/utils.js
var entityCodesToText = (input) => {
  input = decodeEntities2(input);
  const inputWithDecimalCode = input.replace(/#(\d+);/g, "&#$1;").replace(/#([a-z]+);/g, "&$1;");
  const element = document.createElement("textarea");
  element.innerHTML = inputWithDecimalCode;
  return element.value;
};
var getTransformAttr = (el) => {
  const transformAttr = el.getAttribute("transform");
  const translateMatch = transformAttr?.match(/translate\(([ \d.-]+),\s*([\d.-]+)\)/);
  let transformX = 0;
  let transformY = 0;
  if (translateMatch) {
    transformX = Number(translateMatch[1]);
    transformY = Number(translateMatch[2]);
  }
  return { transformX, transformY };
};
var encodeEntities2 = (text) => {
  let txt = text;
  txt = txt.replace(/style.*:\S*#.*;/g, (s) => {
    return s.substring(0, s.length - 1);
  });
  txt = txt.replace(/classDef.*:\S*#.*;/g, (s) => {
    return s.substring(0, s.length - 1);
  });
  txt = txt.replace(/#\w+;/g, (s) => {
    const innerTxt = s.substring(1, s.length - 1);
    const isInt = /^\+?\d+$/.test(innerTxt);
    if (isInt) {
      return `\uFB02\xB0\xB0${innerTxt}\xB6\xDF`;
    }
    return `\uFB02\xB0${innerTxt}\xB6\xDF`;
  });
  return txt;
};
var decodeEntities2 = function(text) {
  return text.replace(/ﬂ°°/g, "#").replace(/ﬂ°/g, "&").replace(/¶ß/g, ";");
};
var DEFAULT_POINT_DEDUPE_THRESHOLD = 0.5;
var dedupeConsecutivePoints = (points, threshold = DEFAULT_POINT_DEDUPE_THRESHOLD) => {
  const dedupedPoints = [];
  points.forEach((point3) => {
    const previousPoint = dedupedPoints[dedupedPoints.length - 1];
    if (!previousPoint) {
      dedupedPoints.push(point3);
      return;
    }
    const distance = Math.hypot(point3[0] - previousPoint[0], point3[1] - previousPoint[1]);
    if (distance <= threshold) {
      return;
    }
    dedupedPoints.push(point3);
  });
  return dedupedPoints;
};
var getPathCoordinates = (path) => {
  const dAttr = path.getAttribute("d");
  if (!dAttr) {
    return null;
  }
  const numericTokens = Array.from(dAttr.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi), (match) => Number(match[0]));
  if (numericTokens.length < 4) {
    return null;
  }
  return {
    startX: numericTokens[0],
    startY: numericTokens[1],
    endX: numericTokens[numericTokens.length - 2],
    endY: numericTokens[numericTokens.length - 1]
  };
};
var getDecodedEdgePoints = (edgePath) => {
  const encodedPoints = edgePath.getAttribute("data-points");
  if (!encodedPoints) {
    const coords = getPathCoordinates(edgePath);
    return coords ? [
      { x: coords.startX, y: coords.startY },
      { x: coords.endX, y: coords.endY }
    ] : [];
  }
  try {
    const decoded = atob(encodedPoints);
    const points = JSON.parse(decoded);
    return Array.isArray(points) ? points.filter((point3) => point3 && typeof point3.x === "number" && typeof point3.y === "number" && Number.isFinite(point3.x) && Number.isFinite(point3.y)) : [];
  } catch {
    return [];
  }
};
var computeEdgePositions = (pathElement, offset = { x: 0, y: 0 }, commandsPattern = "LM") => {
  if (pathElement.tagName.toLowerCase() !== "path") {
    throw new Error(`Invalid input: Expected an HTMLElement of tag "path", got ${pathElement.tagName}`);
  }
  const dAttr = pathElement.getAttribute("d");
  if (!dAttr) {
    throw new Error('Path element does not contain a "d" attribute');
  }
  const commands = dAttr.split(new RegExp(`(?=[${commandsPattern}])`));
  const startPosition = commands[0].substring(1).split(",").map((coord) => parseFloat(coord));
  const endPosition = commands[commands.length - 1].substring(1).split(",").map((coord) => parseFloat(coord));
  const reflectionPoints = commands.map((command) => {
    const commandType = command[0];
    const coords = command.substring(1).split(",").map((coord) => parseFloat(coord));
    if (commandType === "C") {
      return {
        x: coords[4],
        y: coords[5],
        command: commandType
      };
    }
    return { x: coords[0], y: coords[1], command: commandType };
  }).filter((point3, index, array) => {
    if (index === 0 || index === array.length - 1) {
      return true;
    }
    if (point3.x === array[index - 1].x && point3.y === array[index - 1].y) {
      return false;
    }
    if (index === array.length - 2 && point3.command === "C") {
      return false;
    }
    if (index === array.length - 2 && (array[index - 1].x === point3.x || array[index - 1].y === point3.y)) {
      const lastPoint = array[array.length - 1];
      const distance = Math.hypot(lastPoint.x - point3.x, lastPoint.y - point3.y);
      return distance > 20;
    }
    return point3.x !== array[index - 1].x || point3.y !== array[index - 1].y;
  }).map((p) => {
    return {
      x: p.x + offset.x,
      y: p.y + offset.y
    };
  });
  return {
    startX: startPosition[0] + offset.x,
    startY: startPosition[1] + offset.y,
    endX: endPosition[0] + offset.x,
    endY: endPosition[1] + offset.y,
    reflectionPoints
  };
};

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/graphToExcalidraw.js
var normalizeLinearElementPoints = (result) => {
  return {
    ...result,
    elements: result.elements.map((element) => {
      if (!("points" in element) || !Array.isArray(element.points)) {
        return element;
      }
      const points = element.points;
      if (points.length < 2) {
        return element;
      }
      const dedupedPoints = dedupeConsecutivePoints(points);
      if (dedupedPoints.length === points.length) {
        return element;
      }
      return {
        ...element,
        points: dedupedPoints
      };
    })
  };
};
var graphToExcalidraw = (graph, options = {}) => {
  const result = (() => {
    switch (graph.type) {
      case "graphImage": {
        return GraphImageConverter.convert(graph, options);
      }
      case "flowchart": {
        return FlowchartToExcalidrawSkeletonConverter.convert(graph, options);
      }
      case "sequence": {
        return SequenceToExcalidrawSkeletonConvertor.convert(graph, options);
      }
      case "class": {
        return classToExcalidrawSkeletonConvertor.convert(graph, options);
      }
      case "erd": {
        return erToExcalidrawSkeletonConvertor.convert(graph, options);
      }
      case "state": {
        return stateToExcalidrawSkeletonConvertor.convert(graph, options);
      }
      default: {
        throw new Error(`graphToExcalidraw: unknown graph type "${graph.type}, only flowcharts are supported!"`);
      }
    }
  })();
  return normalizeLinearElementPoints(result);
};

// node_modules/.pnpm/stylis@4.3.6/node_modules/stylis/src/Enum.js
var COMMENT = "comm";
var RULESET = "rule";
var DECLARATION = "decl";
var IMPORT = "@import";
var NAMESPACE = "@namespace";
var KEYFRAMES = "@keyframes";
var LAYER = "@layer";

// node_modules/.pnpm/stylis@4.3.6/node_modules/stylis/src/Utility.js
var abs = Math.abs;
var from = String.fromCharCode;
function trim(value) {
  return value.trim();
}
function replace(value, pattern, replacement) {
  return value.replace(pattern, replacement);
}
function indexof(value, search, position2) {
  return value.indexOf(search, position2);
}
function charat(value, index) {
  return value.charCodeAt(index) | 0;
}
function substr(value, begin, end) {
  return value.slice(begin, end);
}
function strlen(value) {
  return value.length;
}
function sizeof(value) {
  return value.length;
}
function append(value, array) {
  return array.push(value), value;
}

// node_modules/.pnpm/stylis@4.3.6/node_modules/stylis/src/Tokenizer.js
var line = 1;
var column = 1;
var length = 0;
var position = 0;
var character = 0;
var characters = "";
function node(value, root, parent, type, props, children, length2, siblings) {
  return { value, root, parent, type, props, children, line, column, length: length2, return: "", siblings };
}
function char() {
  return character;
}
function prev() {
  character = position > 0 ? charat(characters, --position) : 0;
  if (column--, character === 10)
    column = 1, line--;
  return character;
}
function next() {
  character = position < length ? charat(characters, position++) : 0;
  if (column++, character === 10)
    column = 1, line++;
  return character;
}
function peek() {
  return charat(characters, position);
}
function caret() {
  return position;
}
function slice(begin, end) {
  return substr(characters, begin, end);
}
function token(type) {
  switch (type) {
    case 0:
    case 9:
    case 10:
    case 13:
    case 32:
      return 5;
    case 33:
    case 43:
    case 44:
    case 47:
    case 62:
    case 64:
    case 126:
    case 59:
    case 123:
    case 125:
      return 4;
    case 58:
      return 3;
    case 34:
    case 39:
    case 40:
    case 91:
      return 2;
    case 41:
    case 93:
      return 1;
  }
  return 0;
}
function alloc(value) {
  return line = column = 1, length = strlen(characters = value), position = 0, [];
}
function dealloc(value) {
  return characters = "", value;
}
function delimit(type) {
  return trim(slice(position - 1, delimiter(type === 91 ? type + 2 : type === 40 ? type + 1 : type)));
}
function whitespace(type) {
  while (character = peek())
    if (character < 33)
      next();
    else
      break;
  return token(type) > 2 || token(character) > 3 ? "" : " ";
}
function escaping(index, count) {
  while (--count && next())
    if (character < 48 || character > 102 || character > 57 && character < 65 || character > 70 && character < 97)
      break;
  return slice(index, caret() + (count < 6 && peek() == 32 && next() == 32));
}
function delimiter(type) {
  while (next())
    switch (character) {
      case type:
        return position;
      case 34:
      case 39:
        if (type !== 34 && type !== 39)
          delimiter(character);
        break;
      case 40:
        if (type === 41)
          delimiter(type);
        break;
      case 92:
        next();
        break;
    }
  return position;
}
function commenter(type, index) {
  while (next())
    if (type + character === 47 + 10)
      break;
    else if (type + character === 42 + 42 && peek() === 47)
      break;
  return "/*" + slice(index, position - 1) + "*" + from(type === 47 ? type : next());
}
function identifier(index) {
  while (!token(peek()))
    next();
  return slice(index, position);
}

// node_modules/.pnpm/stylis@4.3.6/node_modules/stylis/src/Parser.js
function compile(value) {
  return dealloc(parse("", null, null, null, [""], value = alloc(value), 0, [0], value));
}
function parse(value, root, parent, rule, rules, rulesets, pseudo, points, declarations) {
  var index = 0;
  var offset = 0;
  var length2 = pseudo;
  var atrule = 0;
  var property = 0;
  var previous = 0;
  var variable = 1;
  var scanning = 1;
  var ampersand = 1;
  var character2 = 0;
  var type = "";
  var props = rules;
  var children = rulesets;
  var reference = rule;
  var characters2 = type;
  while (scanning)
    switch (previous = character2, character2 = next()) {
      case 40:
        if (previous != 108 && charat(characters2, length2 - 1) == 58) {
          if (indexof(characters2 += replace(delimit(character2), "&", "&\f"), "&\f", abs(index ? points[index - 1] : 0)) != -1)
            ampersand = -1;
          break;
        }
      case 34:
      case 39:
      case 91:
        characters2 += delimit(character2);
        break;
      case 9:
      case 10:
      case 13:
      case 32:
        characters2 += whitespace(previous);
        break;
      case 92:
        characters2 += escaping(caret() - 1, 7);
        continue;
      case 47:
        switch (peek()) {
          case 42:
          case 47:
            append(comment(commenter(next(), caret()), root, parent, declarations), declarations);
            if ((token(previous || 1) == 5 || token(peek() || 1) == 5) && strlen(characters2) && substr(characters2, -1, void 0) !== " ") characters2 += " ";
            break;
          default:
            characters2 += "/";
        }
        break;
      case 123 * variable:
        points[index++] = strlen(characters2) * ampersand;
      case 125 * variable:
      case 59:
      case 0:
        switch (character2) {
          case 0:
          case 125:
            scanning = 0;
          case 59 + offset:
            if (ampersand == -1) characters2 = replace(characters2, /\f/g, "");
            if (property > 0 && (strlen(characters2) - length2 || variable === 0 && previous === 47))
              append(property > 32 ? declaration(characters2 + ";", rule, parent, length2 - 1, declarations) : declaration(replace(characters2, " ", "") + ";", rule, parent, length2 - 2, declarations), declarations);
            break;
          case 59:
            characters2 += ";";
          default:
            append(reference = ruleset(characters2, root, parent, index, offset, rules, points, type, props = [], children = [], length2, rulesets), rulesets);
            if (character2 === 123)
              if (offset === 0)
                parse(characters2, root, reference, reference, props, rulesets, length2, points, children);
              else {
                switch (atrule) {
                  case 99:
                    if (charat(characters2, 3) === 110) break;
                  case 108:
                    if (charat(characters2, 2) === 97) break;
                  default:
                    offset = 0;
                  case 100:
                  case 109:
                  case 115:
                }
                if (offset) parse(value, reference, reference, rule && append(ruleset(value, reference, reference, 0, 0, rules, points, type, rules, props = [], length2, children), children), rules, children, length2, points, rule ? props : children);
                else parse(characters2, reference, reference, reference, [""], children, 0, points, children);
              }
        }
        index = offset = property = 0, variable = ampersand = 1, type = characters2 = "", length2 = pseudo;
        break;
      case 58:
        length2 = 1 + strlen(characters2), property = previous;
      default:
        if (variable < 1) {
          if (character2 == 123)
            --variable;
          else if (character2 == 125 && variable++ == 0 && prev() == 125)
            continue;
        }
        switch (characters2 += from(character2), character2 * variable) {
          case 38:
            ampersand = offset > 0 ? 1 : (characters2 += "\f", -1);
            break;
          case 44:
            points[index++] = (strlen(characters2) - 1) * ampersand, ampersand = 1;
            break;
          case 64:
            if (peek() === 45)
              characters2 += delimit(next());
            atrule = peek(), offset = length2 = strlen(type = characters2 += identifier(caret())), character2++;
            break;
          case 45:
            if (previous === 45 && strlen(characters2) == 2)
              variable = 0;
        }
    }
  return rulesets;
}
function ruleset(value, root, parent, index, offset, rules, points, type, props, children, length2, siblings) {
  var post = offset - 1;
  var rule = offset === 0 ? rules : [""];
  var size = sizeof(rule);
  for (var i = 0, j = 0, k = 0; i < index; ++i)
    for (var x = 0, y = substr(value, post + 1, post = abs(j = points[i])), z = value; x < size; ++x)
      if (z = trim(j > 0 ? rule[x] + " " + y : replace(y, /&\f/g, rule[x])))
        props[k++] = z;
  return node(value, root, parent, offset === 0 ? RULESET : type, props, children, length2, siblings);
}
function comment(value, root, parent, siblings) {
  return node(value, root, parent, COMMENT, from(char()), substr(value, 2, -2), 0, siblings);
}
function declaration(value, root, parent, length2, siblings) {
  return node(value, root, parent, DECLARATION, substr(value, 0, length2), substr(value, length2 + 1, -1), length2, siblings);
}

// node_modules/.pnpm/stylis@4.3.6/node_modules/stylis/src/Serializer.js
function serialize(children, callback) {
  var output = "";
  for (var i = 0; i < children.length; i++)
    output += callback(children[i], i, children, callback) || "";
  return output;
}
function stringify(element, index, children, callback) {
  switch (element.type) {
    case LAYER:
      if (element.children.length) break;
    case IMPORT:
    case NAMESPACE:
    case DECLARATION:
      return element.return = element.return || element.value;
    case COMMENT:
      return "";
    case KEYFRAMES:
      return element.return = element.value + "{" + serialize(element.children, callback) + "}";
    case RULESET:
      if (!strlen(element.value = element.props.join(","))) return "";
  }
  return strlen(children = serialize(element.children, callback)) ? element.return = element.value + "{" + children + "}" : "";
}

// node_modules/.pnpm/mermaid@11.13.0/node_modules/mermaid/dist/mermaid.core.mjs
var id = "c4";
var detector = /* @__PURE__ */ __name((txt) => {
  return /^\s*C4Context|C4Container|C4Component|C4Dynamic|C4Deployment/.test(txt);
}, "detector");
var loader = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./c4Diagram-IC4MRINW-3BKBVLQT.js");
  return { id, diagram: diagram2 };
}, "loader");
var plugin = {
  id,
  detector,
  loader
};
var c4Detector_default = plugin;
var id2 = "flowchart";
var detector2 = /* @__PURE__ */ __name((txt, config) => {
  if (config?.flowchart?.defaultRenderer === "dagre-wrapper" || config?.flowchart?.defaultRenderer === "elk") {
    return false;
  }
  return /^\s*graph/.test(txt);
}, "detector");
var loader2 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./flowDiagram-PKNHOUZH-ED2FVBH4.js");
  return { id: id2, diagram: diagram2 };
}, "loader");
var plugin2 = {
  id: id2,
  detector: detector2,
  loader: loader2
};
var flowDetector_default = plugin2;
var id3 = "flowchart-v2";
var detector3 = /* @__PURE__ */ __name((txt, config) => {
  if (config?.flowchart?.defaultRenderer === "dagre-d3") {
    return false;
  }
  if (config?.flowchart?.defaultRenderer === "elk") {
    config.layout = "elk";
  }
  if (/^\s*graph/.test(txt) && config?.flowchart?.defaultRenderer === "dagre-wrapper") {
    return true;
  }
  return /^\s*flowchart/.test(txt);
}, "detector");
var loader3 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./flowDiagram-PKNHOUZH-ED2FVBH4.js");
  return { id: id3, diagram: diagram2 };
}, "loader");
var plugin3 = {
  id: id3,
  detector: detector3,
  loader: loader3
};
var flowDetector_v2_default = plugin3;
var id4 = "er";
var detector4 = /* @__PURE__ */ __name((txt) => {
  return /^\s*erDiagram/.test(txt);
}, "detector");
var loader4 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./erDiagram-INFDFZHY-YSM7IAWY.js");
  return { id: id4, diagram: diagram2 };
}, "loader");
var plugin4 = {
  id: id4,
  detector: detector4,
  loader: loader4
};
var erDetector_default = plugin4;
var id5 = "gitGraph";
var detector5 = /* @__PURE__ */ __name((txt) => {
  return /^\s*gitGraph/.test(txt);
}, "detector");
var loader5 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./gitGraphDiagram-K3NZZRJ6-RLWBMKC7.js");
  return { id: id5, diagram: diagram2 };
}, "loader");
var plugin5 = {
  id: id5,
  detector: detector5,
  loader: loader5
};
var gitGraphDetector_default = plugin5;
var id6 = "gantt";
var detector6 = /* @__PURE__ */ __name((txt) => {
  return /^\s*gantt/.test(txt);
}, "detector");
var loader6 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./ganttDiagram-A5KZAMGK-XHM4YOR3.js");
  return { id: id6, diagram: diagram2 };
}, "loader");
var plugin6 = {
  id: id6,
  detector: detector6,
  loader: loader6
};
var ganttDetector_default = plugin6;
var id7 = "info";
var detector7 = /* @__PURE__ */ __name((txt) => {
  return /^\s*info/.test(txt);
}, "detector");
var loader7 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./infoDiagram-LFFYTUFH-A7WXNXWU.js");
  return { id: id7, diagram: diagram2 };
}, "loader");
var info = {
  id: id7,
  detector: detector7,
  loader: loader7
};
var id8 = "pie";
var detector8 = /* @__PURE__ */ __name((txt) => {
  return /^\s*pie/.test(txt);
}, "detector");
var loader8 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./pieDiagram-SKSYHLDU-FX6G6ODI.js");
  return { id: id8, diagram: diagram2 };
}, "loader");
var pie = {
  id: id8,
  detector: detector8,
  loader: loader8
};
var id9 = "quadrantChart";
var detector9 = /* @__PURE__ */ __name((txt) => {
  return /^\s*quadrantChart/.test(txt);
}, "detector");
var loader9 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./quadrantDiagram-337W2JSQ-N4Y3RRKD.js");
  return { id: id9, diagram: diagram2 };
}, "loader");
var plugin7 = {
  id: id9,
  detector: detector9,
  loader: loader9
};
var quadrantDetector_default = plugin7;
var id10 = "xychart";
var detector10 = /* @__PURE__ */ __name((txt) => {
  return /^\s*xychart(-beta)?/.test(txt);
}, "detector");
var loader10 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./xychartDiagram-JWTSCODW-7KXBX6AK.js");
  return { id: id10, diagram: diagram2 };
}, "loader");
var plugin8 = {
  id: id10,
  detector: detector10,
  loader: loader10
};
var xychartDetector_default = plugin8;
var id11 = "requirement";
var detector11 = /* @__PURE__ */ __name((txt) => {
  return /^\s*requirement(Diagram)?/.test(txt);
}, "detector");
var loader11 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./requirementDiagram-Z7DCOOCP-SAI7MNPD.js");
  return { id: id11, diagram: diagram2 };
}, "loader");
var plugin9 = {
  id: id11,
  detector: detector11,
  loader: loader11
};
var requirementDetector_default = plugin9;
var id12 = "sequence";
var detector12 = /* @__PURE__ */ __name((txt) => {
  return /^\s*sequenceDiagram/.test(txt);
}, "detector");
var loader12 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./sequenceDiagram-2WXFIKYE-RFZSWP5O.js");
  return { id: id12, diagram: diagram2 };
}, "loader");
var plugin10 = {
  id: id12,
  detector: detector12,
  loader: loader12
};
var sequenceDetector_default = plugin10;
var id13 = "class";
var detector13 = /* @__PURE__ */ __name((txt, config) => {
  if (config?.class?.defaultRenderer === "dagre-wrapper") {
    return false;
  }
  return /^\s*classDiagram/.test(txt);
}, "detector");
var loader13 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./classDiagram-VBA2DB6C-C6LQ2AJE.js");
  return { id: id13, diagram: diagram2 };
}, "loader");
var plugin11 = {
  id: id13,
  detector: detector13,
  loader: loader13
};
var classDetector_default = plugin11;
var id14 = "classDiagram";
var detector14 = /* @__PURE__ */ __name((txt, config) => {
  if (/^\s*classDiagram/.test(txt) && config?.class?.defaultRenderer === "dagre-wrapper") {
    return true;
  }
  return /^\s*classDiagram-v2/.test(txt);
}, "detector");
var loader14 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./classDiagram-v2-RAHNMMFH-RQMMOCBL.js");
  return { id: id14, diagram: diagram2 };
}, "loader");
var plugin12 = {
  id: id14,
  detector: detector14,
  loader: loader14
};
var classDetector_V2_default = plugin12;
var id15 = "state";
var detector15 = /* @__PURE__ */ __name((txt, config) => {
  if (config?.state?.defaultRenderer === "dagre-wrapper") {
    return false;
  }
  return /^\s*stateDiagram/.test(txt);
}, "detector");
var loader15 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./stateDiagram-RAJIS63D-4P4CWPM5.js");
  return { id: id15, diagram: diagram2 };
}, "loader");
var plugin13 = {
  id: id15,
  detector: detector15,
  loader: loader15
};
var stateDetector_default = plugin13;
var id16 = "stateDiagram";
var detector16 = /* @__PURE__ */ __name((txt, config) => {
  if (/^\s*stateDiagram-v2/.test(txt)) {
    return true;
  }
  if (/^\s*stateDiagram/.test(txt) && config?.state?.defaultRenderer === "dagre-wrapper") {
    return true;
  }
  return false;
}, "detector");
var loader16 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./stateDiagram-v2-FVOUBMTO-TB7DEUNM.js");
  return { id: id16, diagram: diagram2 };
}, "loader");
var plugin14 = {
  id: id16,
  detector: detector16,
  loader: loader16
};
var stateDetector_V2_default = plugin14;
var id17 = "journey";
var detector17 = /* @__PURE__ */ __name((txt) => {
  return /^\s*journey/.test(txt);
}, "detector");
var loader17 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./journeyDiagram-4ABVD52K-YEFYBMV4.js");
  return { id: id17, diagram: diagram2 };
}, "loader");
var plugin15 = {
  id: id17,
  detector: detector17,
  loader: loader17
};
var journeyDetector_default = plugin15;
var draw = /* @__PURE__ */ __name((_text, id30, version) => {
  log.debug("rendering svg for syntax error\n");
  const svg = selectSvgElement(id30);
  const g = svg.append("g");
  svg.attr("viewBox", "0 0 2412 512");
  configureSvgSize(svg, 100, 512, true);
  g.append("path").attr("class", "error-icon").attr(
    "d",
    "m411.313,123.313c6.25-6.25 6.25-16.375 0-22.625s-16.375-6.25-22.625,0l-32,32-9.375,9.375-20.688-20.688c-12.484-12.5-32.766-12.5-45.25,0l-16,16c-1.261,1.261-2.304,2.648-3.31,4.051-21.739-8.561-45.324-13.426-70.065-13.426-105.867,0-192,86.133-192,192s86.133,192 192,192 192-86.133 192-192c0-24.741-4.864-48.327-13.426-70.065 1.402-1.007 2.79-2.049 4.051-3.31l16-16c12.5-12.492 12.5-32.758 0-45.25l-20.688-20.688 9.375-9.375 32.001-31.999zm-219.313,100.687c-52.938,0-96,43.063-96,96 0,8.836-7.164,16-16,16s-16-7.164-16-16c0-70.578 57.422-128 128-128 8.836,0 16,7.164 16,16s-7.164,16-16,16z"
  );
  g.append("path").attr("class", "error-icon").attr(
    "d",
    "m459.02,148.98c-6.25-6.25-16.375-6.25-22.625,0s-6.25,16.375 0,22.625l16,16c3.125,3.125 7.219,4.688 11.313,4.688 4.094,0 8.188-1.563 11.313-4.688 6.25-6.25 6.25-16.375 0-22.625l-16.001-16z"
  );
  g.append("path").attr("class", "error-icon").attr(
    "d",
    "m340.395,75.605c3.125,3.125 7.219,4.688 11.313,4.688 4.094,0 8.188-1.563 11.313-4.688 6.25-6.25 6.25-16.375 0-22.625l-16-16c-6.25-6.25-16.375-6.25-22.625,0s-6.25,16.375 0,22.625l15.999,16z"
  );
  g.append("path").attr("class", "error-icon").attr(
    "d",
    "m400,64c8.844,0 16-7.164 16-16v-32c0-8.836-7.156-16-16-16-8.844,0-16,7.164-16,16v32c0,8.836 7.156,16 16,16z"
  );
  g.append("path").attr("class", "error-icon").attr(
    "d",
    "m496,96.586h-32c-8.844,0-16,7.164-16,16 0,8.836 7.156,16 16,16h32c8.844,0 16-7.164 16-16 0-8.836-7.156-16-16-16z"
  );
  g.append("path").attr("class", "error-icon").attr(
    "d",
    "m436.98,75.605c3.125,3.125 7.219,4.688 11.313,4.688 4.094,0 8.188-1.563 11.313-4.688l32-32c6.25-6.25 6.25-16.375 0-22.625s-16.375-6.25-22.625,0l-32,32c-6.251,6.25-6.251,16.375-0.001,22.625z"
  );
  g.append("text").attr("class", "error-text").attr("x", 1440).attr("y", 250).attr("font-size", "150px").style("text-anchor", "middle").text("Syntax error in text");
  g.append("text").attr("class", "error-text").attr("x", 1250).attr("y", 400).attr("font-size", "100px").style("text-anchor", "middle").text(`mermaid version ${version}`);
}, "draw");
var renderer = { draw };
var errorRenderer_default = renderer;
var diagram = {
  db: {},
  renderer,
  parser: {
    parse: /* @__PURE__ */ __name(() => {
      return;
    }, "parse")
  }
};
var errorDiagram_default = diagram;
var id18 = "flowchart-elk";
var detector18 = /* @__PURE__ */ __name((txt, config = {}) => {
  if (
    // If diagram explicitly states flowchart-elk
    /^\s*flowchart-elk/.test(txt) || // If a flowchart/graph diagram has their default renderer set to elk
    /^\s*(flowchart|graph)/.test(txt) && config?.flowchart?.defaultRenderer === "elk"
  ) {
    config.layout = "elk";
    return true;
  }
  return false;
}, "detector");
var loader18 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./flowDiagram-PKNHOUZH-ED2FVBH4.js");
  return { id: id18, diagram: diagram2 };
}, "loader");
var plugin16 = {
  id: id18,
  detector: detector18,
  loader: loader18
};
var detector_default = plugin16;
var id19 = "timeline";
var detector19 = /* @__PURE__ */ __name((txt) => {
  return /^\s*timeline/.test(txt);
}, "detector");
var loader19 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./timeline-definition-YZTLITO2-K4FPDRYR.js");
  return { id: id19, diagram: diagram2 };
}, "loader");
var plugin17 = {
  id: id19,
  detector: detector19,
  loader: loader19
};
var detector_default2 = plugin17;
var id20 = "mindmap";
var detector20 = /* @__PURE__ */ __name((txt) => {
  return /^\s*mindmap/.test(txt);
}, "detector");
var loader20 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./mindmap-definition-YRQLILUH-KGXM7ART.js");
  return { id: id20, diagram: diagram2 };
}, "loader");
var plugin18 = {
  id: id20,
  detector: detector20,
  loader: loader20
};
var detector_default3 = plugin18;
var id21 = "kanban";
var detector21 = /* @__PURE__ */ __name((txt) => {
  return /^\s*kanban/.test(txt);
}, "detector");
var loader21 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./kanban-definition-K7BYSVSG-3PCWIIGN.js");
  return { id: id21, diagram: diagram2 };
}, "loader");
var plugin19 = {
  id: id21,
  detector: detector21,
  loader: loader21
};
var detector_default4 = plugin19;
var id22 = "sankey";
var detector22 = /* @__PURE__ */ __name((txt) => {
  return /^\s*sankey(-beta)?/.test(txt);
}, "detector");
var loader22 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./sankeyDiagram-WA2Y5GQK-7A5PPQUH.js");
  return { id: id22, diagram: diagram2 };
}, "loader");
var plugin20 = {
  id: id22,
  detector: detector22,
  loader: loader22
};
var sankeyDetector_default = plugin20;
var id23 = "packet";
var detector23 = /* @__PURE__ */ __name((txt) => {
  return /^\s*packet(-beta)?/.test(txt);
}, "detector");
var loader23 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./diagram-P4PSJMXO-FHEXRP56.js");
  return { id: id23, diagram: diagram2 };
}, "loader");
var packet = {
  id: id23,
  detector: detector23,
  loader: loader23
};
var id24 = "radar";
var detector24 = /* @__PURE__ */ __name((txt) => {
  return /^\s*radar-beta/.test(txt);
}, "detector");
var loader24 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./diagram-IFDJBPK2-E2KN4A4C.js");
  return { id: id24, diagram: diagram2 };
}, "loader");
var radar = {
  id: id24,
  detector: detector24,
  loader: loader24
};
var id25 = "block";
var detector25 = /* @__PURE__ */ __name((txt) => {
  return /^\s*block(-beta)?/.test(txt);
}, "detector");
var loader25 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./blockDiagram-WCTKOSBZ-Z4R5NYUS.js");
  return { id: id25, diagram: diagram2 };
}, "loader");
var plugin21 = {
  id: id25,
  detector: detector25,
  loader: loader25
};
var blockDetector_default = plugin21;
var id26 = "architecture";
var detector26 = /* @__PURE__ */ __name((txt) => {
  return /^\s*architecture/.test(txt);
}, "detector");
var loader26 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./architectureDiagram-2XIMDMQ5-VO3N3FO4.js");
  return { id: id26, diagram: diagram2 };
}, "loader");
var architecture = {
  id: id26,
  detector: detector26,
  loader: loader26
};
var architectureDetector_default = architecture;
var id27 = "ishikawa";
var detector27 = /* @__PURE__ */ __name((txt) => {
  return /^\s*ishikawa(-beta)?\b/i.test(txt);
}, "detector");
var loader27 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./ishikawaDiagram-PHBUUO56-OCLTYEXI.js");
  return { id: id27, diagram: diagram2 };
}, "loader");
var ishikawa = {
  id: id27,
  detector: detector27,
  loader: loader27
};
var id28 = "venn";
var detector28 = /* @__PURE__ */ __name((txt) => {
  return /^\s*venn-beta/.test(txt);
}, "detector");
var loader28 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./vennDiagram-LZ73GAT5-WRVGIPO6.js");
  return { id: id28, diagram: diagram2 };
}, "loader");
var plugin22 = {
  id: id28,
  detector: detector28,
  loader: loader28
};
var vennDetector_default = plugin22;
var id29 = "treemap";
var detector29 = /* @__PURE__ */ __name((txt) => {
  return /^\s*treemap/.test(txt);
}, "detector");
var loader29 = /* @__PURE__ */ __name(async () => {
  const { diagram: diagram2 } = await import("./diagram-E7M64L7V-X6OVMV3T.js");
  return { id: id29, diagram: diagram2 };
}, "loader");
var treemap = {
  id: id29,
  detector: detector29,
  loader: loader29
};
var hasLoadedDiagrams = false;
var addDiagrams = /* @__PURE__ */ __name(() => {
  if (hasLoadedDiagrams) {
    return;
  }
  hasLoadedDiagrams = true;
  registerDiagram("error", errorDiagram_default, (text) => {
    return text.toLowerCase().trim() === "error";
  });
  registerDiagram(
    "---",
    // --- diagram type may appear if YAML front-matter is not parsed correctly
    {
      db: {
        clear: /* @__PURE__ */ __name(() => {
        }, "clear")
      },
      styles: {},
      // should never be used
      renderer: {
        draw: /* @__PURE__ */ __name(() => {
        }, "draw")
      },
      parser: {
        parse: /* @__PURE__ */ __name(() => {
          throw new Error(
            "Diagrams beginning with --- are not valid. If you were trying to use a YAML front-matter, please ensure that you've correctly opened and closed the YAML front-matter with un-indented `---` blocks"
          );
        }, "parse")
      },
      init: /* @__PURE__ */ __name(() => null, "init")
      // no op
    },
    (text) => {
      return text.toLowerCase().trimStart().startsWith("---");
    }
  );
  if (true) {
    registerLazyLoadedDiagrams(detector_default, detector_default3, architectureDetector_default);
  }
  registerLazyLoadedDiagrams(
    c4Detector_default,
    detector_default4,
    classDetector_V2_default,
    classDetector_default,
    erDetector_default,
    ganttDetector_default,
    info,
    pie,
    requirementDetector_default,
    sequenceDetector_default,
    flowDetector_v2_default,
    flowDetector_default,
    detector_default2,
    gitGraphDetector_default,
    stateDetector_V2_default,
    stateDetector_default,
    journeyDetector_default,
    quadrantDetector_default,
    sankeyDetector_default,
    packet,
    xychartDetector_default,
    blockDetector_default,
    radar,
    ishikawa,
    treemap,
    vennDetector_default
  );
}, "addDiagrams");
var loadRegisteredDiagrams = /* @__PURE__ */ __name(async () => {
  log.debug(`Loading registered diagrams`);
  const results = await Promise.allSettled(
    Object.entries(detectors).map(async ([key, { detector: detector30, loader: loader30 }]) => {
      if (!loader30) {
        return;
      }
      try {
        getDiagram(key);
      } catch {
        try {
          const { diagram: diagram2, id: id30 } = await loader30();
          registerDiagram(id30, diagram2, detector30);
        } catch (err) {
          log.error(`Failed to load external diagram with key ${key}. Removing from detectors.`);
          delete detectors[key];
          throw err;
        }
      }
    })
  );
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    log.error(`Failed to load ${failed.length} external diagrams`);
    for (const res of failed) {
      log.error(res);
    }
    throw new Error(`Failed to load ${failed.length} external diagrams`);
  }
}, "loadRegisteredDiagrams");
var SVG_ROLE = "graphics-document document";
function setA11yDiagramInfo(svg, diagramType) {
  svg.attr("role", SVG_ROLE);
  if (diagramType !== "") {
    svg.attr("aria-roledescription", diagramType);
  }
}
__name(setA11yDiagramInfo, "setA11yDiagramInfo");
function addSVGa11yTitleDescription(svg, a11yTitle, a11yDesc, baseId) {
  if (svg.insert === void 0) {
    return;
  }
  if (a11yDesc) {
    const descId = `chart-desc-${baseId}`;
    svg.attr("aria-describedby", descId);
    svg.insert("desc", ":first-child").attr("id", descId).text(a11yDesc);
  }
  if (a11yTitle) {
    const titleId = `chart-title-${baseId}`;
    svg.attr("aria-labelledby", titleId);
    svg.insert("title", ":first-child").attr("id", titleId).text(a11yTitle);
  }
}
__name(addSVGa11yTitleDescription, "addSVGa11yTitleDescription");
var Diagram = class _Diagram {
  constructor(type, text, db, parser, renderer2) {
    this.type = type;
    this.text = text;
    this.db = db;
    this.parser = parser;
    this.renderer = renderer2;
  }
  static {
    __name(this, "Diagram");
  }
  static async fromText(text, metadata = {}) {
    const config = getConfig();
    const type = detectType(text, config);
    text = encodeEntities(text) + "\n";
    try {
      getDiagram(type);
    } catch {
      const loader30 = getDiagramLoader(type);
      if (!loader30) {
        throw new UnknownDiagramError(`Diagram ${type} not found.`);
      }
      const { id: id30, diagram: diagram2 } = await loader30();
      registerDiagram(id30, diagram2);
    }
    const { db, parser, renderer: renderer2, init: init2 } = getDiagram(type);
    if (parser.parser) {
      parser.parser.yy = db;
    }
    db.clear?.();
    init2?.(config);
    if (metadata.title) {
      db.setDiagramTitle?.(metadata.title);
    }
    await parser.parse(text);
    return new _Diagram(type, text, db, parser, renderer2);
  }
  async render(id30, version) {
    await this.renderer.draw(this.text, id30, version, this);
  }
  getParser() {
    return this.parser;
  }
  getType() {
    return this.type;
  }
};
var interactionFunctions = [];
var attachFunctions = /* @__PURE__ */ __name(() => {
  interactionFunctions.forEach((f) => {
    f();
  });
  interactionFunctions = [];
}, "attachFunctions");
var cleanupComments = /* @__PURE__ */ __name((text) => {
  return text.replace(/^\s*%%(?!{)[^\n]+\n?/gm, "").trimStart();
}, "cleanupComments");
function extractFrontMatter(text) {
  const matches = text.match(frontMatterRegex);
  if (!matches) {
    return {
      text,
      metadata: {}
    };
  }
  let parsed = load(matches[1], {
    // To support config, we need JSON schema.
    // https://www.yaml.org/spec/1.2/spec.html#id2803231
    schema: JSON_SCHEMA
  }) ?? {};
  parsed = typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const metadata = {};
  if (parsed.displayMode) {
    metadata.displayMode = parsed.displayMode.toString();
  }
  if (parsed.title) {
    metadata.title = parsed.title.toString();
  }
  if (parsed.config) {
    metadata.config = parsed.config;
  }
  return {
    text: text.slice(matches[0].length),
    metadata
  };
}
__name(extractFrontMatter, "extractFrontMatter");
var cleanupText = /* @__PURE__ */ __name((code) => {
  return code.replace(/\r\n?/g, "\n").replace(
    /<(\w+)([^>]*)>/g,
    (match, tag, attributes) => "<" + tag + attributes.replace(/="([^"]*)"/g, "='$1'") + ">"
  );
}, "cleanupText");
var processFrontmatter = /* @__PURE__ */ __name((code) => {
  const { text, metadata } = extractFrontMatter(code);
  const { displayMode, title, config = {} } = metadata;
  if (displayMode) {
    if (!config.gantt) {
      config.gantt = {};
    }
    config.gantt.displayMode = displayMode;
  }
  return { title, config, text };
}, "processFrontmatter");
var processDirectives = /* @__PURE__ */ __name((code) => {
  const initDirective = utils_default.detectInit(code) ?? {};
  const wrapDirectives = utils_default.detectDirective(code, "wrap");
  if (Array.isArray(wrapDirectives)) {
    initDirective.wrap = wrapDirectives.some(({ type }) => type === "wrap");
  } else if (wrapDirectives?.type === "wrap") {
    initDirective.wrap = true;
  }
  return {
    text: removeDirectives(code),
    directive: initDirective
  };
}, "processDirectives");
function preprocessDiagram(code) {
  const cleanedCode = cleanupText(code);
  const frontMatterResult = processFrontmatter(cleanedCode);
  const directiveResult = processDirectives(frontMatterResult.text);
  const config = cleanAndMerge(frontMatterResult.config, directiveResult.directive);
  code = cleanupComments(directiveResult.text);
  return {
    code,
    title: frontMatterResult.title,
    config
  };
}
__name(preprocessDiagram, "preprocessDiagram");
function toBase64(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  const utf8Str = Array.from(utf8Bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(utf8Str);
}
__name(toBase64, "toBase64");
var MAX_TEXTLENGTH = 5e4;
var MAX_TEXTLENGTH_EXCEEDED_MSG = "graph TB;a[Maximum text size in diagram exceeded];style a fill:#faa";
var SECURITY_LVL_SANDBOX = "sandbox";
var SECURITY_LVL_LOOSE = "loose";
var XMLNS_SVG_STD = "http://www.w3.org/2000/svg";
var XMLNS_XLINK_STD = "http://www.w3.org/1999/xlink";
var XMLNS_XHTML_STD = "http://www.w3.org/1999/xhtml";
var IFRAME_WIDTH = "100%";
var IFRAME_HEIGHT = "100%";
var IFRAME_STYLES = "border:0;margin:0;";
var IFRAME_BODY_STYLE = "margin:0";
var IFRAME_SANDBOX_OPTS = "allow-top-navigation-by-user-activation allow-popups";
var IFRAME_NOT_SUPPORTED_MSG = 'The "iframe" tag is not supported by your browser.';
var DOMPURIFY_TAGS = ["foreignobject"];
var DOMPURIFY_ATTR = ["dominant-baseline"];
function processAndSetConfigs(text) {
  const processed = preprocessDiagram(text);
  reset();
  addDirective(processed.config ?? {});
  return processed;
}
__name(processAndSetConfigs, "processAndSetConfigs");
async function parse2(text, parseOptions) {
  addDiagrams();
  try {
    const { code, config } = processAndSetConfigs(text);
    const diagram2 = await getDiagramFromText(code);
    return { diagramType: diagram2.type, config };
  } catch (error) {
    if (parseOptions?.suppressErrors) {
      return false;
    }
    throw error;
  }
}
__name(parse2, "parse");
var cssImportantStyles = /* @__PURE__ */ __name((cssClass, element, cssClasses = []) => {
  return `
.${cssClass} ${element} { ${cssClasses.join(" !important; ")} !important; }`;
}, "cssImportantStyles");
var createCssStyles = /* @__PURE__ */ __name((config, classDefs = /* @__PURE__ */ new Map()) => {
  let cssStyles = "";
  if (config.themeCSS !== void 0) {
    cssStyles += `
${config.themeCSS}`;
  }
  if (config.fontFamily !== void 0) {
    cssStyles += `
:root { --mermaid-font-family: ${config.fontFamily}}`;
  }
  if (config.altFontFamily !== void 0) {
    cssStyles += `
:root { --mermaid-alt-font-family: ${config.altFontFamily}}`;
  }
  if (classDefs instanceof Map) {
    const htmlLabels = getEffectiveHtmlLabels(config);
    const cssHtmlElements = ["> *", "span"];
    const cssShapeElements = ["rect", "polygon", "ellipse", "circle", "path"];
    const cssElements = htmlLabels ? cssHtmlElements : cssShapeElements;
    classDefs.forEach((styleClassDef) => {
      if (!isEmpty_default(styleClassDef.styles)) {
        cssElements.forEach((cssElement) => {
          cssStyles += cssImportantStyles(styleClassDef.id, cssElement, styleClassDef.styles);
        });
      }
      if (!isEmpty_default(styleClassDef.textStyles)) {
        cssStyles += cssImportantStyles(
          styleClassDef.id,
          "tspan",
          (styleClassDef?.textStyles || []).map((s) => s.replace("color", "fill"))
        );
      }
    });
  }
  return cssStyles;
}, "createCssStyles");
var createUserStyles = /* @__PURE__ */ __name((config, graphType, classDefs, svgId) => {
  const userCSSstyles = createCssStyles(config, classDefs);
  const allStyles = styles_default(graphType, userCSSstyles, config.themeVariables);
  return serialize(compile(`${svgId}{${allStyles}}`), stringify);
}, "createUserStyles");
var cleanUpSvgCode = /* @__PURE__ */ __name((svgCode = "", inSandboxMode, useArrowMarkerUrls) => {
  let cleanedUpSvg = svgCode;
  if (!useArrowMarkerUrls && !inSandboxMode) {
    cleanedUpSvg = cleanedUpSvg.replace(
      /marker-end="url\([\d+./:=?A-Za-z-]*?#/g,
      'marker-end="url(#'
    );
  }
  cleanedUpSvg = decodeEntities(cleanedUpSvg);
  cleanedUpSvg = cleanedUpSvg.replace(/<br>/g, "<br/>");
  return cleanedUpSvg;
}, "cleanUpSvgCode");
var putIntoIFrame = /* @__PURE__ */ __name((svgCode = "", svgElement) => {
  const height = svgElement?.viewBox?.baseVal?.height ? svgElement.viewBox.baseVal.height + "px" : IFRAME_HEIGHT;
  const base64encodedSrc = toBase64(`<body style="${IFRAME_BODY_STYLE}">${svgCode}</body>`);
  return `<iframe style="width:${IFRAME_WIDTH};height:${height};${IFRAME_STYLES}" src="data:text/html;charset=UTF-8;base64,${base64encodedSrc}" sandbox="${IFRAME_SANDBOX_OPTS}">
  ${IFRAME_NOT_SUPPORTED_MSG}
</iframe>`;
}, "putIntoIFrame");
var appendDivSvgG = /* @__PURE__ */ __name((parentRoot, id30, enclosingDivId, divStyle, svgXlink) => {
  const enclosingDiv = parentRoot.append("div");
  enclosingDiv.attr("id", enclosingDivId);
  if (divStyle) {
    enclosingDiv.attr("style", divStyle);
  }
  const svgNode = enclosingDiv.append("svg").attr("id", id30).attr("width", "100%").attr("xmlns", XMLNS_SVG_STD);
  if (svgXlink) {
    svgNode.attr("xmlns:xlink", svgXlink);
  }
  svgNode.append("g");
  return parentRoot;
}, "appendDivSvgG");
function sandboxedIframe(parentNode, iFrameId) {
  return parentNode.append("iframe").attr("id", iFrameId).attr("style", "width: 100%; height: 100%;").attr("sandbox", "");
}
__name(sandboxedIframe, "sandboxedIframe");
var removeExistingElements = /* @__PURE__ */ __name((doc, id30, divId, iFrameId) => {
  doc.getElementById(id30)?.remove();
  doc.getElementById(divId)?.remove();
  doc.getElementById(iFrameId)?.remove();
}, "removeExistingElements");
var render = /* @__PURE__ */ __name(async function(id30, text, svgContainingElement) {
  addDiagrams();
  const processed = processAndSetConfigs(text);
  text = processed.code;
  const config = getConfig();
  log.debug(config);
  if (text.length > (config?.maxTextSize ?? MAX_TEXTLENGTH)) {
    text = MAX_TEXTLENGTH_EXCEEDED_MSG;
  }
  const idSelector = "#" + id30;
  const iFrameID = "i" + id30;
  const iFrameID_selector = "#" + iFrameID;
  const enclosingDivID = "d" + id30;
  const enclosingDivID_selector = "#" + enclosingDivID;
  const removeTempElements = /* @__PURE__ */ __name(() => {
    const tmpElementSelector = isSandboxed ? iFrameID_selector : enclosingDivID_selector;
    const node2 = select_default(tmpElementSelector).node();
    if (node2 && "remove" in node2) {
      node2.remove();
    }
  }, "removeTempElements");
  let root = select_default("body");
  const isSandboxed = config.securityLevel === SECURITY_LVL_SANDBOX;
  const isLooseSecurityLevel = config.securityLevel === SECURITY_LVL_LOOSE;
  const fontFamily = config.fontFamily;
  if (svgContainingElement !== void 0) {
    if (svgContainingElement) {
      svgContainingElement.innerHTML = "";
    }
    if (isSandboxed) {
      const iframe = sandboxedIframe(select_default(svgContainingElement), iFrameID);
      root = select_default(iframe.nodes()[0].contentDocument.body);
      root.node().style.margin = 0;
    } else {
      root = select_default(svgContainingElement);
    }
    appendDivSvgG(root, id30, enclosingDivID, `font-family: ${fontFamily}`, XMLNS_XLINK_STD);
  } else {
    removeExistingElements(document, id30, enclosingDivID, iFrameID);
    if (isSandboxed) {
      const iframe = sandboxedIframe(select_default("body"), iFrameID);
      root = select_default(iframe.nodes()[0].contentDocument.body);
      root.node().style.margin = 0;
    } else {
      root = select_default("body");
    }
    appendDivSvgG(root, id30, enclosingDivID);
  }
  let diag;
  let parseEncounteredException;
  try {
    diag = await Diagram.fromText(text, { title: processed.title });
  } catch (error) {
    if (config.suppressErrorRendering) {
      removeTempElements();
      throw error;
    }
    diag = await Diagram.fromText("error");
    parseEncounteredException = error;
  }
  const element = root.select(enclosingDivID_selector).node();
  const diagramType = diag.type;
  const svg = element.firstChild;
  const firstChild = svg.firstChild;
  const diagramClassDefs = diag.renderer.getClasses?.(text, diag);
  const rules = createUserStyles(config, diagramType, diagramClassDefs, idSelector);
  const style1 = document.createElement("style");
  style1.innerHTML = rules;
  svg.insertBefore(style1, firstChild);
  try {
    await diag.renderer.draw(text, id30, "11.13.0", diag);
  } catch (e) {
    if (config.suppressErrorRendering) {
      removeTempElements();
    } else {
      errorRenderer_default.draw(text, id30, "11.13.0");
    }
    throw e;
  }
  const svgNode = root.select(`${enclosingDivID_selector} svg`);
  const a11yTitle = diag.db.getAccTitle?.();
  const a11yDescr = diag.db.getAccDescription?.();
  addA11yInfo(diagramType, svgNode, a11yTitle, a11yDescr);
  root.select(`[id="${id30}"]`).selectAll("foreignobject > *").attr("xmlns", XMLNS_XHTML_STD);
  let svgCode = root.select(enclosingDivID_selector).node().innerHTML;
  log.debug("config.arrowMarkerAbsolute", config.arrowMarkerAbsolute);
  svgCode = cleanUpSvgCode(svgCode, isSandboxed, evaluate(config.arrowMarkerAbsolute));
  if (isSandboxed) {
    const svgEl = root.select(enclosingDivID_selector + " svg").node();
    svgCode = putIntoIFrame(svgCode, svgEl);
  } else if (!isLooseSecurityLevel) {
    svgCode = purify.sanitize(svgCode, {
      ADD_TAGS: DOMPURIFY_TAGS,
      ADD_ATTR: DOMPURIFY_ATTR,
      HTML_INTEGRATION_POINTS: { foreignobject: true }
    });
  }
  attachFunctions();
  if (parseEncounteredException) {
    throw parseEncounteredException;
  }
  removeTempElements();
  return {
    diagramType,
    svg: svgCode,
    bindFunctions: diag.db.bindFunctions
  };
}, "render");
function initialize(userOptions = {}) {
  const options = assignWithDepth_default({}, userOptions);
  if (options?.fontFamily && !options.themeVariables?.fontFamily) {
    if (!options.themeVariables) {
      options.themeVariables = {};
    }
    options.themeVariables.fontFamily = options.fontFamily;
  }
  saveConfigFromInitialize(options);
  if (options?.theme && options.theme in themes_default) {
    options.themeVariables = themes_default[options.theme].getThemeVariables(
      options.themeVariables
    );
  } else if (options) {
    options.themeVariables = themes_default.default.getThemeVariables(options.themeVariables);
  }
  const config = typeof options === "object" ? setSiteConfig(options) : getSiteConfig();
  setLogLevel(config.logLevel);
  addDiagrams();
}
__name(initialize, "initialize");
var getDiagramFromText = /* @__PURE__ */ __name((text, metadata = {}) => {
  const { code } = preprocessDiagram(text);
  return Diagram.fromText(code, metadata);
}, "getDiagramFromText");
function addA11yInfo(diagramType, svgNode, a11yTitle, a11yDescr) {
  setA11yDiagramInfo(svgNode, diagramType);
  addSVGa11yTitleDescription(svgNode, a11yTitle, a11yDescr, svgNode.attr("id"));
}
__name(addA11yInfo, "addA11yInfo");
var mermaidAPI = Object.freeze({
  render,
  parse: parse2,
  getDiagramFromText,
  initialize,
  getConfig,
  setConfig,
  getSiteConfig,
  updateSiteConfig,
  reset: /* @__PURE__ */ __name(() => {
    reset();
  }, "reset"),
  globalReset: /* @__PURE__ */ __name(() => {
    reset(defaultConfig);
  }, "globalReset"),
  defaultConfig
});
setLogLevel(getConfig().logLevel);
reset(getConfig());
var handleError = /* @__PURE__ */ __name((error, errors, parseError) => {
  log.warn(error);
  if (isDetailedError(error)) {
    if (parseError) {
      parseError(error.str, error.hash);
    }
    errors.push({ ...error, message: error.str, error });
  } else {
    if (parseError) {
      parseError(error);
    }
    if (error instanceof Error) {
      errors.push({
        str: error.message,
        message: error.message,
        hash: error.name,
        error
      });
    }
  }
}, "handleError");
var run = /* @__PURE__ */ __name(async function(options = {
  querySelector: ".mermaid"
}) {
  try {
    await runThrowsErrors(options);
  } catch (e) {
    if (isDetailedError(e)) {
      log.error(e.str);
    }
    if (mermaid.parseError) {
      mermaid.parseError(e);
    }
    if (!options.suppressErrors) {
      log.error("Use the suppressErrors option to suppress these errors");
      throw e;
    }
  }
}, "run");
var runThrowsErrors = /* @__PURE__ */ __name(async function({ postRenderCallback, querySelector, nodes } = {
  querySelector: ".mermaid"
}) {
  const conf = mermaidAPI.getConfig();
  log.debug(`${!postRenderCallback ? "No " : ""}Callback function found`);
  let nodesToProcess;
  if (nodes) {
    nodesToProcess = nodes;
  } else if (querySelector) {
    nodesToProcess = document.querySelectorAll(querySelector);
  } else {
    throw new Error("Nodes and querySelector are both undefined");
  }
  log.debug(`Found ${nodesToProcess.length} diagrams`);
  if (conf?.startOnLoad !== void 0) {
    log.debug("Start On Load: " + conf?.startOnLoad);
    mermaidAPI.updateSiteConfig({ startOnLoad: conf?.startOnLoad });
  }
  const idGenerator = new utils_default.InitIDGenerator(conf.deterministicIds, conf.deterministicIDSeed);
  let txt;
  const errors = [];
  for (const element of Array.from(nodesToProcess)) {
    log.info("Rendering diagram: " + element.id);
    if (element.getAttribute("data-processed")) {
      continue;
    }
    element.setAttribute("data-processed", "true");
    const id30 = `mermaid-${idGenerator.next()}`;
    txt = element.innerHTML;
    txt = dedent(utils_default.entityDecode(txt)).trim().replace(/<br\s*\/?>/gi, "<br/>");
    const init2 = utils_default.detectInit(txt);
    if (init2) {
      log.debug("Detected early reinit: ", init2);
    }
    try {
      const { svg, bindFunctions } = await render2(id30, txt, element);
      element.innerHTML = svg;
      if (postRenderCallback) {
        await postRenderCallback(id30);
      }
      if (bindFunctions) {
        bindFunctions(element);
      }
    } catch (error) {
      handleError(error, errors, mermaid.parseError);
    }
  }
  if (errors.length > 0) {
    throw errors[0];
  }
}, "runThrowsErrors");
var initialize2 = /* @__PURE__ */ __name(function(config) {
  mermaidAPI.initialize(config);
}, "initialize");
var init = /* @__PURE__ */ __name(async function(config, nodes, callback) {
  log.warn("mermaid.init is deprecated. Please use run instead.");
  if (config) {
    initialize2(config);
  }
  const runOptions = { postRenderCallback: callback, querySelector: ".mermaid" };
  if (typeof nodes === "string") {
    runOptions.querySelector = nodes;
  } else if (nodes) {
    if (nodes instanceof HTMLElement) {
      runOptions.nodes = [nodes];
    } else {
      runOptions.nodes = nodes;
    }
  }
  await run(runOptions);
}, "init");
var registerExternalDiagrams = /* @__PURE__ */ __name(async (diagrams, {
  lazyLoad = true
} = {}) => {
  addDiagrams();
  registerLazyLoadedDiagrams(...diagrams);
  if (lazyLoad === false) {
    await loadRegisteredDiagrams();
  }
}, "registerExternalDiagrams");
var contentLoaded = /* @__PURE__ */ __name(function() {
  if (mermaid.startOnLoad) {
    const { startOnLoad } = mermaidAPI.getConfig();
    if (startOnLoad) {
      mermaid.run().catch((err) => log.error("Mermaid failed to initialize", err));
    }
  }
}, "contentLoaded");
if (typeof document !== "undefined") {
  window.addEventListener("load", contentLoaded, false);
}
var setParseErrorHandler = /* @__PURE__ */ __name(function(parseErrorHandler) {
  mermaid.parseError = parseErrorHandler;
}, "setParseErrorHandler");
var executionQueue = [];
var executionQueueRunning = false;
var executeQueue = /* @__PURE__ */ __name(async () => {
  if (executionQueueRunning) {
    return;
  }
  executionQueueRunning = true;
  while (executionQueue.length > 0) {
    const f = executionQueue.shift();
    if (f) {
      try {
        await f();
      } catch (e) {
        log.error("Error executing queue", e);
      }
    }
  }
  executionQueueRunning = false;
}, "executeQueue");
var parse22 = /* @__PURE__ */ __name(async (text, parseOptions) => {
  return new Promise((resolve, reject) => {
    const performCall = /* @__PURE__ */ __name(() => new Promise((res, rej) => {
      mermaidAPI.parse(text, parseOptions).then(
        (r) => {
          res(r);
          resolve(r);
        },
        (e) => {
          log.error("Error parsing", e);
          mermaid.parseError?.(e);
          rej(e);
          reject(e);
        }
      );
    }), "performCall");
    executionQueue.push(performCall);
    executeQueue().catch(reject);
  });
}, "parse");
var render2 = /* @__PURE__ */ __name((id30, text, container) => {
  return new Promise((resolve, reject) => {
    const performCall = /* @__PURE__ */ __name(() => new Promise((res, rej) => {
      mermaidAPI.render(id30, text, container).then(
        (r) => {
          res(r);
          resolve(r);
        },
        (e) => {
          log.error("Error parsing", e);
          mermaid.parseError?.(e);
          rej(e);
          reject(e);
        }
      );
    }), "performCall");
    executionQueue.push(performCall);
    executeQueue().catch(reject);
  });
}, "render");
var getRegisteredDiagramsMetadata = /* @__PURE__ */ __name(() => {
  return Object.keys(detectors).map((id30) => ({
    id: id30
  }));
}, "getRegisteredDiagramsMetadata");
var mermaid = {
  startOnLoad: true,
  mermaidAPI,
  parse: parse22,
  render: render2,
  init,
  run,
  registerExternalDiagrams,
  registerLayoutLoaders,
  initialize: initialize2,
  parseError: void 0,
  contentLoaded,
  setParseErrorHandler,
  detectType,
  registerIconPacks,
  getRegisteredDiagramsMetadata
};
var mermaid_default = mermaid;

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/parser/cssUtils.js
var cleanCSSValue = (value) => {
  return value.replace(/\s*!important\s*$/i, "").trim();
};
var looksLikeDeclarationStart = (input, index) => {
  let cursor = index;
  while (cursor < input.length && /\s/.test(input[cursor])) {
    cursor += 1;
  }
  const propertyStart = cursor;
  while (cursor < input.length && /[a-z-]/i.test(input[cursor])) {
    cursor += 1;
  }
  if (cursor === propertyStart) {
    return false;
  }
  while (cursor < input.length && /\s/.test(input[cursor])) {
    cursor += 1;
  }
  return input[cursor] === ":";
};
var parseCSSDeclarations = (input) => {
  const declarations = [];
  let cursor = 0;
  while (cursor < input.length) {
    while (cursor < input.length && /[\s;,]/.test(input[cursor])) {
      cursor += 1;
    }
    if (cursor >= input.length) {
      break;
    }
    const propertyStart = cursor;
    while (cursor < input.length && input[cursor] !== ":") {
      if (input[cursor] === ";" || input[cursor] === ",") {
        break;
      }
      cursor += 1;
    }
    if (cursor >= input.length || input[cursor] !== ":") {
      break;
    }
    const property = input.substring(propertyStart, cursor).trim().toLowerCase();
    cursor += 1;
    const valueStart = cursor;
    let parenthesesDepth = 0;
    let quote = null;
    while (cursor < input.length) {
      const currentChar = input[cursor];
      if (quote) {
        if (currentChar === quote && input[cursor - 1] !== "\\") {
          quote = null;
        }
        cursor += 1;
        continue;
      }
      if (currentChar === '"' || currentChar === "'") {
        quote = currentChar;
        cursor += 1;
        continue;
      }
      if (currentChar === "(") {
        parenthesesDepth += 1;
        cursor += 1;
        continue;
      }
      if (currentChar === ")") {
        parenthesesDepth = Math.max(0, parenthesesDepth - 1);
        cursor += 1;
        continue;
      }
      if (parenthesesDepth === 0) {
        if (currentChar === ";" || currentChar === ",") {
          break;
        }
        if (/\s/.test(currentChar) && looksLikeDeclarationStart(input, cursor)) {
          break;
        }
      }
      cursor += 1;
    }
    const value = cleanCSSValue(input.substring(valueStart, cursor));
    if (property && value) {
      declarations.push({ property, value });
    }
    if (cursor < input.length && (input[cursor] === ";" || input[cursor] === ",")) {
      cursor += 1;
    }
  }
  return declarations;
};
var isValidCSSColor = (value) => {
  const cleanedValue = cleanCSSValue(value);
  if (!cleanedValue) {
    return false;
  }
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports("color", cleanedValue);
  }
  if (typeof document !== "undefined") {
    const element = document.createElement("div");
    element.style.color = "";
    element.style.color = cleanedValue;
    return element.style.color !== "";
  }
  return false;
};
var getStyleDeclarationValue = (element, property) => {
  const styleText = element.getAttribute("style");
  if (!styleText) {
    return "";
  }
  return parseCSSDeclarations(styleText).find((declaration2) => declaration2.property === property)?.value || "";
};
var resolveFirstValidCSSColor = (...values) => {
  for (const rawValue of values) {
    const value = cleanCSSValue(rawValue || "");
    if (isValidCSSColor(value)) {
      return value;
    }
  }
  return void 0;
};
var resolveElementTextColor = (node2, fallbackColor) => {
  const textNode = node2.querySelector("text, foreignObject, div, span, p") || node2;
  const inlineFill = resolveFirstValidCSSColor(textNode.getAttribute?.("fill"), getStyleDeclarationValue(textNode, "fill"), textNode.style?.fill);
  if (inlineFill) {
    return inlineFill;
  }
  const inlineColor = resolveFirstValidCSSColor(textNode.getAttribute?.("color"), getStyleDeclarationValue(textNode, "color"), textNode.style?.color);
  if (inlineColor) {
    return inlineColor;
  }
  const explicitFallbackColor = resolveFirstValidCSSColor(fallbackColor);
  if (explicitFallbackColor) {
    return explicitFallbackColor;
  }
  return void 0;
};

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/parser/flowchart.js
var applyContainerStyleProperty = (style, key, value) => {
  switch (key) {
    case CONTAINER_STYLE_PROPERTY.FILL:
    case CONTAINER_STYLE_PROPERTY.STROKE:
      if (isValidCSSColor(value)) {
        style[key] = value;
      }
      break;
    case CONTAINER_STYLE_PROPERTY.STROKE_WIDTH:
    case CONTAINER_STYLE_PROPERTY.STROKE_DASHARRAY:
      style[key] = value;
      break;
  }
};
var applyLabelStyleProperty = (style, key, value) => {
  if (key === LABEL_STYLE_PROPERTY.COLOR && isValidCSSColor(value)) {
    style[LABEL_STYLE_PROPERTY.COLOR] = value;
  }
};
var applyStyleTextToStyles = (styleText, containerStyle, labelStyle) => {
  if (!styleText) {
    return;
  }
  parseCSSDeclarations(styleText).forEach(({ property, value }) => {
    applyContainerStyleProperty(containerStyle, property, value);
    applyLabelStyleProperty(labelStyle, property, value);
  });
};
var applyStyleTextToLabelStyle = (styleText, labelStyle) => {
  if (!styleText) {
    return;
  }
  parseCSSDeclarations(styleText).forEach(({ property, value }) => {
    if (property === "fill" && isValidCSSColor(value)) {
      labelStyle[LABEL_STYLE_PROPERTY.COLOR] = value;
      return;
    }
    applyLabelStyleProperty(labelStyle, property, value);
  });
};
var applyElementAttributesToContainerStyle = (element, containerStyle) => {
  if (!element) {
    return;
  }
  const attrs = [
    [CONTAINER_STYLE_PROPERTY.FILL, element.getAttribute("fill")],
    [CONTAINER_STYLE_PROPERTY.STROKE, element.getAttribute("stroke")],
    [
      CONTAINER_STYLE_PROPERTY.STROKE_WIDTH,
      element.getAttribute("stroke-width")
    ],
    [
      CONTAINER_STYLE_PROPERTY.STROKE_DASHARRAY,
      element.getAttribute("stroke-dasharray")
    ]
  ];
  attrs.forEach(([key, rawValue]) => {
    const value = cleanCSSValue(rawValue || "");
    if (value) {
      applyContainerStyleProperty(containerStyle, key, value);
    }
  });
};
var applyElementAttributesToLabelStyle = (element, labelStyle) => {
  if (!element) {
    return;
  }
  const rawColor = element.getAttribute("fill") || element.getAttribute("color");
  const color = cleanCSSValue(rawColor || "");
  if (isValidCSSColor(color)) {
    labelStyle[LABEL_STYLE_PROPERTY.COLOR] = color;
  }
};
var applyClassStyles = (classId, classes, containerStyle, labelStyle) => {
  if (!(classes instanceof Map)) {
    return;
  }
  const classDef = classes.get(classId);
  if (!classDef) {
    return;
  }
  classDef.styles?.forEach((styleText) => {
    parseCSSDeclarations(styleText).forEach(({ property, value }) => {
      applyContainerStyleProperty(containerStyle, property, value);
      applyLabelStyleProperty(labelStyle, property, value);
    });
  });
  classDef.textStyles?.forEach((styleText) => {
    parseCSSDeclarations(styleText).forEach(({ property, value }) => {
      applyLabelStyleProperty(labelStyle, property, value);
    });
  });
};
var parseSubGraph = (data, containerEl, classes) => {
  const nodeIds = data.nodes.map((n) => {
    if (n.startsWith("flowchart-")) {
      return n.split("-")[1];
    }
    return n;
  });
  const el = containerEl.querySelector(`[id='${data.id}']`);
  if (!el) {
    throw new Error("SubGraph element not found");
  }
  const position2 = computeElementPosition(el, containerEl);
  const boundingBox = el.getBBox();
  const dimension = {
    width: boundingBox.width,
    height: boundingBox.height
  };
  const containerStyle = {};
  const labelStyle = {};
  const shapeEl = el.querySelector(":scope > rect, :scope > path, :scope > polygon, :scope > ellipse") || el.querySelector(".cluster > rect, .cluster > path, .cluster > polygon, .cluster > ellipse") || el.querySelector("rect, path, polygon, ellipse");
  applyStyleTextToStyles(el.getAttribute("style"), containerStyle, labelStyle);
  applyStyleTextToStyles(shapeEl?.getAttribute("style"), containerStyle, labelStyle);
  applyElementAttributesToContainerStyle(shapeEl, containerStyle);
  const labelEl = el.querySelector(".cluster-label text, .cluster-label tspan") || el.querySelector("text");
  applyStyleTextToLabelStyle(labelEl?.getAttribute("style"), labelStyle);
  applyElementAttributesToLabelStyle(labelEl, labelStyle);
  applyClassStyles(data.id, classes, containerStyle, labelStyle);
  data.classes?.forEach((classId) => {
    applyClassStyles(classId, classes, containerStyle, labelStyle);
  });
  return {
    id: data.id,
    nodeIds,
    text: entityCodesToText(data.title),
    labelType: "text",
    ...position2,
    ...dimension,
    containerStyle,
    labelStyle
  };
};
var parseVertex = (vertex, containerEl, classes) => {
  const node2 = containerEl.querySelector(`[id*="${vertex.domId}"]`);
  if (!node2) {
    return void 0;
  }
  let link;
  if (node2.parentElement?.tagName.toLowerCase() === "a") {
    link = node2.parentElement.getAttribute("xlink:href");
  }
  const position2 = computeElementPosition(link ? node2.parentElement : node2, containerEl);
  const boundingBox = node2.getBBox();
  const dimension = {
    width: boundingBox.width,
    height: boundingBox.height
  };
  const containerStyle = {};
  const labelStyle = {};
  if (vertex.classes && classes instanceof Map) {
    (Array.isArray(vertex.classes) ? vertex.classes : [vertex.classes]).forEach((classId) => {
      applyClassStyles(classId, classes, containerStyle, labelStyle);
    });
  }
  vertex.styles?.forEach((styleText) => {
    applyStyleTextToStyles(styleText, containerStyle, labelStyle);
  });
  const shapeEl = node2.querySelector(".label-container");
  applyStyleTextToStyles(shapeEl?.getAttribute("style"), containerStyle, labelStyle);
  applyElementAttributesToContainerStyle(shapeEl, containerStyle);
  const labelElements = Array.from(node2.querySelectorAll(".label, .nodeLabel, .label text, .label tspan, .label span, .label div"));
  labelElements.forEach((element) => {
    applyStyleTextToLabelStyle(element.getAttribute("style"), labelStyle);
    applyElementAttributesToLabelStyle(element, labelStyle);
  });
  return {
    id: vertex.id,
    labelType: vertex.labelType,
    text: entityCodesToText(vertex.text || ""),
    type: vertex.type,
    link: link || void 0,
    ...position2,
    ...dimension,
    containerStyle,
    labelStyle
  };
};
var parseEdge = (edge, edgeIndex, containerEl) => {
  const node2 = containerEl.querySelector(`[id*="${edge.id}"]`);
  if (!node2) {
    throw new Error("Edge element not found");
  }
  const position2 = computeElementPosition(node2, containerEl);
  const edgePositionData = computeEdgePositions(node2, position2);
  edge.length = void 0;
  return {
    ...edge,
    ...edgePositionData,
    text: entityCodesToText(edge.text)
  };
};
var computeElementPosition = (el, containerEl) => {
  if (!el) {
    throw new Error("Element not found");
  }
  let root = el.parentElement?.parentElement;
  const childElement = el.childNodes[0];
  let childPosition = { x: 0, y: 0 };
  if (childElement) {
    const { transformX: transformX2, transformY: transformY2 } = getTransformAttr(childElement);
    const boundingBox = childElement.getBBox();
    childPosition = {
      x: Number(childElement.getAttribute("x")) || transformX2 + boundingBox.x || 0,
      y: Number(childElement.getAttribute("y")) || transformY2 + boundingBox.y || 0
    };
  }
  const { transformX, transformY } = getTransformAttr(el);
  const position2 = {
    x: transformX + childPosition.x,
    y: transformY + childPosition.y
  };
  while (root && root.id !== containerEl.id) {
    if (root.classList.value === "root" && root.hasAttribute("transform")) {
      const { transformX: transformX2, transformY: transformY2 } = getTransformAttr(root);
      position2.x += transformX2;
      position2.y += transformY2;
    }
    root = root.parentElement;
  }
  return position2;
};
var parseMermaidFlowChartDiagram = (db, containerEl) => {
  const verticesData = db.getVertices();
  const edgesData = db.getEdges();
  const subGraphsData = db.getSubGraphs();
  const classesData = db.getClasses();
  const vertices = {};
  const normalizedClasses = classesData instanceof Map ? classesData : {};
  if (verticesData instanceof Map) {
    verticesData.forEach((vertex, id30) => {
      vertices[id30] = parseVertex(vertex, containerEl, normalizedClasses);
    });
  } else if (typeof verticesData === "object" && verticesData !== null) {
    Object.entries(verticesData).forEach(([id30, vertex]) => {
      vertices[id30] = parseVertex(vertex, containerEl, normalizedClasses);
    });
  }
  const edgeCountMap = /* @__PURE__ */ new Map();
  const edges = (Array.isArray(edgesData) ? edgesData : []).map((edge) => {
    if (!containerEl.querySelector(`[id*="${edge.id}"]`)) {
      return null;
    }
    const edgeMapKey = `${edge.start}-${edge.end}`;
    const count = edgeCountMap.get(edgeMapKey) || 0;
    edgeCountMap.set(edgeMapKey, count + 1);
    return parseEdge(edge, count, containerEl);
  }).filter((edge) => edge !== null && edge.reflectionPoints.length > 1);
  const subGraphs = (Array.isArray(subGraphsData) ? subGraphsData : []).map((subgraph) => {
    return parseSubGraph(subgraph, containerEl, normalizedClasses);
  });
  return {
    type: "flowchart",
    subGraphs,
    vertices,
    edges
  };
};

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/elementSkeleton.js
var createArrowSkeletonFromSVG = (arrowNode, opts) => {
  const arrow = {};
  if (opts?.label) {
    arrow.label = { text: entityCodesToText(opts.label), fontSize: 16 };
  }
  const tagName = arrowNode.tagName;
  if (tagName === "line") {
    arrow.startX = Number(arrowNode.getAttribute("x1"));
    arrow.startY = Number(arrowNode.getAttribute("y1"));
    arrow.endX = Number(arrowNode.getAttribute("x2"));
    arrow.endY = Number(arrowNode.getAttribute("y2"));
  } else if (tagName === "path") {
    const dAttr = arrowNode.getAttribute("d");
    if (!dAttr) {
      throw new Error('Path element does not contain a "d" attribute');
    }
    const commands = dAttr.split(/(?=[LC])/);
    const startPosition = commands[0].substring(1).split(",").map((coord) => parseFloat(coord));
    const points = [];
    commands.forEach((command) => {
      const currPoints = command.substring(1).trim().split(" ").map((pos) => {
        const [x, y] = pos.split(",");
        return [
          parseFloat(x) - startPosition[0],
          parseFloat(y) - startPosition[1]
        ];
      });
      points.push(...currPoints);
    });
    const endPosition = points[points.length - 1];
    arrow.startX = startPosition[0];
    arrow.startY = startPosition[1];
    arrow.endX = endPosition[0];
    arrow.endY = endPosition[1];
    arrow.points = points;
  }
  if (opts?.label) {
    const offset = 10;
    arrow.startY = arrow.startY - offset;
    arrow.endY = arrow.endY - offset;
  }
  const strokeAttr = arrowNode.getAttribute("stroke");
  const strokeColor = (strokeAttr && strokeAttr !== "none" ? strokeAttr : "") || getComputedStyle(arrowNode).stroke || "";
  arrow.strokeColor = strokeColor ? cleanCSSValue(strokeColor) : null;
  arrow.strokeWidth = Number(arrowNode.getAttribute("stroke-width"));
  arrow.type = "arrow";
  arrow.strokeStyle = opts?.strokeStyle || "solid";
  arrow.startArrowhead = opts?.startArrowhead || null;
  arrow.endArrowhead = opts?.endArrowhead || null;
  return arrow;
};
var createArrowSkeletion = (startX, startY, endX, endY, opts) => {
  const arrow = {};
  arrow.type = "arrow";
  arrow.startX = startX;
  arrow.startY = startY;
  arrow.endX = endX;
  arrow.endY = endY;
  Object.assign(arrow, { ...opts });
  return arrow;
};
var createTextSkeleton = (x, y, text, opts) => {
  const textElement = {
    type: "text",
    x,
    y,
    text,
    width: opts?.width || 20,
    height: opts?.height || 20,
    fontSize: opts?.fontSize || DEFAULT_FONT_SIZE,
    id: opts?.id,
    color: opts?.color,
    groupId: opts?.groupId,
    metadata: opts?.metadata
  };
  return textElement;
};
var createTextSkeletonFromSVG = (textNode, text, opts) => {
  const node2 = {};
  const x = Number(textNode.getAttribute("x"));
  const y = Number(textNode.getAttribute("y"));
  node2.type = "text";
  node2.text = entityCodesToText(text);
  if (opts?.id) {
    node2.id = opts.id;
  }
  if (opts?.groupId) {
    node2.groupId = opts.groupId;
  }
  const boundingBox = textNode.getBBox();
  node2.width = boundingBox.width;
  node2.height = boundingBox.height;
  node2.x = x - boundingBox.width / 2;
  node2.y = y;
  const fontSize = parseInt(getComputedStyle(textNode).fontSize);
  node2.fontSize = fontSize;
  node2.color = resolveElementTextColor(textNode);
  return node2;
};
var createContainerSkeletonFromSVG = (node2, type, opts = {}) => {
  const container = {};
  container.type = type;
  const { label, subtype, id: id30, groupId } = opts;
  container.id = id30;
  if (groupId) {
    container.groupId = groupId;
  }
  if (label) {
    container.label = {
      text: entityCodesToText(label.text),
      fontSize: 16,
      textAlign: label?.textAlign,
      verticalAlign: label?.verticalAlign
    };
  }
  const boundingBox = node2.getBBox();
  container.x = boundingBox.x;
  container.y = boundingBox.y;
  container.width = boundingBox.width;
  container.height = boundingBox.height;
  container.subtype = subtype;
  switch (subtype) {
    case "highlight":
      const bgColor = node2.getAttribute("fill");
      if (bgColor) {
        container.bgColor = cleanCSSValue(bgColor);
      }
      break;
    case "note":
      container.strokeStyle = "dashed";
      break;
  }
  return container;
};
var createLineSkeletonFromSVG = (lineNode, startX, startY, endX, endY, opts) => {
  const line2 = {};
  line2.startX = startX;
  line2.startY = startY;
  line2.endX = endX;
  if (opts?.groupId) {
    line2.groupId = opts.groupId;
  }
  if (opts?.id) {
    line2.id = opts.id;
  }
  line2.endY = endY;
  const strokeColor = lineNode.getAttribute("stroke");
  line2.strokeColor = strokeColor ? cleanCSSValue(strokeColor) : null;
  line2.strokeWidth = Number(lineNode.getAttribute("stroke-width"));
  line2.type = "line";
  return line2;
};

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/parser/sequence.js
var SEQUENCE_ARROW_TYPES = {
  0: "SOLID",
  1: "DOTTED",
  3: "SOLID_CROSS",
  4: "DOTTED_CROSS",
  5: "SOLID_OPEN",
  6: "DOTTED_OPEN",
  24: "SOLID_POINT",
  25: "DOTTED_POINT"
};
var MESSAGE_TYPE = {
  SOLID: 0,
  DOTTED: 1,
  NOTE: 2,
  SOLID_CROSS: 3,
  DOTTED_CROSS: 4,
  SOLID_OPEN: 5,
  DOTTED_OPEN: 6,
  LOOP_START: 10,
  LOOP_END: 11,
  ALT_START: 12,
  ALT_ELSE: 13,
  ALT_END: 14,
  OPT_START: 15,
  OPT_END: 16,
  ACTIVE_START: 17,
  ACTIVE_END: 18,
  PAR_START: 19,
  PAR_AND: 20,
  PAR_END: 21,
  RECT_START: 22,
  RECT_END: 23,
  SOLID_POINT: 24,
  DOTTED_POINT: 25,
  AUTONUMBER: 26,
  CRITICAL_START: 27,
  CRITICAL_OPTION: 28,
  CRITICAL_END: 29,
  BREAK_START: 30,
  BREAK_END: 31,
  PAR_OVER_START: 32
};
var getStrokeStyle = (type) => {
  let strokeStyle;
  switch (type) {
    case MESSAGE_TYPE.SOLID:
    case MESSAGE_TYPE.SOLID_CROSS:
    case MESSAGE_TYPE.SOLID_OPEN:
    case MESSAGE_TYPE.SOLID_POINT:
      strokeStyle = "solid";
      break;
    case MESSAGE_TYPE.DOTTED:
    case MESSAGE_TYPE.DOTTED_CROSS:
    case MESSAGE_TYPE.DOTTED_OPEN:
    case MESSAGE_TYPE.DOTTED_POINT:
      strokeStyle = "dotted";
      break;
    default:
      strokeStyle = "solid";
      break;
  }
  return strokeStyle;
};
var attachSequenceNumberToArrow = (node2, arrow) => {
  const showSequenceNumber = !!node2.nextElementSibling?.classList.contains("sequenceNumber");
  if (showSequenceNumber) {
    const text = node2.nextElementSibling?.textContent;
    if (!text) {
      throw new Error("sequence number not present");
    }
    const height = 30;
    const yOffset = height / 2;
    const xOffset = 10;
    const sequenceNumber = {
      type: "rectangle",
      x: arrow.startX - xOffset,
      y: arrow.startY - yOffset,
      label: { text, fontSize: 14 },
      bgColor: "#e9ecef",
      height,
      subtype: "sequence"
    };
    Object.assign(arrow, { sequenceNumber });
  }
};
var createActorSymbol = (rootNode, text, opts) => {
  if (!rootNode) {
    throw "root node not found";
  }
  const groupId = nanoid();
  const children = Array.from(rootNode.children);
  const nodeElements = [];
  children.forEach((child, index) => {
    const id30 = `${opts?.id}-${index}`;
    let ele;
    switch (child.tagName) {
      case "line":
        const startX = Number(child.getAttribute("x1"));
        const startY = Number(child.getAttribute("y1"));
        const endX = Number(child.getAttribute("x2"));
        const endY = Number(child.getAttribute("y2"));
        ele = createLineSkeletonFromSVG(child, startX, startY, endX, endY, { groupId, id: id30 });
        break;
      case "text":
        ele = createTextSkeletonFromSVG(child, text, {
          groupId,
          id: id30
        });
        break;
      case "circle":
        ele = createContainerSkeletonFromSVG(child, "ellipse", {
          label: child.textContent ? { text: child.textContent } : void 0,
          groupId,
          id: id30
        });
      default:
        ele = createContainerSkeletonFromSVG(child, SVG_TO_SHAPE_MAPPER[child.tagName], {
          label: child.textContent ? { text: child.textContent } : void 0,
          groupId,
          id: id30
        });
    }
    nodeElements.push(ele);
  });
  return nodeElements;
};
var applyRectStyles = (container, rect) => {
  const fill = rect.getAttribute("fill");
  const stroke = rect.getAttribute("stroke");
  const strokeWidth = rect.getAttribute("stroke-width");
  const dashArray = rect.getAttribute("stroke-dasharray");
  if (fill && fill !== "none") {
    container.bgColor = cleanCSSValue(fill);
  }
  if (stroke && stroke !== "none") {
    container.strokeColor = cleanCSSValue(stroke);
  }
  if (strokeWidth) {
    container.strokeWidth = Number(strokeWidth);
  }
  if (dashArray && dashArray.trim()) {
    container.strokeStyle = "dashed";
  }
};
var parseActor = (actors, containerEl) => {
  const actorTopNodes = Array.from(containerEl.querySelectorAll(".actor-top"));
  const actorBottomNodes = Array.from(containerEl.querySelectorAll(".actor-bottom"));
  const nodes = [];
  const lines = [];
  const actorMap = {};
  const actorList = actors instanceof Map ? Array.from(actors.values()) : Object.values(actors);
  const actorLineNodes = Array.from(containerEl.querySelectorAll(".actor-line"));
  const resolveActorLineNode = (actor, topRootNode) => {
    const actorName = actor.name;
    const actorLineNode = actorLineNodes.find((lineNode) => lineNode.getAttribute("name") === actorName);
    if (actorLineNode) {
      return actorLineNode;
    }
    const candidateNode = actor.type === "participant" ? topRootNode.parentElement?.previousElementSibling : topRootNode.previousElementSibling;
    if (!candidateNode) {
      return null;
    }
    if (candidateNode.tagName === "line") {
      return candidateNode;
    }
    return candidateNode.querySelector("line");
  };
  actorList.forEach((actor) => {
    const topRootNode = actorTopNodes.find((actorNode) => actorNode.getAttribute("name") === actor.name);
    const bottomRootNode = actorBottomNodes.find((actorNode) => actorNode.getAttribute("name") === actor.name);
    if (!topRootNode || !bottomRootNode) {
      throw "root not found";
    }
    const text = actor.description;
    if (actor.type === "participant") {
      const topNodeElement = createContainerSkeletonFromSVG(topRootNode, "rectangle", { id: `${actor.name}-top`, label: { text }, subtype: "actor" });
      applyRectStyles(topNodeElement, topRootNode);
      if (!topNodeElement) {
        throw "Top Node element not found!";
      }
      nodes.push([topNodeElement]);
      const bottomNodeElement = createContainerSkeletonFromSVG(bottomRootNode, "rectangle", { id: `${actor.name}-bottom`, label: { text }, subtype: "actor" });
      actorMap[actor.name] = {
        topId: `${actor.name}-top`,
        bottomId: `${actor.name}-bottom`,
        bindType: "rectangle"
      };
      applyRectStyles(bottomNodeElement, bottomRootNode);
      nodes.push([bottomNodeElement]);
      const lineNode = resolveActorLineNode(actor, topRootNode);
      if (lineNode?.tagName !== "line") {
        throw "Line not found";
      }
      const startX = Number(lineNode.getAttribute("x1"));
      if (!topNodeElement.height) {
        throw "Top node element height is null";
      }
      const startY = topNodeElement.y + topNodeElement.height;
      const endY = bottomNodeElement.y;
      const endX = Number(lineNode.getAttribute("x2"));
      const line2 = createLineSkeletonFromSVG(lineNode, startX, startY, endX, endY);
      lines.push(line2);
    } else if (actor.type === "actor") {
      const topNodeElement = createActorSymbol(topRootNode, text, {
        id: `${actor.name}-top`
      });
      nodes.push(topNodeElement);
      const bottomNodeElement = createActorSymbol(bottomRootNode, text, {
        id: `${actor.name}-bottom`
      });
      nodes.push(bottomNodeElement);
      const lineNode = resolveActorLineNode(actor, topRootNode);
      if (lineNode?.tagName !== "line") {
        throw "Line not found";
      }
      const startX = Number(lineNode.getAttribute("x1"));
      const startY = Number(lineNode.getAttribute("y1"));
      const endX = Number(lineNode.getAttribute("x2"));
      const bottomEllipseNode = bottomNodeElement.find((node2) => node2.type === "ellipse");
      if (bottomEllipseNode) {
        const endY = bottomEllipseNode.y;
        const line2 = createLineSkeletonFromSVG(lineNode, startX, startY, endX, endY);
        lines.push(line2);
      }
      const topEllipseNode = topNodeElement.find((node2) => node2.type === "ellipse");
      const bottomEllipseActorNode = bottomNodeElement.find((node2) => node2.type === "ellipse");
      if (topEllipseNode?.id && bottomEllipseActorNode?.id) {
        actorMap[actor.name] = {
          topId: topEllipseNode.id,
          bottomId: bottomEllipseActorNode.id,
          bindType: "ellipse"
        };
      }
    }
  });
  return { nodes, lines, actorMap };
};
var computeArrows = (messages, containerEl, actorMap) => {
  const arrows = [];
  const arrowNodes = Array.from(containerEl.querySelectorAll('[class*="messageLine"]'));
  const supportedMessageTypes = Object.keys(SEQUENCE_ARROW_TYPES);
  const arrowMessages = messages.filter((message) => supportedMessageTypes.includes(message.type.toString()));
  arrowNodes.forEach((arrowNode, index) => {
    const message = arrowMessages[index];
    const messageType = SEQUENCE_ARROW_TYPES[message.type];
    const arrow = createArrowSkeletonFromSVG(arrowNode, {
      label: message?.message,
      strokeStyle: getStrokeStyle(message.type),
      endArrowhead: messageType === "SOLID_OPEN" || messageType === "DOTTED_OPEN" ? null : "arrow"
    });
    const from2 = actorMap[message.from];
    const to = actorMap[message.to];
    if (from2?.topId && to?.topId) {
      arrow.start = { type: from2.bindType || "rectangle", id: from2.topId };
      arrow.end = { type: to.bindType || "rectangle", id: to.topId };
    }
    attachSequenceNumberToArrow(arrowNode, arrow);
    arrows.push(arrow);
  });
  return arrows;
};
var computeNotes = (messages, containerEl) => {
  const noteNodes = Array.from(containerEl.querySelectorAll(".note")).map((node2) => node2.parentElement);
  const noteText = messages.filter((message) => message.type === MESSAGE_TYPE.NOTE);
  const notes = [];
  noteNodes.forEach((node2, index) => {
    if (!node2) {
      return;
    }
    const rect = node2.firstChild;
    const text = noteText[index].message;
    const note = createContainerSkeletonFromSVG(rect, "rectangle", {
      label: { text },
      subtype: "note"
    });
    const fill = rect.getAttribute("fill");
    const stroke = rect.getAttribute("stroke");
    const strokeWidth = rect.getAttribute("stroke-width");
    const dashArray = rect.getAttribute("stroke-dasharray");
    if (fill && fill !== "none") {
      note.bgColor = cleanCSSValue(fill);
    }
    if (stroke && stroke !== "none") {
      note.strokeColor = cleanCSSValue(stroke);
    }
    if (strokeWidth) {
      note.strokeWidth = Number(strokeWidth);
    }
    if (dashArray && dashArray.trim()) {
      note.strokeStyle = "dashed";
    }
    notes.push(note);
  });
  return notes;
};
var parseActivations = (containerEl) => {
  const activationNodes = Array.from(containerEl.querySelectorAll(`[class*=activation]`));
  const activations = [];
  activationNodes.forEach((node2) => {
    const rect = createContainerSkeletonFromSVG(node2, "rectangle", {
      label: { text: "" },
      subtype: "activation"
    });
    const applyRectStyles2 = () => {
      const fill = node2.getAttribute("fill");
      const stroke = node2.getAttribute("stroke");
      const strokeWidth = node2.getAttribute("stroke-width");
      const dashArray = node2.getAttribute("stroke-dasharray");
      if (fill && fill !== "none") {
        rect.bgColor = cleanCSSValue(fill);
      }
      if (stroke && stroke !== "none") {
        rect.strokeColor = cleanCSSValue(stroke);
      }
      if (strokeWidth) {
        rect.strokeWidth = Number(strokeWidth);
      }
      if (dashArray && dashArray.trim()) {
        rect.strokeStyle = "dashed";
      }
    };
    applyRectStyles2();
    activations.push(rect);
  });
  return activations;
};
var parseLoops = (messages, containerEl) => {
  const lineNodes = Array.from(containerEl.querySelectorAll(".loopLine"));
  const lines = [];
  const texts = [];
  const nodes = [];
  lineNodes.forEach((node2) => {
    const startX = Number(node2.getAttribute("x1"));
    const startY = Number(node2.getAttribute("y1"));
    const endX = Number(node2.getAttribute("x2"));
    const endY = Number(node2.getAttribute("y2"));
    const line2 = createLineSkeletonFromSVG(node2, startX, startY, endX, endY);
    line2.strokeStyle = "dotted";
    line2.strokeColor = "#adb5bd";
    line2.strokeWidth = 2;
    lines.push(line2);
  });
  const loopTextNodes = Array.from(containerEl.querySelectorAll(".loopText"));
  const criticalMessages = messages.filter((message) => message.type === MESSAGE_TYPE.CRITICAL_START).map((message) => message.message);
  loopTextNodes.forEach((node2) => {
    const text = node2.textContent || "";
    const textElement = createTextSkeletonFromSVG(node2, text);
    const rawText = text.match(/\[(.*?)\]/)?.[1] || "";
    const isCritical = criticalMessages.includes(rawText);
    if (isCritical) {
      textElement.x += 16;
    }
    texts.push(textElement);
  });
  const labelBoxes = Array.from(containerEl?.querySelectorAll(".labelBox"));
  const labelTextNode = Array.from(containerEl?.querySelectorAll(".labelText"));
  labelBoxes.forEach((labelBox, index) => {
    const text = labelTextNode[index]?.textContent || "";
    const container = createContainerSkeletonFromSVG(labelBox, "rectangle", {
      label: { text }
    });
    container.strokeColor = "#adb5bd";
    container.bgColor = "#e9ecef";
    container.width = void 0;
    nodes.push(container);
  });
  return { lines, texts, nodes };
};
var computeHighlights = (containerEl) => {
  const rects = Array.from(containerEl.querySelectorAll(".rect")).filter((node2) => node2.parentElement?.tagName !== "g");
  const nodes = [];
  rects.forEach((rect) => {
    const node2 = createContainerSkeletonFromSVG(rect, "rectangle", {
      label: { text: "" },
      subtype: "highlight"
    });
    nodes.push(node2);
  });
  return nodes;
};
var parseMermaidSequenceDiagram = (diagram2, containerEl) => {
  const mermaidParser = diagram2.db;
  const nodes = [];
  const rawGroups = mermaidParser.getBoxes();
  const groups = rawGroups.map((group) => ({
    ...group,
    fill: cleanCSSValue(group.fill || "")
  }));
  const bgHightlights = computeHighlights(containerEl);
  const actorData = mermaidParser.getActors();
  const { nodes: actors, lines, actorMap } = parseActor(actorData, containerEl);
  const messages = mermaidParser.getMessages();
  const arrows = computeArrows(messages, containerEl, actorMap);
  const notes = computeNotes(messages, containerEl);
  const activations = parseActivations(containerEl);
  const loops = parseLoops(messages, containerEl);
  nodes.push(bgHightlights);
  nodes.push(...actors);
  nodes.push(notes);
  nodes.push(activations);
  return { type: "sequence", lines, arrows, nodes, loops, groups };
};

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/parser/class.js
var parseStyleStrings = (styles) => {
  const styleObj = {};
  if (!styles) {
    return styleObj;
  }
  styles.forEach((style) => {
    parseCSSDeclarations(style).forEach(({ property, value }) => {
      if (property && value) {
        styleObj[property] = cleanCSSValue(value);
      }
    });
  });
  return styleObj;
};
var RELATION_TYPE = {
  AGGREGATION: 0,
  EXTENSION: 1,
  COMPOSITION: 2,
  DEPENDENCY: 3,
  LOLLIPOP: 4
};
var LINE_TYPE = {
  LINE: 0,
  DOTTED_LINE: 1
};
var MERMAID_ARROW_HEAD_OFFSET = 16;
var getStrokeStyle2 = (type) => {
  let lineType;
  switch (type) {
    case LINE_TYPE.LINE:
      lineType = "solid";
      break;
    case LINE_TYPE.DOTTED_LINE:
      lineType = "dotted";
      break;
    default:
      lineType = "solid";
  }
  return lineType;
};
var getArrowhead = (type) => {
  let arrowhead;
  switch (type) {
    case RELATION_TYPE.AGGREGATION:
      arrowhead = "diamond_outline";
      break;
    case RELATION_TYPE.COMPOSITION:
      arrowhead = "diamond";
      break;
    case RELATION_TYPE.EXTENSION:
      arrowhead = "triangle_outline";
      break;
    case "none":
      arrowhead = null;
      break;
    case RELATION_TYPE.DEPENDENCY:
    default:
      arrowhead = "arrow";
      break;
  }
  return arrowhead;
};
var accumulateTranslation = (node2, stopAt) => {
  let tx = 0;
  let ty = 0;
  let current = node2;
  while (current && current !== stopAt) {
    const { transformX, transformY } = getTransformAttr(current);
    tx += transformX;
    ty += transformY;
    current = current.parentElement;
  }
  return { tx, ty };
};
var ARROWHEAD_OFFSET_SHAPES = /* @__PURE__ */ new Set([
  "triangle_outline",
  "diamond",
  "diamond_outline"
]);
var simplifyRoutePoints = (points, tolerance = 0.5) => {
  if (points.length <= 2) {
    return [...points];
  }
  const simplifiedPoints = [points[0]];
  for (let index = 1; index < points.length - 1; index++) {
    const previousPoint = simplifiedPoints[simplifiedPoints.length - 1];
    const currentPoint = points[index];
    const nextPoint = points[index + 1];
    const baseX = nextPoint.x - previousPoint.x;
    const baseY = nextPoint.y - previousPoint.y;
    const baseLength = Math.hypot(baseX, baseY);
    if (!baseLength) {
      continue;
    }
    const areaTwice = Math.abs(baseX * (currentPoint.y - previousPoint.y) - baseY * (currentPoint.x - previousPoint.x));
    const distanceFromSegment = areaTwice / baseLength;
    const projection = ((currentPoint.x - previousPoint.x) * baseX + (currentPoint.y - previousPoint.y) * baseY) / (baseLength * baseLength);
    if (distanceFromSegment <= tolerance && projection >= -tolerance && projection <= 1 + tolerance) {
      continue;
    }
    simplifiedPoints.push(currentPoint);
  }
  simplifiedPoints.push(points[points.length - 1]);
  return simplifiedPoints;
};
var getEdgeRoutePoints = (edgePath) => {
  const routePoints = dedupeConsecutivePoints(getDecodedEdgePoints(edgePath).map((point3) => [point3.x, point3.y])).map(([x, y]) => ({ x, y }));
  const renderedPathCoordinates = getPathCoordinates(edgePath);
  if (renderedPathCoordinates && routePoints.length >= 2) {
    routePoints[0] = {
      x: renderedPathCoordinates.startX,
      y: renderedPathCoordinates.startY
    };
    routePoints[routePoints.length - 1] = {
      x: renderedPathCoordinates.endX,
      y: renderedPathCoordinates.endY
    };
  }
  return simplifyRoutePoints(routePoints);
};
var movePointAwayFromAdjacent = (point3, adjacentPoint, distance) => {
  const dx = point3.x - adjacentPoint.x;
  const dy = point3.y - adjacentPoint.y;
  const magnitude = Math.hypot(dx, dy);
  if (!magnitude) {
    return point3;
  }
  return {
    x: point3.x + dx / magnitude * distance,
    y: point3.y + dy / magnitude * distance
  };
};
var setArrowRoutePoints = (arrow, points) => {
  const dedupedPoints = dedupeConsecutivePoints(points.map((point3) => [point3.x, point3.y])).map(([x, y]) => ({ x, y }));
  if (dedupedPoints.length < 2) {
    throw new Error("Arrow route must contain at least two points");
  }
  const startPoint = dedupedPoints[0];
  const endPoint = dedupedPoints[dedupedPoints.length - 1];
  arrow.startX = startPoint.x;
  arrow.startY = startPoint.y;
  arrow.endX = endPoint.x;
  arrow.endY = endPoint.y;
  arrow.points = dedupedPoints.map((point3) => [
    point3.x - startPoint.x,
    point3.y - startPoint.y
  ]);
};
var adjustArrowPosition = (arrow) => {
  const routePoints = arrow.points?.map(([x, y]) => ({ x: arrow.startX + x, y: arrow.startY + y })).filter((point3) => Number.isFinite(point3.x) && Number.isFinite(point3.y));
  if (!routePoints || routePoints.length < 2) {
    return arrow;
  }
  const updatedPoints = [...routePoints];
  const shouldUpdateStartArrowhead = !!arrow.startArrowhead && ARROWHEAD_OFFSET_SHAPES.has(arrow.startArrowhead);
  const shouldUpdateEndArrowhead = !!arrow.endArrowhead && ARROWHEAD_OFFSET_SHAPES.has(arrow.endArrowhead);
  if (!shouldUpdateStartArrowhead && !shouldUpdateEndArrowhead) {
    return arrow;
  }
  if (shouldUpdateStartArrowhead) {
    updatedPoints[0] = movePointAwayFromAdjacent(updatedPoints[0], updatedPoints[1], MERMAID_ARROW_HEAD_OFFSET);
  }
  if (shouldUpdateEndArrowhead) {
    const lastIndex = updatedPoints.length - 1;
    updatedPoints[lastIndex] = movePointAwayFromAdjacent(updatedPoints[lastIndex], updatedPoints[lastIndex - 1], MERMAID_ARROW_HEAD_OFFSET);
  }
  setArrowRoutePoints(arrow, updatedPoints);
  return arrow;
};
var applyPathStylingToArrow = (edgePath, arrow) => {
  const strokeColor = cleanCSSValue(edgePath.getAttribute("stroke") || getComputedStyle(edgePath).stroke || "");
  const strokeWidth = parseFloat(edgePath.getAttribute("stroke-width") || getComputedStyle(edgePath).strokeWidth || "1");
  if (isValidCSSColor(strokeColor) && strokeColor !== "none") {
    arrow.strokeColor = strokeColor;
  }
  if (Number.isFinite(strokeWidth) && strokeWidth > 0) {
    arrow.strokeWidth = strokeWidth;
  }
};
var mergeEdgeRoutePoints = (edgePaths) => {
  const mergedPoints = [];
  edgePaths.forEach((edgePath) => {
    getEdgeRoutePoints(edgePath).forEach((point3) => {
      const previousPoint = mergedPoints[mergedPoints.length - 1];
      if (previousPoint && previousPoint.x === point3.x && previousPoint.y === point3.y) {
        return;
      }
      mergedPoints.push(point3);
    });
  });
  return simplifyRoutePoints(mergedPoints);
};
var createArrowFromRoutePoints = (routePoints, primaryEdgePath, opts) => {
  if (routePoints.length < 2) {
    throw new Error(`Class diagram edge ${primaryEdgePath?.id || "<unknown>"} is missing usable path points`);
  }
  const startPoint = routePoints[0];
  const endPoint = routePoints[routePoints.length - 1];
  const arrow = createArrowSkeletion(startPoint.x, startPoint.y, endPoint.x, endPoint.y, {
    id: primaryEdgePath?.getAttribute("data-id") || primaryEdgePath?.id || void 0,
    ...opts,
    points: routePoints.map((point3) => [
      point3.x - startPoint.x,
      point3.y - startPoint.y
    ])
  });
  if (primaryEdgePath) {
    applyPathStylingToArrow(primaryEdgePath, arrow);
  }
  return adjustArrowPosition(arrow);
};
var createPreservedRouteArrowFromEdgePaths = (edgePaths, opts) => createArrowFromRoutePoints(mergeEdgeRoutePoints(edgePaths), edgePaths[0], opts);
var createStraightClassRelationArrowFromEdgePath = (edgePath, opts) => {
  const routePoints = getEdgeRoutePoints(edgePath);
  return createArrowFromRoutePoints([routePoints[0], routePoints[routePoints.length - 1]], edgePath, opts);
};
var createArrowFromEdgePath = (edgePath, opts) => createPreservedRouteArrowFromEdgePaths([edgePath], opts);
var getSelfRelationEdgePaths = (classId, containerEl) => {
  const cyclicPathIds = [
    `${classId}-cyclic-special-1`,
    `${classId}-cyclic-special-mid`,
    `${classId}-cyclic-special-2`
  ];
  return cyclicPathIds.map((pathId) => containerEl.querySelector(`path[id="${pathId}"][data-edge="true"]`)).filter((path) => path !== null);
};
var getArrowRoutePoints = (arrow) => {
  return arrow.points?.map(([x, y]) => ({ x: arrow.startX + x, y: arrow.startY + y })).filter((point3) => Number.isFinite(point3.x) && Number.isFinite(point3.y)) || [];
};
var getSelfRelationTitlePosition = (arrow, side) => {
  const routePoints = getArrowRoutePoints(arrow);
  if (routePoints.length < 2) {
    return null;
  }
  const isStart = side === "start";
  const endpoint = isStart ? routePoints[0] : routePoints[routePoints.length - 1];
  const adjacentPoint = isStart ? routePoints[1] : routePoints[routePoints.length - 2];
  const horizontalDirection = adjacentPoint.x === endpoint.x ? isStart ? -1 : 1 : Math.sign(adjacentPoint.x - endpoint.x);
  const verticalDirection = adjacentPoint.y === endpoint.y ? 1 : Math.sign(adjacentPoint.y - endpoint.y);
  return {
    x: endpoint.x + horizontalDirection * 20,
    y: endpoint.y + (verticalDirection >= 0 ? 12 : -28)
  };
};
var getClassTextSection = (textNode, classNode) => {
  let current = textNode;
  while (current && current !== classNode) {
    if (current.classList.contains("annotation-group")) {
      return "header";
    }
    if (current.classList.contains("label-group")) {
      return "header";
    }
    if (current.classList.contains("members-group")) {
      return "members";
    }
    if (current.classList.contains("methods-group")) {
      return "methods";
    }
    current = current.parentElement;
  }
  return "other";
};
var parseClasses = (classes, containerEl, lookUpDomId) => {
  const nodes = [];
  const lines = [];
  const text = [];
  Object.values(classes).forEach((classNode) => {
    const { domId, id: classId } = classNode;
    const groupId = nanoid();
    const classStyles = parseStyleStrings(
      // @ts-ignore
      classNode.styles || classNode.cssStyles
    );
    let lookedUpId;
    try {
      lookedUpId = lookUpDomId ? lookUpDomId(classId) : void 0;
    } catch {
      lookedUpId = void 0;
    }
    const findByPrefix = (id30) => {
      const regex = new RegExp(`^classId-${id30}(?:-|$)`);
      const all = Array.from(containerEl.querySelectorAll("[id]")).filter((el) => regex.test(el.id));
      return all[0];
    };
    const domNode = lookedUpId && containerEl.querySelector(`#${lookedUpId}`) || containerEl.querySelector(`#${domId}`) || containerEl.querySelector(`[data-id='${classId}']`) || findByPrefix(classId);
    if (!domNode) {
      throw Error(`DOM Node with id ${domId} not found`);
    }
    const containerSource = domNode.querySelector("rect") || domNode;
    const containerBBox = containerSource.getBBox();
    const { tx: containerTx, ty: containerTy } = accumulateTranslation(containerSource, containerEl);
    const container = {
      type: "rectangle",
      id: classId,
      groupId,
      x: containerBBox.x + containerTx,
      y: containerBBox.y + containerTy,
      width: containerBBox.width,
      height: containerBBox.height,
      metadata: { classId }
    };
    const fill = containerSource.getAttribute("fill");
    const stroke = containerSource.getAttribute("stroke");
    const strokeWidth = containerSource.getAttribute("stroke-width");
    const dashArray = containerSource.getAttribute("stroke-dasharray");
    const computed = getComputedStyle(containerSource);
    const resolvedFill = cleanCSSValue(fill || classStyles.fill || (fill ? computed.fill : ""));
    const resolvedStroke = cleanCSSValue(stroke || classStyles.stroke || (stroke ? computed.stroke : ""));
    const resolvedStrokeWidth = strokeWidth || classStyles["stroke-width"] || (strokeWidth ? computed.strokeWidth : "");
    const resolvedDash = dashArray || classStyles["stroke-dasharray"] || (dashArray ? computed.strokeDasharray === "none" ? "" : computed.strokeDasharray : "");
    const isMeaningfulColor = (value) => {
      if (!value) {
        return false;
      }
      if (!isValidCSSColor(value)) {
        return false;
      }
      const v = value.toLowerCase();
      return !(v === "none" || v === "transparent" || v === "rgba(0, 0, 0, 0)" || v === "black" || v === "#000" || v === "#000000" || v === "rgb(0, 0, 0)" || v === "rgba(0, 0, 0, 1)");
    };
    if (isMeaningfulColor(resolvedFill)) {
      container.bgColor = resolvedFill;
    } else {
      container.bgColor = void 0;
    }
    if (isMeaningfulColor(resolvedStroke)) {
      container.strokeColor = resolvedStroke;
    } else {
      container.strokeColor = void 0;
    }
    if (resolvedStrokeWidth) {
      container.strokeWidth = Number(resolvedStrokeWidth);
    } else {
      container.strokeWidth = void 0;
    }
    if (resolvedDash && resolvedDash.trim().length > 0) {
      container.strokeStyle = "dashed";
    } else {
      container.strokeStyle = void 0;
    }
    nodes.push(container);
    const lineNodes = [
      ...Array.from(domNode.querySelectorAll("line")),
      ...Array.from(domNode.querySelectorAll("g.divider path"))
    ];
    lineNodes.forEach((lineNode) => {
      const { tx, ty } = accumulateTranslation(lineNode, containerEl);
      let startX;
      let startY;
      let endX;
      let endY;
      if (lineNode.tagName.toLowerCase() === "line") {
        startX = Number(lineNode.getAttribute("x1")) + tx;
        startY = Number(lineNode.getAttribute("y1")) + ty;
        endX = Number(lineNode.getAttribute("x2")) + tx;
        endY = Number(lineNode.getAttribute("y2")) + ty;
      } else {
        const bbox = lineNode.getBBox();
        startX = bbox.x + tx;
        endX = bbox.x + bbox.width + tx;
        const centerY = bbox.y + bbox.height / 2 + ty;
        startY = centerY;
        endY = centerY;
      }
      if (startX === endX && startY === endY) {
        return;
      }
      const line2 = createLineSkeletonFromSVG(
        // @ts-ignore
        lineNode,
        startX,
        startY,
        endX,
        endY,
        {
          groupId,
          id: nanoid()
        }
      );
      if (container.strokeColor) {
        line2.strokeColor = container.strokeColor;
      } else {
        line2.strokeColor = void 0;
      }
      if (container.strokeWidth !== void 0) {
        line2.strokeWidth = container.strokeWidth;
      } else {
        line2.strokeWidth = void 0;
      }
      if (container.strokeStyle) {
        line2.strokeStyle = container.strokeStyle;
      } else {
        line2.strokeStyle = void 0;
      }
      line2.metadata = { classId };
      lines.push(line2);
    });
    const textElements = Array.from(domNode.querySelectorAll("text, foreignObject"));
    const parsedTextElements = [];
    textElements.forEach((textNode) => {
      const isForeignObject = textNode.tagName.toLowerCase() === "foreignobject";
      const tspans = !isForeignObject ? Array.from(textNode.querySelectorAll("tspan")) : [];
      const rawText = tspans.length ? tspans.map((span) => span.textContent?.trim()).filter(Boolean).join("\n") : textNode.textContent?.trim() || "";
      if (!rawText) {
        return;
      }
      const boundingBox = textNode.getBBox();
      const { ty } = accumulateTranslation(textNode, containerEl);
      let fontSize = parseFloat(getComputedStyle(textNode).fontSize || "");
      if (isForeignObject && (!Number.isFinite(fontSize) || !fontSize)) {
        const inner = textNode.querySelector("div, span, p");
        if (inner) {
          fontSize = parseFloat(getComputedStyle(inner).fontSize || "");
        }
      }
      if (!Number.isFinite(fontSize) || fontSize <= 0) {
        fontSize = Math.max(12, boundingBox.height * 0.6);
      }
      fontSize = fontSize * 0.9;
      const resolvedTextColor = resolveElementTextColor(textNode, classStyles.color);
      parsedTextElements.push({
        section: getClassTextSection(textNode, domNode),
        text: entityCodesToText(rawText),
        x: boundingBox.x,
        y: boundingBox.y + ty,
        width: container && container.width ? Math.max(container.width - 8, boundingBox.width) : boundingBox.width,
        height: boundingBox.height,
        fontSize,
        color: resolvedTextColor
      });
    });
    const headerTextElements = parsedTextElements.filter((element) => element.section === "header").sort((a, b) => a.y - b.y || a.x - b.x);
    if (!container.label) {
      const fallbackHeaderTextElements = headerTextElements.length === 0 && parsedTextElements.length === 1 ? parsedTextElements : headerTextElements;
      if (fallbackHeaderTextElements.length > 0) {
        container.label = {
          text: fallbackHeaderTextElements.map((element) => element.text).join("\n"),
          fontSize: Math.max(...fallbackHeaderTextElements.map((element) => element.fontSize)),
          color: fallbackHeaderTextElements.find((element) => element.color)?.color,
          verticalAlign: "top"
        };
      }
    }
    parsedTextElements.filter((element) => {
      if (headerTextElements.length > 0) {
        return element.section !== "header";
      }
      return !(container.label && parsedTextElements.length === 1);
    }).forEach((element) => {
      const textElement = createTextSkeleton((container?.x || 0) + 4, element.y, element.text, {
        width: element.width,
        height: element.height,
        fontSize: element.fontSize,
        color: element.color,
        id: nanoid(),
        groupId,
        metadata: { classId }
      });
      text.push(textElement);
    });
  });
  return { nodes, lines, text };
};
var parseRelations = (relations, classNodes, containerEl, direction) => {
  const relationEdges = Array.from(containerEl.querySelectorAll('.edgePaths path[data-edge="true"]:not([id^="edgeNote"]):not([id*="-cyclic-special-"])'));
  if (relations.length === 0) {
    return { arrows: [], text: [] };
  }
  const arrows = [];
  const text = [];
  let relationEdgeIndex = 0;
  relations.forEach((relationNode) => {
    const { id1, id2: id210, relation } = relationNode;
    const node1 = classNodes.find((node3) => node3.id === id1);
    const node2 = classNodes.find((node3) => node3.id === id210);
    if (!node1) {
      throw new Error(`parseRelations: Cannot find node with id ${id1}`);
    }
    if (!node2) {
      throw new Error(`parseRelations: Cannot find node with id ${id210}`);
    }
    const strokeStyle = getStrokeStyle2(relation.lineType);
    const startArrowhead = getArrowhead(relation.type1);
    const endArrowhead = getArrowhead(relation.type2);
    let arrow;
    if (id1 === id210) {
      const edgePaths = getSelfRelationEdgePaths(id1, containerEl);
      if (!edgePaths.length) {
        throw new Error(`parseRelations: Cannot find rendered SVG edge for relation ${id1} -> ${id210}`);
      }
      arrow = createPreservedRouteArrowFromEdgePaths(edgePaths, {
        strokeStyle,
        startArrowhead,
        endArrowhead,
        label: relationNode.title ? { text: relationNode.title } : void 0,
        start: { type: "rectangle", id: node1.id },
        end: { type: "rectangle", id: node2.id }
      });
    } else {
      const edgePath = relationEdges[relationEdgeIndex];
      if (!edgePath) {
        throw new Error(`parseRelations: Cannot find rendered SVG edge for relation ${id1} -> ${id210}`);
      }
      relationEdgeIndex += 1;
      arrow = createStraightClassRelationArrowFromEdgePath(edgePath, {
        strokeStyle,
        startArrowhead,
        endArrowhead,
        label: relationNode.title ? { text: relationNode.title } : void 0,
        start: { type: "rectangle", id: node1.id },
        end: { type: "rectangle", id: node2.id }
      });
    }
    arrows.push(arrow);
    const { relationTitle1, relationTitle2 } = relationNode;
    const isSelfRelation = id1 === id210;
    const offsetX = 20;
    const offsetY = 15;
    const directionOffset = 15;
    let x;
    let y;
    if (relationTitle1 && relationTitle1 !== "none") {
      if (isSelfRelation) {
        const position2 = getSelfRelationTitlePosition(arrow, "start");
        if (position2) {
          x = position2.x;
          y = position2.y;
        }
      } else {
        switch (direction) {
          case "TB":
            x = arrow.startX - offsetX;
            if (arrow.endX < arrow.startX) {
              x -= directionOffset;
            }
            y = arrow.startY + offsetY;
            break;
          case "BT":
            x = arrow.startX + offsetX;
            if (arrow.endX > arrow.startX) {
              x += directionOffset;
            }
            y = arrow.startY - offsetY;
            break;
          case "LR":
            x = arrow.startX + offsetX;
            y = arrow.startY + offsetY;
            if (arrow.endY > arrow.startY) {
              y += directionOffset;
            }
            break;
          case "RL":
            x = arrow.startX - offsetX;
            y = arrow.startY - offsetY;
            if (arrow.startY > arrow.endY) {
              y -= directionOffset;
            }
            break;
          default:
            x = arrow.startX - offsetX;
            y = arrow.startY + offsetY;
        }
      }
      x ??= arrow.startX - offsetX;
      y ??= arrow.startY + offsetY;
      const relationTitleElement = createTextSkeleton(x, y, relationTitle1, {
        fontSize: 16
      });
      text.push(relationTitleElement);
    }
    if (relationTitle2 && relationTitle2 !== "none") {
      if (isSelfRelation) {
        const position2 = getSelfRelationTitlePosition(arrow, "end");
        if (position2) {
          x = position2.x;
          y = position2.y;
        }
      } else {
        switch (direction) {
          case "TB":
            x = arrow.endX + offsetX;
            if (arrow.endX < arrow.startX) {
              x += directionOffset;
            }
            y = arrow.endY - offsetY;
            break;
          case "BT":
            x = arrow.endX - offsetX;
            if (arrow.endX > arrow.startX) {
              x -= directionOffset;
            }
            y = arrow.endY + offsetY;
            break;
          case "LR":
            x = arrow.endX - offsetX;
            y = arrow.endY - offsetY;
            if (arrow.endY > arrow.startY) {
              y -= directionOffset;
            }
            break;
          case "RL":
            x = arrow.endX + offsetX;
            y = arrow.endY + offsetY;
            if (arrow.startY > arrow.endY) {
              y += directionOffset;
            }
            break;
          default:
            x = arrow.endX + offsetX;
            y = arrow.endY - offsetY;
        }
      }
      x ??= arrow.endX + offsetX;
      y ??= arrow.endY + offsetY;
      const relationTitleElement = createTextSkeleton(x, y, relationTitle2, {
        fontSize: 16
      });
      text.push(relationTitleElement);
    }
  });
  return { arrows, text };
};
var parseNotes = (notes, containerEl, classNodes) => {
  const noteContainers = [];
  const connectors = [];
  notes.forEach((note, index) => {
    const { id: id30, text, class: classId } = note;
    const node2 = containerEl.querySelector(`#${id30}`);
    if (!node2) {
      throw new Error(`Node with id ${id30} not found!`);
    }
    const { transformX, transformY } = getTransformAttr(node2);
    const rect = node2.firstChild;
    const container = createContainerSkeletonFromSVG(rect, "rectangle", {
      id: id30,
      subtype: "note",
      label: { text }
    });
    Object.assign(container, {
      x: container.x + transformX,
      y: container.y + transformY
    });
    noteContainers.push(container);
    if (classId) {
      const classNode = classNodes.find((node3) => node3.id === classId);
      if (!classNode) {
        throw new Error(`class node with id ${classId} not found!`);
      }
      const edgePath = containerEl.querySelector(`path[id="edgeNote${index + 1}"][data-edge="true"]`);
      if (edgePath) {
        connectors.push(createArrowFromEdgePath(edgePath, {
          strokeStyle: "dotted",
          startArrowhead: null,
          endArrowhead: null,
          start: { id: container.id, type: "rectangle" },
          end: { id: classNode.id, type: "rectangle" }
        }));
        return;
      }
      const startX = container.x + (container.width || 0) / 2;
      const startY = container.y + (container.height || 0);
      const endX = startX;
      const endY = classNode.y;
      const connector = createArrowSkeletion(startX, startY, endX, endY, {
        strokeStyle: "dotted",
        startArrowhead: null,
        endArrowhead: null,
        start: { id: container.id, type: "rectangle" },
        end: { id: classNode.id, type: "rectangle" }
      });
      connectors.push(connector);
    }
  });
  return { notes: noteContainers, connectors };
};
var parseMermaidClassDiagram = (diagram2, containerEl) => {
  const db = diagram2.db;
  const direction = db.getDirection?.() || "TB";
  const nodes = [];
  const lines = [];
  const text = [];
  const classNodes = [];
  const namespaces = db.getNamespaces?.() || [];
  const classesData = db.getClasses?.() || {};
  const classes = classesData instanceof Map ? Object.fromEntries(classesData) : classesData;
  if (classes && Object.keys(classes).length) {
    const lookUpDomId = (
      //@ts-ignore
      typeof db.lookUpDomId === "function" ? (
        //@ts-ignore
        db.lookUpDomId.bind(db)
      ) : void 0
    );
    const classData = parseClasses(classes, containerEl, lookUpDomId);
    nodes.push(classData.nodes);
    lines.push(...classData.lines);
    text.push(...classData.text);
    classNodes.push(...classData.nodes);
  }
  const relations = db.getRelations?.() || [];
  const { arrows, text: relationTitles } = parseRelations(relations, classNodes, containerEl, direction);
  const notes = db.getNotes?.() || [];
  const { notes: noteContainers, connectors } = parseNotes(notes, containerEl, classNodes);
  nodes.push(noteContainers);
  arrows.push(...connectors);
  text.push(...relationTitles);
  return { type: "class", nodes, lines, arrows, text, namespaces };
};

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/parser/er.js
var ERD_TABLE_TEXT_FONT_SIZE = 18;
var parseStyleStrings2 = (styles) => {
  const styleObj = {};
  if (!styles) {
    return styleObj;
  }
  styles.forEach((style) => {
    parseCSSDeclarations(style).forEach(({ property, value }) => {
      if (property && value) {
        styleObj[property] = cleanCSSValue(value);
      }
    });
  });
  return styleObj;
};
var parseStrokeWidth = (value) => {
  if (value === null || value === void 0 || value === "") {
    return void 0;
  }
  const numericValue = typeof value === "number" ? value : parseFloat(cleanCSSValue(value));
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return void 0;
  }
  return numericValue;
};
var accumulateTranslation2 = (node2, stopAt) => {
  let tx = 0;
  let ty = 0;
  let current = node2;
  while (current && current !== stopAt) {
    const { transformX, transformY } = getTransformAttr(current);
    tx += transformX;
    ty += transformY;
    current = current.parentElement;
  }
  return { tx, ty };
};
var getTextContent = (node2) => {
  const tspans = Array.from(node2.querySelectorAll("tspan"));
  const text = tspans.length ? tspans.map((span) => span.textContent?.trim()).filter(Boolean).join("\n") : node2.textContent?.trim() || "";
  return entityCodesToText(text);
};
var getFontSize = (node2) => {
  const textNode = node2.querySelector("text, foreignObject, div, span, p") || node2;
  let fontSize = parseFloat(getComputedStyle(textNode).fontSize || "");
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    fontSize = Math.max(12, node2.getBBox().height * 0.75);
  }
  return fontSize;
};
var parseTextGroup = (group, containerEl, fallbackColor) => {
  const text = getTextContent(group);
  if (!text) {
    return null;
  }
  const bbox = group.getBBox();
  const { tx, ty } = accumulateTranslation2(group, containerEl);
  return {
    className: group.getAttribute("class") || "",
    text,
    x: bbox.x + tx,
    y: bbox.y + ty,
    width: bbox.width,
    height: bbox.height,
    fontSize: getFontSize(group),
    color: resolveElementTextColor(group, fallbackColor)
  };
};
var getDividerLine = (dividerNode, containerEl, groupId, entityId, fallbackStrokeColor, fallbackStrokeWidth, fallbackStrokeStyle) => {
  const { tx, ty } = accumulateTranslation2(dividerNode, containerEl);
  let startX = 0;
  let startY = 0;
  let endX = 0;
  let endY = 0;
  if (dividerNode.tagName.toLowerCase() === "line") {
    startX = Number(dividerNode.getAttribute("x1")) + tx;
    startY = Number(dividerNode.getAttribute("y1")) + ty;
    endX = Number(dividerNode.getAttribute("x2")) + tx;
    endY = Number(dividerNode.getAttribute("y2")) + ty;
  } else {
    const coords = getPathCoordinates(dividerNode);
    if (!coords) {
      return null;
    }
    startX = coords.startX + tx;
    startY = coords.startY + ty;
    endX = coords.endX + tx;
    endY = coords.endY + ty;
  }
  const line2 = {
    type: "line",
    id: nanoid(),
    groupId,
    startX,
    startY,
    endX,
    endY,
    metadata: { entityId }
  };
  if (fallbackStrokeColor && isValidCSSColor(fallbackStrokeColor) && fallbackStrokeColor !== "none") {
    line2.strokeColor = fallbackStrokeColor;
  }
  if (fallbackStrokeWidth !== void 0) {
    line2.strokeWidth = fallbackStrokeWidth;
  }
  if (fallbackStrokeStyle) {
    line2.strokeStyle = fallbackStrokeStyle;
  }
  return line2;
};
var getCardinalityArrowhead = (arrowType) => {
  switch (arrowType?.toLowerCase()) {
    case "one":
      return "cardinality_one";
    case "many":
      return "cardinality_many";
    case "only_one":
      return "cardinality_exactly_one";
    case "one_or_more":
      return "cardinality_one_or_many";
    case "zero_or_one":
      return "cardinality_zero_or_one";
    case "zero_or_more":
      return "cardinality_zero_or_many";
    default:
      return null;
  }
};
var getStrokeStyle3 = (pattern) => {
  switch (pattern) {
    case "dotted":
      return "dotted";
    case "dashed":
      return "dashed";
    default:
      return "solid";
  }
};
var getRelationshipPaths = (edge, containerEl) => {
  const directPath = containerEl.querySelector(`path[id="${edge.id}"][data-edge="true"]`);
  if (directPath) {
    return [directPath];
  }
  if (edge.start !== edge.end) {
    return [];
  }
  const cyclicPathIds = [
    `${edge.start}-cyclic-special-1`,
    `${edge.start}-cyclic-special-mid`,
    `${edge.start}-cyclic-special-2`
  ];
  return cyclicPathIds.map((pathId) => containerEl.querySelector(`path[id="${pathId}"][data-edge="true"]`)).filter((path) => path !== null);
};
var mergeEdgePoints = (edgePaths) => {
  const mergedPoints = [];
  edgePaths.forEach((edgePath) => {
    getDecodedEdgePoints(edgePath).forEach((point3) => {
      const previousPoint = mergedPoints[mergedPoints.length - 1];
      if (previousPoint && previousPoint.x === point3.x && previousPoint.y === point3.y) {
        return;
      }
      mergedPoints.push(point3);
    });
  });
  return mergedPoints;
};
var parseEntity = (entity, containerEl) => {
  const domNode = containerEl.querySelector(`[id="${entity.id}"]`);
  if (!domNode) {
    throw new Error(`ER entity ${entity.id} not found in rendered SVG`);
  }
  const groupId = entity.attributes.length ? nanoid() : void 0;
  const bbox = domNode.getBBox();
  const { tx, ty } = accumulateTranslation2(domNode, containerEl);
  const nodeStyle = parseStyleStrings2([
    ...entity.cssStyles || [],
    ...entity.cssCompiledStyles || []
  ]);
  const fill = cleanCSSValue(nodeStyle.fill || "");
  const stroke = cleanCSSValue(nodeStyle.stroke || "");
  const strokeWidth = parseStrokeWidth(nodeStyle["stroke-width"]);
  const dashArray = cleanCSSValue(nodeStyle["stroke-dasharray"] || "");
  const labelGroups = Array.from(domNode.querySelectorAll("g.label")).map((group) => parseTextGroup(group, containerEl, nodeStyle.color)).filter((group) => group !== null);
  const titleGroup = labelGroups.find((group) => group.className.includes("name")) || labelGroups[0];
  const attributeGroups = labelGroups.filter((group) => group !== titleGroup);
  const titleText = titleGroup?.text || entityCodesToText(entity.alias || entity.label || "");
  const container = {
    type: "rectangle",
    id: entity.id,
    groupId,
    x: bbox.x + tx,
    y: bbox.y + ty,
    width: bbox.width,
    height: bbox.height,
    label: {
      text: titleText,
      fontSize: entity.attributes.length ? ERD_TABLE_TEXT_FONT_SIZE : titleGroup?.fontSize || 16,
      color: titleGroup?.color,
      textAlign: "center",
      verticalAlign: entity.attributes.length ? "top" : "middle"
    },
    metadata: {
      entityId: entity.id,
      entityLabel: entity.label,
      entityAlias: entity.alias
    }
  };
  if (isValidCSSColor(fill) && fill !== "none") {
    container.bgColor = fill;
  }
  if (isValidCSSColor(stroke) && stroke !== "none") {
    container.strokeColor = stroke;
  }
  if (strokeWidth && Number.isFinite(strokeWidth) && strokeWidth > 0) {
    container.strokeWidth = strokeWidth;
  }
  if (dashArray && dashArray !== "none") {
    container.strokeStyle = "dashed";
  }
  const lines = Array.from(domNode.querySelectorAll(".divider path, path.divider, line.divider")).map((dividerNode) => getDividerLine(dividerNode, containerEl, groupId, entity.id, container.strokeColor, container.strokeWidth, container.strokeStyle)).filter((line2) => line2 !== null);
  const text = attributeGroups.map((group) => createTextSkeleton(group.x, group.y, group.text, {
    id: nanoid(),
    groupId,
    width: group.width,
    height: group.height,
    fontSize: ERD_TABLE_TEXT_FONT_SIZE,
    color: group.color,
    metadata: { entityId: entity.id }
  }));
  return { container, lines, text };
};
var parseRelationship = (edge, containerEl) => {
  const edgePaths = getRelationshipPaths(edge, containerEl);
  if (!edgePaths.length) {
    throw new Error(`ER relationship ${edge.id} not found in rendered SVG`);
  }
  const points = mergeEdgePoints(edgePaths);
  if (points.length < 2) {
    throw new Error(`ER relationship ${edge.id} is missing usable path points`);
  }
  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  const edgePath = edgePaths[0];
  const strokeColor = cleanCSSValue(edgePath.getAttribute("stroke") || getComputedStyle(edgePath).stroke || "");
  const strokeWidth = Number(edgePath.getAttribute("stroke-width") || getComputedStyle(edgePath).strokeWidth || 1);
  const arrow = createArrowSkeletion(startPoint.x, startPoint.y, endPoint.x, endPoint.y, {
    id: edge.id,
    label: edge.label ? {
      text: entityCodesToText(edge.label),
      fontSize: 16,
      textAlign: "center"
    } : void 0,
    strokeStyle: getStrokeStyle3(edge.pattern),
    startArrowhead: getCardinalityArrowhead(edge.arrowTypeStart),
    endArrowhead: getCardinalityArrowhead(edge.arrowTypeEnd),
    start: { type: "rectangle", id: edge.start },
    end: { type: "rectangle", id: edge.end },
    points: points.map((point3) => [
      point3.x - startPoint.x,
      point3.y - startPoint.y
    ])
  });
  if (isValidCSSColor(strokeColor) && strokeColor !== "none") {
    arrow.strokeColor = strokeColor;
  }
  if (Number.isFinite(strokeWidth) && strokeWidth > 0) {
    arrow.strokeWidth = strokeWidth;
  }
  return arrow;
};
var parseMermaidERDiagram = (db, containerEl) => {
  const data = db.getData();
  const entities = data.nodes;
  const edges = data.edges;
  const containers = [];
  const lines = [];
  const text = [];
  entities.forEach((entity) => {
    const parsedEntity = parseEntity(entity, containerEl);
    containers.push(parsedEntity.container);
    lines.push(...parsedEntity.lines);
    text.push(...parsedEntity.text);
  });
  const arrows = edges.map((edge) => parseRelationship(edge, containerEl));
  return {
    type: "erd",
    nodes: [containers],
    lines,
    arrows,
    text
  };
};

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/parser/state.js
var isMeaningfulCSSColor = (value) => {
  const normalizedValue = cleanCSSValue(value || "");
  if (!normalizedValue) {
    return false;
  }
  if (normalizedValue === "none" || normalizedValue === "transparent" || normalizedValue === "rgba(0, 0, 0, 0)" || normalizedValue === "rgba(0,0,0,0)") {
    return false;
  }
  return isValidCSSColor(normalizedValue);
};
var applyContainerStyleProperty2 = (style, property, value) => {
  switch (property) {
    case CONTAINER_STYLE_PROPERTY.FILL:
    case CONTAINER_STYLE_PROPERTY.STROKE:
      if (isMeaningfulCSSColor(value)) {
        style[property] = cleanCSSValue(value);
      }
      break;
    case CONTAINER_STYLE_PROPERTY.STROKE_WIDTH:
    case CONTAINER_STYLE_PROPERTY.STROKE_DASHARRAY:
      if (cleanCSSValue(value)) {
        style[property] = cleanCSSValue(value);
      }
      break;
  }
};
var applyLabelStyleProperty2 = (style, property, value) => {
  if (property === LABEL_STYLE_PROPERTY.COLOR && isMeaningfulCSSColor(value)) {
    style[LABEL_STYLE_PROPERTY.COLOR] = cleanCSSValue(value);
  }
};
var applyStyleTextToStyles2 = (styleText, containerStyle, labelStyle) => {
  if (!styleText) {
    return;
  }
  parseCSSDeclarations(styleText).forEach(({ property, value }) => {
    applyContainerStyleProperty2(containerStyle, property, value);
    applyLabelStyleProperty2(labelStyle, property, value);
  });
};
var applyStyleTextToLabelStyle2 = (styleText, labelStyle) => {
  if (!styleText) {
    return;
  }
  parseCSSDeclarations(styleText).forEach(({ property, value }) => {
    if (property === CONTAINER_STYLE_PROPERTY.FILL && isMeaningfulCSSColor(value)) {
      labelStyle[LABEL_STYLE_PROPERTY.COLOR] = cleanCSSValue(value);
      return;
    }
    applyLabelStyleProperty2(labelStyle, property, value);
  });
};
var getExplicitStyleProperties = (styleTexts) => {
  const properties = /* @__PURE__ */ new Set();
  styleTexts.filter(Boolean).forEach((styleText) => {
    parseCSSDeclarations(styleText || "").forEach(({ property }) => {
      properties.add(property);
    });
  });
  return properties;
};
var applyElementAttributesToContainerStyle2 = (element, containerStyle, explicitProperties) => {
  if (!element) {
    return;
  }
  const attrs = [
    [CONTAINER_STYLE_PROPERTY.FILL, element.getAttribute("fill")],
    [CONTAINER_STYLE_PROPERTY.STROKE, element.getAttribute("stroke")],
    [
      CONTAINER_STYLE_PROPERTY.STROKE_WIDTH,
      element.getAttribute("stroke-width")
    ],
    [
      CONTAINER_STYLE_PROPERTY.STROKE_DASHARRAY,
      element.getAttribute("stroke-dasharray")
    ]
  ];
  attrs.forEach(([property, rawValue]) => {
    if (!explicitProperties.has(property)) {
      return;
    }
    if (containerStyle[property]) {
      return;
    }
    const value = cleanCSSValue(rawValue || "");
    if (!value) {
      return;
    }
    applyContainerStyleProperty2(containerStyle, property, value);
  });
};
var applyElementAttributesToLabelStyle2 = (element, labelStyle, explicitProperties) => {
  if (!element) {
    return;
  }
  const candidates = [
    element,
    ...Array.from(element.querySelectorAll("text, foreignObject, div, span, p"))
  ];
  for (const candidate of candidates) {
    if (labelStyle[LABEL_STYLE_PROPERTY.COLOR]) {
      break;
    }
    if (explicitProperties.has(LABEL_STYLE_PROPERTY.COLOR) || explicitProperties.has(CONTAINER_STYLE_PROPERTY.FILL)) {
      applyStyleTextToLabelStyle2(candidate.getAttribute("style"), labelStyle);
      if (labelStyle[LABEL_STYLE_PROPERTY.COLOR]) {
        break;
      }
    }
    const color = cleanCSSValue(candidate.getAttribute("fill") || candidate.getAttribute("color") || "");
    if ((explicitProperties.has(LABEL_STYLE_PROPERTY.COLOR) || explicitProperties.has(CONTAINER_STYLE_PROPERTY.FILL)) && isMeaningfulCSSColor(color)) {
      labelStyle[LABEL_STYLE_PROPERTY.COLOR] = color;
    }
  }
};
var accumulateTranslation3 = (node2, stopAt) => {
  let tx = 0;
  let ty = 0;
  let current = node2;
  while (current && current !== stopAt) {
    const { transformX, transformY } = getTransformAttr(current);
    tx += transformX;
    ty += transformY;
    current = current.parentElement;
  }
  return { tx, ty };
};
var getAbsoluteBounds = (node2, containerEl) => {
  const bbox = node2.getBBox();
  const { tx, ty } = accumulateTranslation3(node2, containerEl);
  return {
    x: bbox.x + tx,
    y: bbox.y + ty,
    width: bbox.width,
    height: bbox.height
  };
};
var getDividerLine2 = (nodeEl, containerEl) => {
  const dividerLine = nodeEl.querySelector("line.divider");
  if (!dividerLine) {
    return void 0;
  }
  const { tx, ty } = accumulateTranslation3(dividerLine, containerEl);
  return {
    startX: Number(dividerLine.getAttribute("x1")) + tx,
    startY: Number(dividerLine.getAttribute("y1")) + ty,
    endX: Number(dividerLine.getAttribute("x2")) + tx,
    endY: Number(dividerLine.getAttribute("y2")) + ty
  };
};
var getShapeArea = (element) => {
  const bounds = element.getBBox();
  return Math.abs(bounds.width * bounds.height);
};
var getExplicitStyleValue = (element, property) => {
  const styleText = element.getAttribute("style");
  if (!styleText) {
    return void 0;
  }
  const declaration2 = parseCSSDeclarations(styleText).find((entry) => entry.property === property);
  if (!declaration2) {
    return void 0;
  }
  return cleanCSSValue(declaration2.value);
};
var pickShapeElement = (elements, strategy) => {
  const candidates = elements.map((element) => ({ element, area: getShapeArea(element) })).filter(({ area }) => Number.isFinite(area) && area > 0);
  if (candidates.length === 0) {
    return null;
  }
  const sortedCandidates = candidates.sort((left, right) => strategy === "largest" ? right.area - left.area : left.area - right.area);
  return sortedCandidates[0].element;
};
var getElementShapeColor = (element, explicitProperties) => {
  if (!element) {
    return void 0;
  }
  if (!explicitProperties.has(CONTAINER_STYLE_PROPERTY.FILL) && !explicitProperties.has(CONTAINER_STYLE_PROPERTY.STROKE)) {
    return void 0;
  }
  const fill = cleanCSSValue(element.getAttribute("fill") || getExplicitStyleValue(element, CONTAINER_STYLE_PROPERTY.FILL) || "");
  const stroke = cleanCSSValue(element.getAttribute("stroke") || getExplicitStyleValue(element, CONTAINER_STYLE_PROPERTY.STROKE) || "");
  if (isMeaningfulCSSColor(fill)) {
    return fill;
  }
  if (isMeaningfulCSSColor(stroke)) {
    return stroke;
  }
  return void 0;
};
var getEndStateInnerColor = (nodeEl, explicitProperties) => {
  const shapeElements = Array.from(nodeEl.querySelectorAll("circle, ellipse, path"));
  const innerShapeElement = pickShapeElement(shapeElements, "smallest");
  return getElementShapeColor(innerShapeElement, explicitProperties);
};
var trimSharedTrailingLineIndentation = (lines) => {
  if (lines.length < 2) {
    return lines;
  }
  const trailingLines = lines.slice(1);
  const commonIndent = trailingLines.filter((line2) => line2.trim().length > 0).reduce((minIndent, line2) => {
    const indent = line2.match(/^\s*/)?.[0].length ?? 0;
    return Math.min(minIndent, indent);
  }, Number.POSITIVE_INFINITY);
  if (!Number.isFinite(commonIndent) || commonIndent <= 0) {
    return lines.map((line2) => line2.trimEnd());
  }
  return [
    lines[0].trimEnd(),
    ...trailingLines.map((line2) => line2.replace(new RegExp(`^\\s{0,${commonIndent}}`), "").trimEnd())
  ];
};
var getStateLabelText = (node2) => {
  const labelLines = Array.isArray(node2.label) ? node2.label.map((entry) => entityCodesToText(entry)) : entityCodesToText(node2.label || "").split("\n");
  const labelText = trimSharedTrailingLineIndentation(labelLines).join("\n");
  return labelText;
};
var getStateDescription = (node2) => {
  if (!node2.description) {
    return [];
  }
  const description = Array.isArray(node2.description) ? node2.description : [node2.description];
  return description.map((entry) => entityCodesToText(entry)).filter((entry) => entry.length > 0);
};
var createNodeElementResolver = (containerEl) => {
  const usedElements = /* @__PURE__ */ new Set();
  const markAndReturn = (element) => {
    if (element) {
      usedElements.add(element);
    }
    return element;
  };
  const getNextUnusedCandidate = (elements) => {
    const candidate = elements.find((element) => !usedElements.has(element));
    return markAndReturn(candidate || null);
  };
  return (node2) => {
    const selectors = [
      `[id='${node2.domId}']`,
      `[id='${node2.id}']`,
      `[data-id='${node2.id}']`
    ];
    for (const selector of selectors) {
      const element = containerEl.querySelector(selector);
      if (element) {
        return markAndReturn(element);
      }
    }
    switch (node2.shape) {
      case "divider":
        return getNextUnusedCandidate(Array.from(containerEl.querySelectorAll("g.statediagram-cluster-alt")));
      case "stateStart":
        return getNextUnusedCandidate(Array.from(containerEl.querySelectorAll("g.node.default")).filter((element) => element.querySelector("circle.state-start")));
      case "stateEnd":
        return getNextUnusedCandidate(Array.from(containerEl.querySelectorAll("g.node.default")).filter((element) => !element.querySelector("circle.state-start")));
      default:
        return null;
    }
  };
};
var findShapeElement = (nodeEl, shape) => {
  switch (shape) {
    case "roundedWithTitle":
      return nodeEl.querySelector("rect.outer") || nodeEl.querySelector("rect") || nodeEl;
    case "divider":
      return nodeEl.querySelector("rect.divider") || nodeEl.querySelector("rect") || nodeEl;
    case "rectWithTitle":
      return nodeEl.querySelector("rect.outer") || nodeEl.querySelector("rect") || nodeEl;
    case "stateStart":
      return pickShapeElement(Array.from(nodeEl.querySelectorAll("circle, ellipse, path")), "largest") || nodeEl;
    case "stateEnd":
      return pickShapeElement(Array.from(nodeEl.querySelectorAll("circle, ellipse, path")), "largest") || nodeEl;
    case "choice":
    case "fork":
    case "join":
    case "note":
    case "rect":
    default:
      return nodeEl.querySelector("rect, path, circle, ellipse, polygon") || nodeEl;
  }
};
var parseStateNode = (node2, containerEl, resolveNodeElement) => {
  const nodeEl = resolveNodeElement(node2);
  if (!nodeEl) {
    throw new Error(`State node element not found for "${node2.id}"`);
  }
  const shapeEl = findShapeElement(nodeEl, node2.shape);
  const containerStyle = {};
  const labelStyle = {};
  const explicitStyleTexts = [
    node2.labelStyle,
    ...node2.cssCompiledStyles || [],
    ...node2.cssStyles || []
  ];
  const explicitStyleProperties = getExplicitStyleProperties(explicitStyleTexts);
  explicitStyleTexts.filter(Boolean).forEach((styleText) => {
    applyStyleTextToStyles2(styleText, containerStyle, labelStyle);
  });
  applyElementAttributesToContainerStyle2(shapeEl, containerStyle, explicitStyleProperties);
  applyElementAttributesToLabelStyle2(nodeEl, labelStyle, explicitStyleProperties);
  const bounds = getAbsoluteBounds(shapeEl, containerEl);
  return {
    id: node2.id,
    shape: node2.shape,
    text: getStateLabelText(node2),
    description: getStateDescription(node2),
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    parentId: node2.parentId,
    position: node2.position,
    containerStyle,
    labelStyle,
    dividerLine: node2.shape === "rectWithTitle" ? getDividerLine2(nodeEl, containerEl) : void 0,
    endInnerColor: node2.shape === "stateEnd" ? getEndStateInnerColor(nodeEl, explicitStyleProperties) : void 0,
    isRenderable: node2.shape !== "noteGroup"
  };
};
var parseStateEdge = (edge, containerEl) => {
  const edgeEl = containerEl.querySelector(`[id='${edge.id}']`);
  if (!edgeEl) {
    return null;
  }
  const { tx, ty } = accumulateTranslation3(edgeEl, containerEl);
  const edgePositionData = computeEdgePositions(edgeEl, { x: tx, y: ty }, "MCL");
  if (edgePositionData.reflectionPoints.length < 2) {
    return null;
  }
  const edgeStyle = {};
  const applyEdgeStyleProperty = (property, value) => {
    switch (property) {
      case CONTAINER_STYLE_PROPERTY.STROKE:
        if (isMeaningfulCSSColor(value)) {
          edgeStyle.strokeColor = cleanCSSValue(value);
        }
        break;
      case CONTAINER_STYLE_PROPERTY.STROKE_WIDTH: {
        const strokeWidth = parseFloat(cleanCSSValue(value));
        if (Number.isFinite(strokeWidth) && strokeWidth > 0) {
          edgeStyle.strokeWidth = strokeWidth;
        }
        break;
      }
      case CONTAINER_STYLE_PROPERTY.STROKE_DASHARRAY:
        if (cleanCSSValue(value)) {
          edgeStyle.strokeStyle = "dashed";
        }
        break;
    }
  };
  [edge.style].filter(Boolean).forEach((styleText) => {
    parseCSSDeclarations(styleText || "").forEach(({ property, value }) => {
      applyEdgeStyleProperty(property, value);
    });
  });
  const isNoteEdge = edge.arrowhead === "none" || edge.classes?.includes("note-edge");
  return {
    id: edge.id,
    start: edge.start,
    end: edge.end,
    text: entityCodesToText(edge.label || ""),
    ...edgePositionData,
    strokeColor: edgeStyle.strokeColor,
    strokeWidth: edgeStyle.strokeWidth,
    strokeStyle: isNoteEdge ? "dashed" : edgeStyle.strokeStyle,
    isNoteEdge
  };
};
var parseMermaidStateDiagram = (db, containerEl) => {
  const { nodes, edges } = db.getData();
  const resolveNodeElement = createNodeElementResolver(containerEl);
  return {
    type: "state",
    nodes: nodes.map((node2) => parseStateNode(node2, containerEl, resolveNodeElement)),
    edges: edges.map((edge) => parseStateEdge(edge, containerEl)).filter((edge) => edge !== null)
  };
};

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/mermaidExecutionQueue.js
var mermaidTaskQueue = Promise.resolve();
var runMermaidTaskSequentially = (task) => {
  const run2 = mermaidTaskQueue.then(task, task);
  mermaidTaskQueue = run2.then(() => void 0, () => void 0);
  return run2;
};

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/parseMermaid.js
var lastConfigHash = null;
var renderCounter = 0;
var hashConfig = (config) => {
  return JSON.stringify(config);
};
var convertSvgToGraphImage = (svgContainer) => {
  const svgEl = svgContainer.querySelector("svg");
  if (!svgEl) {
    throw new Error("SVG element not found");
  }
  const rect = svgEl.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  svgEl.setAttribute("width", `${width}`);
  svgEl.setAttribute("height", `${height}`);
  const mimeType = "image/svg+xml";
  const decoded = unescape(encodeURIComponent(svgEl.outerHTML));
  const base64 = btoa(decoded);
  const dataURL = `data:image/svg+xml;base64,${base64}`;
  const graphImage = {
    type: "graphImage",
    mimeType,
    dataURL,
    width,
    height
  };
  return graphImage;
};
var parseMermaid = async (definition, config = MERMAID_CONFIG) => {
  return runMermaidTaskSequentially(async () => {
    const resolvedFontSize = config.themeVariables?.fontSize ?? MERMAID_CONFIG.themeVariables.fontSize;
    const mergedConfig = {
      ...MERMAID_CONFIG,
      ...config,
      fontSize: resolvedFontSize,
      themeVariables: {
        ...MERMAID_CONFIG.themeVariables,
        ...config.themeVariables,
        fontSize: resolvedFontSize
      }
    };
    const configHash = hashConfig(mergedConfig);
    if (configHash !== lastConfigHash) {
      mermaid_default.initialize(mergedConfig);
      lastConfigHash = configHash;
    }
    const diagram2 = await mermaid_default.mermaidAPI.getDiagramFromText(encodeEntities2(definition));
    const renderId = `mermaid-to-excalidraw-${renderCounter++}`;
    const svgContainer = document.createElement("div");
    svgContainer.setAttribute("style", `opacity: 0; position: fixed; z-index: -1; left: -99999px; top: -99999px;`);
    const containerId = `${renderId}-container`;
    svgContainer.id = containerId;
    document.getElementById(containerId)?.remove();
    document.body.appendChild(svgContainer);
    try {
      const { svg } = await mermaid_default.render(renderId, definition, svgContainer);
      svgContainer.innerHTML = svg;
      let data;
      try {
        switch (diagram2.type) {
          case "flowchart-v2":
          case "graph": {
            data = parseMermaidFlowChartDiagram(diagram2.db, svgContainer);
            break;
          }
          case "sequence": {
            data = parseMermaidSequenceDiagram(diagram2, svgContainer);
            break;
          }
          case "class":
          case "classDiagram": {
            data = parseMermaidClassDiagram(diagram2, svgContainer);
            break;
          }
          case "er": {
            data = parseMermaidERDiagram(diagram2.db, svgContainer);
            break;
          }
          case "state":
          case "stateDiagram": {
            data = parseMermaidStateDiagram(diagram2.db, svgContainer);
            break;
          }
          default: {
            data = convertSvgToGraphImage(svgContainer);
          }
        }
      } catch (error) {
        console.error("Error processing Mermaid diagram:", error);
        data = convertSvgToGraphImage(svgContainer);
      }
      return data;
    } finally {
      svgContainer.remove();
    }
  });
};

// node_modules/.pnpm/@excalidraw+mermaid-to-excalidraw@2.2.2/node_modules/@excalidraw/mermaid-to-excalidraw/dist/index.js
var parseMermaidToExcalidraw = async (definition, config) => {
  const mermaidConfig = config || {};
  const fontSize = parseInt(mermaidConfig.themeVariables?.fontSize ?? "") || DEFAULT_FONT_SIZE;
  const parsedMermaidData = await parseMermaid(definition, {
    ...mermaidConfig,
    themeVariables: {
      ...mermaidConfig.themeVariables
    }
  });
  const excalidrawElements = graphToExcalidraw(parsedMermaidData, {
    fontSize
  });
  return excalidrawElements;
};
export {
  parseMermaidToExcalidraw
};
/*! Bundled license information:

mermaid/dist/mermaid.core.mjs:
  (*! Check if previously processed *)
  (*!
   * Wait for document loaded before starting the execution
   *)
*/
