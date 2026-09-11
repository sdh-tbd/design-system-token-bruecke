const tailwindNamespaces = {
  color: {
    css: "color",
    preset: "colors",
  },
  radius: {
    css: "radius",
    preset: "borderRadius",
  },
  space: {
    css: "spacing",
    preset: "spacing",
  },
  spacing: {
    css: "spacing",
    preset: "spacing",
  },
};

function kebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function createTailwindTokens(tokens) {
  const generatedNames = new Map();

  return tokens.flatMap((token) => {
    const [, category, ...tokenPath] = token.path;
    const namespace = tailwindNamespaces[kebabCase(category ?? "")];

    if (!namespace || tokenPath.length === 0) {
      return [];
    }

    const name = tokenPath.map(kebabCase).join("-");
    const cssName = `--${namespace.css}-${name}`;
    const sourceName = `--ds-${token.path.map(kebabCase).join("-")}`;
    const previousSource = generatedNames.get(cssName);

    if (previousSource) {
      throw new Error(
        `Tailwind token collision: ${previousSource} and ${sourceName} both generate ${cssName}`,
      );
    }

    generatedNames.set(cssName, sourceName);
    return [
      {
        cssName,
        name,
        presetNamespace: namespace.preset,
        sourceName,
      },
    ];
  });
}

export function formatTailwindTheme(tokens) {
  const declarations = tokens
    .map(({ cssName, sourceName }) => `  ${cssName}: var(${sourceName});`)
    .join("\n");

  return `@import "../css/index.css";

@theme inline {
${declarations}
}
`;
}

export function formatTailwindPreset(tokens) {
  const theme = {};

  for (const { name, presetNamespace, sourceName } of tokens) {
    theme[presetNamespace] ??= {};
    theme[presetNamespace][name] = `var(${sourceName})`;
  }

  const sections = Object.entries(theme)
    .map(
      ([namespace, values]) =>
        `      ${namespace}: ${JSON.stringify(values, null, 2).replaceAll("\n", "\n      ")},`,
    )
    .join("\n");

  return `export default {
  theme: {
    extend: {
${sections}
    },
  },
};
`;
}
