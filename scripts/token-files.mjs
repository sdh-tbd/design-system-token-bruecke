import { readFile } from "node:fs/promises";

export const tokenFiles = [
  "tokens/Primitives.tokens.json",
  "tokens/Semantic Light.tokens.json",
  "tokens/Semantic Dark.tokens.json",
];

export async function loadTokenDocuments() {
  return Promise.all(
    tokenFiles.map(async (path) => {
      let contents;
      try {
        contents = await readFile(path, "utf8");
      } catch (error) {
        throw new Error(
          `Unable to read required token file ${path}: ${error.message}`,
        );
      }

      try {
        return { path, value: JSON.parse(contents) };
      } catch (error) {
        throw new Error(`Invalid JSON in ${path}: ${error.message}`);
      }
    }),
  );
}

export function mergeTokenDocuments(documents) {
  return Object.assign({}, ...documents.map(({ value }) => value));
}
