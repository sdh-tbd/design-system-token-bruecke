const aliasPattern = /^\{([^{}]+)\}$/;
const supportedTypes = new Set(["color", "dimension"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function outputName(path) {
  return path
    .map((segment) =>
      segment
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase(),
    )
    .join("-");
}

function containsPlaceholder(value) {
  if (typeof value === "string") {
    return value.toLowerCase().includes("#missing#");
  }
  if (Array.isArray(value)) {
    return value.some(containsPlaceholder);
  }
  if (isRecord(value)) {
    return Object.values(value).some(containsPlaceholder);
  }
  return false;
}

function validateColor(value) {
  if (typeof value === "string" && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value)) {
    return;
  }
  if (!isRecord(value) || value.colorSpace !== "srgb") {
    return "must be a hex color or DTCG sRGB color object";
  }
  if (
    !Array.isArray(value.components) ||
    value.components.length !== 3 ||
    value.components.some(
      (component) =>
        component !== "none" &&
        (typeof component !== "number" ||
          !Number.isFinite(component) ||
          component < 0 ||
          component > 1),
    )
  ) {
    return "must contain three finite sRGB components between 0 and 1";
  }
  if (
    value.alpha !== undefined &&
    (typeof value.alpha !== "number" ||
      !Number.isFinite(value.alpha) ||
      value.alpha < 0 ||
      value.alpha > 1)
  ) {
    return "must have an alpha between 0 and 1";
  }
}

function validateDimension(value) {
  if (
    !isRecord(value) ||
    typeof value.value !== "number" ||
    !Number.isFinite(value.value) ||
    !["px", "rem"].includes(value.unit)
  ) {
    return "must be a finite DTCG dimension using px or rem";
  }
}

function collectTokens(document, source, tokens, errors, path = [], inheritedType) {
  if (!isRecord(document)) {
    errors.push(`${source}:${path.join(".") || "<root>"} must be an object`);
    return;
  }

  const currentType = document.$type ?? inheritedType;
  if ("$value" in document) {
    const name = path.join(".");
    if (path.length === 0) {
      errors.push(`${source}: token cannot be at the document root`);
      return;
    }
    if (!currentType) {
      errors.push(`${source}:${name} is missing $type`);
    } else if (!supportedTypes.has(currentType)) {
      errors.push(`${source}:${name} has unsupported $type "${currentType}"`);
    }
    if (tokens.has(name)) {
      errors.push(`${source}:${name} duplicates a token from ${tokens.get(name).source}`);
    } else {
      tokens.set(name, {
        source,
        type: currentType,
        value: document.$value,
      });
    }
    if (containsPlaceholder(document.$value)) {
      errors.push(`${source}:${name} contains an unresolved placeholder`);
    }
    return;
  }

  for (const [key, child] of Object.entries(document)) {
    if (key.startsWith("$")) {
      continue;
    }
    if (key.includes(".")) {
      errors.push(`${source}:${[...path, key].join(".")} contains "." in a path segment`);
    }
    collectTokens(child, source, tokens, errors, [...path, key], currentType);
  }
}

function validateReferences(tokens, errors) {
  for (const [name, token] of tokens) {
    const match = typeof token.value === "string" && token.value.match(aliasPattern);
    if (match && !tokens.has(match[1])) {
      errors.push(`${token.source}:${name} references missing token ${match[1]}`);
    }
  }

  const visit = (name, chain = []) => {
    if (chain.includes(name)) {
      errors.push(`Reference cycle: ${[...chain, name].join(" -> ")}`);
      return;
    }
    const token = tokens.get(name);
    const match = typeof token?.value === "string" && token.value.match(aliasPattern);
    if (match && tokens.has(match[1])) {
      visit(match[1], [...chain, name]);
    }
  };

  for (const name of tokens.keys()) {
    visit(name);
  }
}

function validateValues(tokens, errors) {
  for (const [name, token] of tokens) {
    if (typeof token.value === "string" && aliasPattern.test(token.value)) {
      continue;
    }
    const message =
      token.type === "color"
        ? validateColor(token.value)
        : token.type === "dimension"
          ? validateDimension(token.value)
          : undefined;
    if (message) {
      errors.push(`${token.source}:${name} ${message}`);
    }
  }
}

function validateOutputNames(tokens, errors) {
  const outputNames = new Map();
  for (const [path, token] of tokens) {
    const name = outputName(path.split("."));
    const existing = outputNames.get(name);
    if (existing && existing !== path) {
      errors.push(
        `${token.source}:${path} collides with ${existing} after output name transformation`,
      );
    } else {
      outputNames.set(name, path);
    }
  }
}

function semanticPaths(document, source, errors) {
  const tokens = new Map();
  collectTokens(document, source, tokens, errors);
  return new Set(
    [...tokens.keys()]
      .filter(
        (path) =>
          path.startsWith("Semantic Light.") || path.startsWith("Semantic Dark."),
      )
      .map((path) => path.replace(/^Semantic (?:Light|Dark)\./, "")),
  );
}

export function validateTokenFiles(documents) {
  const errors = [];
  const exported = documents.find((document) => document.path.endsWith("tokens.json"));
  if (!exported) {
    return ["tokens.json is required"];
  }

  const collections = ["Primitives", "Semantic Light", "Semantic Dark"];
  const missingCollections = collections.filter(
    (collection) => !isRecord(exported.value[collection]),
  );
  if (missingCollections.length > 0) {
    return [
      `tokens.json is missing collections: ${missingCollections.join(", ")}`,
    ];
  }

  const primitives = {
    path: exported.path,
    value: { Primitives: exported.value.Primitives },
  };
  const light = {
    path: exported.path,
    value: { "Semantic Light": exported.value["Semantic Light"] },
  };
  const dark = {
    path: exported.path,
    value: { "Semantic Dark": exported.value["Semantic Dark"] },
  };

  for (const mode of [light, dark]) {
    const tokens = new Map();
    collectTokens(primitives.value, primitives.path, tokens, errors);
    collectTokens(mode.value, mode.path, tokens, errors);
    validateReferences(tokens, errors);
    validateValues(tokens, errors);
    validateOutputNames(tokens, errors);
  }

  const lightPaths = semanticPaths(light.value, light.path, errors);
  const darkPaths = semanticPaths(dark.value, dark.path, errors);
  for (const path of lightPaths) {
    if (!darkPaths.has(path)) {
      errors.push(`Semantic token ${path} is missing from Dark mode`);
    }
  }
  for (const path of darkPaths) {
    if (!lightPaths.has(path)) {
      errors.push(`Semantic token ${path} is missing from Light mode`);
    }
  }

  return [...new Set(errors)];
}
