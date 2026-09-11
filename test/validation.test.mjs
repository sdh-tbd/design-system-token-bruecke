import assert from "node:assert/strict";
import test from "node:test";
import { validateTokenFiles } from "../scripts/validation.mjs";

function documents(lightValue, darkValue = lightValue) {
  const primitives = {
    Primitives: {
      color: {
        blue: {
          "$type": "color",
          "$value": {
            colorSpace: "srgb",
            components: [0, 0.5, 1],
            alpha: 1,
          },
        },
      },
    },
  };
  const semantic = (value) => ({
    Semantic: {
      color: {
        brand: {
          "$type": "color",
          "$value": value,
        },
      },
    },
  });
  return [
    {
      path: "tokens/Primitives/Value.tokens.json",
      value: primitives,
    },
    {
      path: "tokens/Semantic/Light.tokens.json",
      value: semantic(lightValue),
    },
    {
      path: "tokens/Semantic/Dark.tokens.json",
      value: semantic(darkValue),
    },
  ];
}

test("accepts valid aliases and matching modes", () => {
  assert.deepEqual(
    validateTokenFiles(documents("{Primitives.color.blue}")),
    [],
  );
});

test("rejects missing aliases", () => {
  const errors = validateTokenFiles(documents("{Primitives.color.missing}"));
  assert.ok(errors.some((error) => error.includes("references missing token")));
});

test("rejects semantic mode mismatches", () => {
  const input = documents("{Primitives.color.blue}");
  input[2].value.Semantic.color = {};
  const errors = validateTokenFiles(input);
  assert.ok(errors.some((error) => error.includes("missing from Dark mode")));
});

test("rejects invalid color components", () => {
  const input = documents("{Primitives.color.blue}");
  input[0].value.Primitives.color.blue.$value.components[1] = 2;
  const errors = validateTokenFiles(input);
  assert.ok(errors.some((error) => error.includes("between 0 and 1")));
});
