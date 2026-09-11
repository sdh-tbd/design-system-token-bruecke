import { mkdir, rm, writeFile } from "node:fs/promises";
import StyleDictionary from "style-dictionary";

const generatedDirectory = new URL("../generated/", import.meta.url);
const modes = [
  {
    name: "light",
    source: "tokens/Semantic/Light.tokens.json",
    selector: ":root",
  },
  {
    name: "dark",
    source: "tokens/Semantic/Dark.tokens.json",
    selector: '[data-theme="dark"]',
  },
];

await rm(generatedDirectory, { force: true, recursive: true });

for (const mode of modes) {
  const dictionary = new StyleDictionary({
    source: ["tokens/Primitives/Value.tokens.json", mode.source],
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
            format: "javascript/esm",
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
