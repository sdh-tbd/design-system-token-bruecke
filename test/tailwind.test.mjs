import assert from "node:assert/strict";
import test from "node:test";
import {
  createTailwindTokens,
  formatTailwindPreset,
  formatTailwindTheme,
} from "../scripts/tailwind.mjs";

const sourceTokens = [
  { path: ["Primitives", "color", "blue", "500"] },
  { path: ["Primitives", "space", "4"] },
  { path: ["Primitives", "radius", "md"] },
  { path: ["Semantic", "color", "background", "canvas"] },
];

test("maps design token paths to Tailwind namespaces", () => {
  assert.deepEqual(createTailwindTokens(sourceTokens), [
    {
      cssName: "--color-blue-500",
      name: "blue-500",
      presetNamespace: "colors",
      sourceName: "--ds-primitives-color-blue-500",
    },
    {
      cssName: "--spacing-4",
      name: "4",
      presetNamespace: "spacing",
      sourceName: "--ds-primitives-space-4",
    },
    {
      cssName: "--radius-md",
      name: "md",
      presetNamespace: "borderRadius",
      sourceName: "--ds-primitives-radius-md",
    },
    {
      cssName: "--color-background-canvas",
      name: "background-canvas",
      presetNamespace: "colors",
      sourceName: "--ds-semantic-color-background-canvas",
    },
  ]);
});

test("formats Tailwind v4 theme and v3 preset outputs", () => {
  const tokens = createTailwindTokens(sourceTokens);
  const theme = formatTailwindTheme(tokens);
  const preset = formatTailwindPreset(tokens);

  assert.match(theme, /@import "\.\.\/css\/index\.css";/);
  assert.match(
    theme,
    /--color-background-canvas: var\(--ds-semantic-color-background-canvas\);/,
  );
  assert.match(preset, /"background-canvas": "var\(--ds-semantic-color-background-canvas\)"/);
  assert.match(preset, /borderRadius/);
});

test("rejects Tailwind names produced by more than one token", () => {
  assert.throws(
    () =>
      createTailwindTokens([
        { path: ["Primitives", "color", "brand"] },
        { path: ["Semantic", "color", "brand"] },
      ]),
    /Tailwind token collision/,
  );
});
