# Changesets

Changesets control package versions for token releases.

When a Token Brücke pull request changes files under `tokens/`, add a changeset
with:

```sh
pnpm changeset
```

Select `patch` for backward-compatible token value changes, `minor` for new
tokens, and `major` for removed or renamed tokens. Commit the generated
`.changeset/*.md` file to the same `figma/tokens` pull request.

After the token pull request merges, Changesets opens or updates the release
pull request. Merging that release pull request publishes the generated package.
