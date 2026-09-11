import { mkdir, rm, writeFile } from "node:fs/promises";
import StyleDictionary from "style-dictionary";
import {
  createTailwindTokens,
  formatTailwindPreset,
  formatTailwindTheme,
} from "./tailwind.mjs";
import {
  loadTokenDocuments,
  mergeTokenDocuments,
} from "./token-files.mjs";

const generatedDirectory = new URL("../generated/", import.meta.url);
const tailwindThemeFormat = "tailwind/v4-theme";
const tailwindPresetFormat = "tailwind/v3-preset";
const modes = [
  {
    collection: "Semantic Light",
    name: "light",
    selector: ":root",
  },
  {
    collection: "Semantic Dark",
    name: "dark",
    selector: '[data-theme="dark"]',
  },
];

StyleDictionary.registerFormat({
  name: tailwindThemeFormat,
  format: ({ dictionary }) =>
    formatTailwindTheme(createTailwindTokens(dictionary.allTokens)),
});
StyleDictionary.registerFormat({
  name: tailwindPresetFormat,
  format: ({ dictionary }) =>
    formatTailwindPreset(createTailwindTokens(dictionary.allTokens)),
});

await rm(generatedDirectory, { force: true, recursive: true });
const exportedTokens = mergeTokenDocuments(await loadTokenDocuments());

for (const mode of modes) {
  const tokens = {
    Primitives: exportedTokens.Primitives,
    Semantic: exportedTokens[mode.collection],
  };
  const platforms = {
    css: {
      transformGroup: "css",
      prefix: "ds",
      buildPath: "generated/css/",
      files: [
        {
          destination: `${mode.name}.css`,
          format: "css/variables",
          options: {
            outputReferences: true,
            selector: mode.selector,
            showFileHeader: false,
          },
        },
      ],
    },
    typescript: {
      transformGroup: "js",
      buildPath: `generated/typescript/${mode.name}/`,
      files: [
        {
          destination: "tokens.js",
          format: "javascript/es6",
          options: {
            showFileHeader: false,
          },
        },
        {
          destination: "tokens.d.ts",
          format: "typescript/es6-declarations",
          options: {
            showFileHeader: false,
          },
        },
      ],
    },
  };

  if (mode.name === "light") {
    platforms.tailwind = {
      transformGroup: "css",
      prefix: "ds",
      buildPath: "generated/tailwind/",
      files: [
        {
          destination: "theme.css",
          format: tailwindThemeFormat,
        },
        {
          destination: "preset.js",
          format: tailwindPresetFormat,
        },
      ],
    };
  }

  const dictionary = new StyleDictionary({
    tokens,
    usesDtcg: true,
    platforms,
  });

  await dictionary.buildAllPlatforms();
}

await mkdir(new URL("css/", generatedDirectory), { recursive: true });
await writeFile(
  new URL("css/index.css", generatedDirectory),
  '@import "./light.css";\n@import "./dark.css";\n',
);
await writeFile(
  new URL("typescript/index.js", generatedDirectory),
  'export * as light from "./light/tokens.js";\nexport * as dark from "./dark/tokens.js";\n',
);
await writeFile(
  new URL("typescript/index.d.ts", generatedDirectory),
  'export * as light from "./light/tokens.js";\nexport * as dark from "./dark/tokens.js";\n',
);
