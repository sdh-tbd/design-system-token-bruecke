# Changesets

Changesets control package versions for token releases.

Token pull requests from `figma/tokens` default to a patch release. After the
pull request merges, the release workflow creates the Changeset in its
workspace and uses it to open or update the package release pull request. It
does not add a bot commit to the token pull request.

For new tokens or breaking changes, run `pnpm changeset` before merging and
select `minor` for new tokens or `major` for removed or renamed tokens. Commit
the generated `.changeset/*.md` file alongside the token changes; the release
workflow uses it instead of generating the default patch Changeset.

After the token pull request merges, Changesets opens or updates the release
pull request. Merging that release pull request publishes the generated package.
