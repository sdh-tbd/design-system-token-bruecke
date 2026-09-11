import process from "node:process";
import { loadTokenDocuments } from "./token-files.mjs";
import { validateTokenFiles } from "./validation.mjs";

const documents = await loadTokenDocuments();
const errors = validateTokenFiles(documents);

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${documents.length} token files.`);
}
