# Design system token bridge

A proof-of-concept pipeline from Figma Variables to versioned CSS and typed
JavaScript. Token Brücke exports DTCG JSON, pull requests provide the review
boundary, Style Dictionary builds deterministic outputs, and version tags
publish `@sdh-tbd/design-system-token-bruecke` to GitHub Packages.

```text
Figma Variables
    -> Token Brücke plugin
    -> tokens/**/*.tokens.json
    -> pull request validation
    -> Style Dictionary
    -> CSS + typed JavaScript
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
- split by collection
- split by mode disabled
- collection names retained
- Figma metadata disabled
- styles disabled

Configure the Token Brücke GitHub or GitHub PR server to write:

```text
tokens.json
```

The file must contain the `Primitives`, `Semantic Light`, and `Semantic Dark`
collections. Open a pull request after exporting. CI rejects invalid values,
broken aliases, light/dark mismatches, and transformed-name collisions. It then
builds CSS and TypeScript and uploads the packed npm package as a workflow
artifact.

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

Authenticate package installs with a GitHub personal access token (classic)
that has `read:packages`, either through `npm login --scope=@sdh-tbd
--auth-type=legacy --registry=https://npm.pkg.github.com` or an `NPM_TOKEN`
referenced from the consumer's user-level `.npmrc`. Never commit the token.

## Publish

Pull requests validate, build, package, and upload a downloadable workflow
artifact. Every push to `main` repeats those steps and publishes a unique SemVer
version to GitHub Packages with the npm dist-tag `latest`.

The major and minor numbers come from `package.json`; the patch number is the
monotonically increasing GitHub Actions run number. For example, a base version
of `0.1.2` can produce `0.1.8`, then `0.1.9`. Consumers can install `latest` or
pin one of those immutable versions.
