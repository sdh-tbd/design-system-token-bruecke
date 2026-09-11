import { readFile } from "node:fs/promises";
import process from "node:process";
import { validateTokenFiles } from "./validation.mjs";

const tokenFiles = ["tokens.json"];

const documents = await Promise.all(
  tokenFiles.map(async (path) => {
    let contents;
    try {
      contents = await readFile(path, "utf8");
    } catch (error) {
      throw new Error(`Unable to read required token file ${path}: ${error.message}`);
    }

    try {
      return { path, value: JSON.parse(contents) };
    } catch (error) {
      throw new Error(`Invalid JSON in ${path}: ${error.message}`);
    }
  }),
);

const errors = validateTokenFiles(documents);

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${documents.length} token files.`);
}
