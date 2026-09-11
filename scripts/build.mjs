import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import StyleDictionary from "style-dictionary";

const generatedDirectory = new URL("../generated/", import.meta.url);
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

await rm(generatedDirectory, { force: true, recursive: true });
const exportedTokens = JSON.parse(
  await readFile(new URL("../tokens.json", import.meta.url), "utf8"),
);

for (const mode of modes) {
  const tokens = {
    Primitives: exportedTokens.Primitives,
    Semantic: exportedTokens[mode.collection],
  };
  const dictionary = new StyleDictionary({
    tokens,
    usesDtcg: true,
    platforms: {
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
    },
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
