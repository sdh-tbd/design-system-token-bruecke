# Changesets

Changesets control package versions for token releases.

Pull requests from `figma/tokens` automatically receive a patch Changeset when
token files change. The workflow commits it to the pull request branch before
running the build.

Review the generated Changeset before merging. Keep `patch` for
backward-compatible token value changes, change it to `minor` for new tokens,
and change it to `major` for removed or renamed tokens.

For a manual token pull request, run `pnpm changeset` and commit the generated
`.changeset/*.md` file alongside the token changes.

After the token pull request merges, Changesets opens or updates the release
pull request. Merging that release pull request publishes the generated package.
