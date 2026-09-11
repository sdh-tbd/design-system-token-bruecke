# Design system token bridge

A proof-of-concept pipeline from Figma Variables to versioned CSS, typed
JavaScript, and Tailwind themes. Token Brücke exports DTCG JSON, pull requests
provide the review boundary, Style Dictionary builds deterministic outputs,
and version tags publish `@sdh-tbd/design-system-token-bruecke` to GitHub
Packages.

```text
Figma Variables
    -> Token Brücke plugin
    -> tokens/*.tokens.json
    -> pull request validation
    -> Style Dictionary
    -> CSS + typed JavaScript + Tailwind theme
    -> GitHub Packages
```

## Figma Starter setup

Figma's Variables REST API is restricted to Enterprise organizations, so this
repository intentionally uses a manual plugin export. Create one small Figma
file with these collections:

| Collection | Modes | Suggested variables |
| --- | --- | --- |
| `Primitives` | `Value` | `color/blue/500`, `color/blue/700`, `color/gray/50`, `color/gray/900`, `color/white`, `space/2`, `space/4`, `radius/sm`, `radius/md` |
| `Semantic Light` | `Value` | `color/background/canvas`, `color/background/brand`, `color/text/default`, `color/text/on-brand`, `color/border/default` |
| `Semantic Dark` | `Value` | The same paths as `Semantic Light`, with dark aliases |

Use Color variables for colors and Number variables for spacing and radii.
Alias every Semantic value to a Primitives value. Separate Semantic collections
represent the themes because Figma Starter allows only one mode per collection.

Install the Token Brücke Figma plugin and match
[`tokens-bruecke.config.json`](./tokens-bruecke.config.json):

- DTCG output enabled
- sRGB DTCG colors
- split collections into separate files
- split by mode disabled
- collection names retained
- Figma metadata disabled
- styles disabled

Configure the Token Brücke GitHub or GitHub PR server to write:

```text
Base branch: main
Branch:     figma/tokens
File name: tokens
```

With collection splitting enabled, Token Brücke treats this field as a folder
and writes:

```text
tokens/Primitives.tokens.json
tokens/Semantic Light.tokens.json
tokens/Semantic Dark.tokens.json
```

Keep collection names in the exported JSON. Open a pull request after
exporting. CI rejects missing collections, invalid values, broken aliases,
light/dark mismatches, transformed-name collisions, and token changes from any
source branch other than `figma/tokens`. It then builds CSS, TypeScript, and
Tailwind outputs and uploads the packed npm package as a workflow artifact.

## Local development

Requires Node.js 24 and pnpm 10:

```sh
corepack enable
pnpm install
pnpm check
pnpm test
```

`pnpm build` regenerates `generated/`. Do not edit generated files directly.

## Consume the package

Configure the consuming repository:

```ini
# .npmrc
@sdh-tbd:registry=https://npm.pkg.github.com
```

Install a published version:

```sh
pnpm add @sdh-tbd/design-system-token-bruecke
```

Import both CSS themes:

```css
@import "@sdh-tbd/design-system-token-bruecke/css";
```

Light is applied to `:root`; dark overrides it under
`[data-theme="dark"]`. JavaScript consumers can import either theme:

```js
import { dark, light } from "@sdh-tbd/design-system-token-bruecke";
```

### Tailwind CSS

For Tailwind CSS v4, import the generated theme after Tailwind:

```css
@import "tailwindcss";
@import "@sdh-tbd/design-system-token-bruecke/tailwind";
```

The custom Style Dictionary Tailwind format emits an `@theme inline` block
that registers utilities backed by the package's CSS variables. For example:

```tsx
<div className="bg-background-canvas text-text-default p-4 rounded-md" />
```

The same utility classes automatically use dark values inside
`[data-theme="dark"]`.

For Tailwind CSS v3, import the token CSS in the application's global
stylesheet:

```css
@import "@sdh-tbd/design-system-token-bruecke/css";
```

Then add the generated preset:

```js
import designTokens from "@sdh-tbd/design-system-token-bruecke/tailwind/preset";

export default {
  presets: [designTokens],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
};
```

Authenticate package installs with a GitHub personal access token (classic)
that has `read:packages`, either through `npm login --scope=@sdh-tbd
--auth-type=legacy --registry=https://npm.pkg.github.com` or an `NPM_TOKEN`
referenced from the consumer's user-level `.npmrc`. Never commit the token.

## Publish

Pull requests validate, build, package, and upload a downloadable workflow
artifact. A pull request that changes a file under `tokens/` must also contain a
Changeset:

```sh
pnpm changeset
```

Choose the release impact deliberately:

| Change | SemVer bump |
| --- | --- |
| Existing token value changed | `patch` |
| Backward-compatible token added | `minor` |
| Token removed or renamed | `major` |

After the token pull request merges, Changesets opens or updates a version pull
request. That PR applies the next contiguous version to `package.json` and the
changelog. Merging the version PR rebuilds the generated artifacts and
publishes the package to GitHub Packages with the npm dist-tag `latest`.
The repository is baselined at the existing published `0.1.9`, so a patch
increments to `0.1.10`; a deliberate minor release advances to `0.2.0`.

Changes to documentation, workflows, build scripts, or other repository files
do not create a release. Versions must not be edited manually; the release PR
owns package version changes.

The repository's **Actions > General > Workflow permissions** setting must
allow GitHub Actions to create pull requests. Keep the version PR subject to
the same required checks and review rules as other changes. GitHub may require
a maintainer to approve the checks on a version PR created with `GITHUB_TOKEN`;
use a narrowly scoped GitHub App token for the Changesets action if fully
automatic check triggering is required.
