# Design token pipeline security and GitHub App gateway

- **Assessment date:** 2026-09-11
- **Status:** Production recommendation recorded; gateway retained as an
  escalation option
- **Plugin baseline:** Token Brücke 3.12.0
- **Audited source:** `tokens-bruecke/figma-plugin` commit
  [`258c871a71b369106caeb7907317b2f33a2d4625`](https://github.com/tokens-bruecke/figma-plugin/commit/258c871a71b369106caeb7907317b2f33a2d4625)
- **Related research:** the original design-token pipeline assessment in the
  `unite` project

## Executive recommendation

Use Token Brücke's pull-request integration with an individual, fine-grained
personal access token for the planned production design-token repository. The
repository will contain only canonical tokens, their build pipeline, and
published package source. Applications will consume its GitHub Packages output;
Token Brücke will not receive access to an application monorepo.

GitHub repository permissions cannot restrict a token to the `tokens/`
directory. A fine-grained personal access token with `Contents: read and write`
can read and modify content throughout its selected repository. In this
architecture that residual scope is intentionally constrained by the repository
boundary. Theft could expose token values and build configuration or create
malicious branches and pull requests, but it would not expose application
source.

The selected production pattern is:

1. Keep tokens in the dedicated internal repository.
2. Give each designer a short-lived PAT scoped only to that repository.
3. Allow Token Brücke to create pull requests, never write directly to `main`.
4. Require independent review and CI before merge.
5. Publish through GitHub Actions only after merge, using the workflow's
   ephemeral `GITHUB_TOKEN`.

The GitHub App gateway remains the higher-assurance alternative if policy or
risk changes. It is not required for the currently defined repository boundary.

Forking Token Brücke only to wrap or encrypt the PAT does not solve the
credential risk. First request removal of the credential-bearing console log
upstream. Use a minimal, commit-pinned fork if that fix is not available before
production adoption or if the organization requires control over the exact
plugin artifact. A larger authentication fork and gateway are justified only by
the escalation criteria below.

### Project decision

As of 2026-09-11:

- Token Brücke will target a dedicated internal design-token repository.
- That repository will build and publish a GitHub Packages package.
- Application monorepos will consume the package and are outside the plugin
  credential's repository scope.
- The fine-grained PAT design is accepted as the proportionate production
  approach, subject to the controls in this document.
- The GitHub App gateway is documented for future use, not selected for initial
  production implementation.

## Scope and trust boundaries

The production flow crosses four security boundaries:

```text
Figma document
    |
    | variables selected by the designer
    v
Token Brücke plugin
    |
    | canonical token JSON
    v
GitHub repository and pull request
    |
    | reviewed merge
    v
GitHub Actions, package registry, and consuming applications
```

The system must protect:

- proprietary repository contents;
- the integrity of canonical design tokens;
- the integrity of workflow and package source;
- credentials used by designers, automation, and package consumers;
- the identity and audit trail of the person initiating a change; and
- the package publication boundary.

The Figma file and exported token values are not assumed to be secret. They are
still untrusted build input and must not be allowed to change repository files
outside the approved token path.

## Effect of internal repository visibility

GitHub `internal` visibility limits ordinary access to members of the enterprise,
but it does not reduce the permissions of a stolen credential. A fine-grained
personal access token inherits the repository access and organizational
privileges of its owner, subject to the token's selected repositories and
permissions.

The change from public to internal affects the risk assessment as follows:

| Risk | Public dedicated token repository | Internal dedicated token repository | Internal monorepo |
| --- | --- | --- | --- |
| Source confidentiality after PAT theft | Low; source is already public | Moderate; token repository becomes readable | High; unrelated proprietary code may be readable |
| Unauthorized branch changes | Moderate | Moderate | High; any repository path may be targeted |
| Malicious pull request | Moderate | Moderate | High; workflows or application code may be proposed |
| Direct impact on `main` | Controlled by repository rules | Controlled by repository rules | Controlled by repository rules |
| Credential blast radius | One small repository | One small repository | Entire selected monorepo |

`Contents: write` necessarily includes read access. Fine-grained PATs and GitHub
App installation permissions are repository-scoped, not path-scoped. CODEOWNERS
and rulesets are approval controls, not credential scope controls.

If practical, retain a dedicated design-token repository and publish a package
for internal consumers. This is the simplest way to create a real authorization
boundary without operating a gateway.

## Token Brücke source assessment

The source review found no intentional route that sends the GitHub credential to
a non-GitHub service. The direct pull-request integration constructs an Octokit
client with the supplied token and uses GitHub's REST API to:

- read the base Git reference;
- create a Git tree and commit;
- create or force-update a branch; and
- find or create a pull request.

The following concerns affect production adoption.

### Credential logging

`src/app/views/SettingsView/index.tsx` logs the complete settings object in the
production UI. That object includes GitHub credentials. Production bundling does
not remove the console call.

This is avoidable credential disclosure. Remove the log before production use
and never log complete configuration objects. Diagnostic logging should use an
explicit allowlist of non-secret fields.

### Local credential storage

Token Brücke persists configuration through `figma.clientStorage`. This is the
normal Figma API for retaining user-provided plugin configuration, but Figma
explicitly describes it as private for stability rather than security. Other
plugin IDs cannot read it; a determined person with access to the user's own
machine can.

This is a platform limitation rather than a Token Brücke-specific vulnerability.
Client-side encryption is not a remedy if the plugin stores the decryption key
beside the ciphertext. Meaningful encryption requires a key supplied separately,
such as a user-entered passphrase or a backend-held key.

### Broad network permission

The plugin manifest permits requests to all domains so that users can configure
an arbitrary custom URL. This is functional but removes network-level
containment if a future plugin version or bundled dependency is compromised.

A production fork should replace the wildcard with the exact GitHub API and
organization gateway domains it needs.

### Release supply chain

The audited release workflow runs an unpinned `conventional-changelog-cli`
package through `npx --yes` in a job with repository write and OIDC permissions.
The package is not fixed by the repository lockfile. A compromised newly
published package could execute during a tagged release.

Before trusting new plugin releases, verify that release tooling is pinned and
that the installed Figma Community artifact corresponds to reviewed source. A
locally built, commit-pinned plugin provides stronger provenance, at the cost of
maintaining and distributing that build.

## Acceptable interim PAT design

The PAT approach remains reasonable for a dedicated internal token repository
when all of the following controls are present.

### Credential controls

- Give each designer an individual fine-grained PAT. Do not share one team PAT.
- Select only the design-token repository.
- Grant only:
  - `Contents: read and write`;
  - `Pull requests: read and write`; and
  - `Metadata: read`, which GitHub includes automatically.
- Do not grant Actions, Administration, Environments, Issues, Packages, Secrets,
  or Workflows permissions.
- Start with a 30-day expiry. Extend only if the rotation burden is justified.
- Revoke credentials immediately when a designer leaves the role or a device is
  lost.
- Use Token Brücke's GitHub pull-request integration, never its direct-push
  integration.
- Configure the plugin to write to the dedicated `figma/tokens` branch and open
  pull requests from that branch into `main`.

### Repository controls

Protect `main` with a ruleset that requires:

- pull requests;
- at least one approval from someone other than the author;
- design-system CODEOWNER review for the canonical token path;
- required token validation and build checks;
- approval of the latest reviewable push;
- dismissal of stale approvals;
- conversation resolution;
- no force pushes or branch deletion; and
- no bypass permission for PAT owners.

Protect `.github/workflows/**`, package manifests, build scripts, and release
configuration with engineering CODEOWNERS. The plugin credential can write any
path in the repository if stolen, so reviewers must reject pull requests that
touch anything beyond the expected token file.

Publishing must run only after a reviewed Changesets version pull request is
merged to `main`. A dedicated preflight job uses its ephemeral `GITHUB_TOKEN`
to add a patch Changeset only to same-repository pull requests from
`figma/tokens`; it does not install dependencies or execute pull-request code
with write access. Token changes must include a Changeset, while unrelated
repository changes must not. Use the release workflow's ephemeral
`GITHUB_TOKEN` for GitHub Packages; do not reuse the designer PAT.
Consider a protected GitHub Environment for production publication if a package
change has a significant downstream blast radius.

### Residual PAT risks

These controls prevent a stolen PAT from silently changing protected `main`, but
they do not prevent it from:

- reading every file in the selected internal repository;
- creating or modifying unprotected branches;
- opening deceptive pull requests;
- consuming API limits; or
- exploiting an incorrectly configured bypass or publication rule.

That residual risk is acceptable only when the repository boundary itself is
sufficiently narrow.

## Optional GitHub App gateway

The gateway removes long-lived GitHub credentials from Figma and converts a
broad repository permission into a narrow server-enforced operation. It is an
escalation option rather than a requirement for the selected dedicated
repository architecture.

```text
+---------------------+
| Token Brücke fork   |
| in Figma            |
+----------+----------+
           | 1. Sign in through organization identity
           | 2. POST canonical token JSON + idempotency key
           v
+---------------------------------------------------------+
| Organization token gateway                              |
|                                                         |
| - validates short-lived user session                    |
| - authorizes user and Figma file                        |
| - validates DTCG schema, size, and collection allowlist |
| - fixes repository, path, base branch, and branch prefix|
| - records an audit event                                |
| - requests a one-hour GitHub App installation token     |
+----------+----------------------------------------------+
           | 3. Create/update controlled branch
           | 4. Open/update pull request
           v
+---------------------+
| Internal GitHub repo|
| + protected main    |
+----------+----------+
           | 5. CI validation + independent approval
           | 6. Merge
           v
+---------------------+
| GitHub Packages     |
+---------------------+
```

### Why a GitHub App

A GitHub App provides:

- installation on selected repositories rather than access derived from an
  employee's account;
- centrally managed repository permissions;
- short-lived installation access tokens;
- auditable bot identity for commits and pull requests;
- straightforward revocation by suspending or uninstalling the app; and
- independence from employee onboarding, offboarding, and PAT rotation.

The GitHub App should request only:

| Repository permission | Access | Reason |
| --- | --- | --- |
| Metadata | Read | Automatically included repository metadata |
| Contents | Read and write | Read the base reference and create token commits |
| Pull requests | Read and write | Find, create, and update token pull requests |

Do not grant Workflows, Actions, Administration, Checks, Packages, Secrets,
Environments, Deployments, or Members permissions. Install the app only on the
design-token repository or explicitly approved target repository.

GitHub App permissions are still not path-scoped. The gateway is the component
that must enforce the token-file boundary.

### Gateway authentication

Do not replace the GitHub PAT with another permanent bearer token stored in
Token Brücke's custom headers. That changes where the credential is accepted but
does not materially improve storage or theft resistance.

Use an organization identity flow that issues a short-lived gateway session:

1. The plugin requests a one-time device or login code from the gateway.
2. It opens the organization's browser-based SSO page.
3. The designer authenticates and satisfies required MFA.
4. The gateway binds the completed login to the one-time code.
5. The plugin receives a short-lived, audience-restricted session.
6. The plugin uses that session only to submit token exports.

Keep the session lifetime short, for example 15 to 60 minutes. Prefer an opaque
session identifier or a sender-constrained token where the platform permits it.
Do not place organization client secrets in the plugin bundle.

If interactive authentication cannot be added initially, require sign-in for
every export or use a narrowly scoped, rapidly expiring gateway token. A static
API key saved in the custom URL headers is not the target architecture.

### Gateway authorization policy

Derive security-sensitive values on the server. The client request must not be
allowed to choose arbitrary GitHub destinations.

For each authenticated user and Figma file, configure an allowlisted policy:

```json
{
  "figmaFileKey": "approved-file-key",
  "repository": "organization/design-tokens",
  "baseBranch": "main",
  "tokenPath": "tokens/",
  "branch": "figma/tokens",
  "requiredCollections": [
    "Primitives",
    "Semantic Light",
    "Semantic Dark"
  ],
  "maximumBytes": 1048576
}
```

The gateway should reject:

- an unknown or unauthorized user;
- an unknown Figma file;
- an unapproved repository, branch, or file path;
- path traversal or additional files;
- oversized, malformed, or non-JSON bodies;
- missing required collections;
- unresolved aliases, placeholders, or invalid token types;
- unexpected executable or workflow content; and
- replayed or conflicting requests.

The plugin may send a logical source identifier and token payload. Repository,
base branch, output path, commit template, and GitHub App installation should be
selected from server-side policy.

### GitHub write behavior

For an accepted request, the gateway should:

1. Obtain a GitHub App installation token only when needed.
2. Read the current `main` reference and the existing automation branch.
3. Create exactly one blob and tree entry for the configured token path.
4. Create a commit with the authenticated designer in structured metadata.
5. Create or update the designer/file-specific automation branch.
6. Open or update one pull request into `main`.
7. Return only the pull-request URL and non-sensitive status.

Avoid unconditional force pushes. Use the previously observed branch commit as
an optimistic concurrency condition. If the branch changed unexpectedly, fail
and require reconciliation rather than overwriting it.

The gateway must never merge or approve the pull request. Independent review and
required checks remain the authorization boundary for `main`.

### API outline

An illustrative interface is:

```http
POST /v1/token-exports
Authorization: Bearer <short-lived-gateway-session>
Content-Type: application/json
Idempotency-Key: <random-per-export-value>
```

```json
{
  "source": {
    "figmaFileKey": "approved-file-key",
    "profile": "production"
  },
  "tokens": {
    "Primitives": {},
    "Semantic Light": {},
    "Semantic Dark": {}
  }
}
```

Successful submission returns:

```json
{
  "status": "pull_request_updated",
  "pullRequestUrl": "https://github.example/organization/design-tokens/pull/123"
}
```

Use an idempotency key to make retries safe. Do not return GitHub installation
tokens, internal error traces, repository contents, or secret configuration.

### Secret management and deployment

Store the GitHub App private key in the hosting platform's managed secret store
or a dedicated secrets manager. Do not place it in source, plugin configuration,
container images, logs, or ordinary application environment exports.

The gateway should:

- run with a dedicated service identity;
- permit outbound traffic only to GitHub and required identity-provider
  endpoints;
- expose only HTTPS;
- validate request content types and enforce small body limits;
- rate-limit by user, organization, and Figma file;
- redact authorization headers and token values from logs;
- keep dependencies and runtime images pinned and scanned;
- use separate development and production GitHub Apps; and
- support immediate key rotation and app suspension.

Where supported, use a signing service or managed key facility so the GitHub App
private key is not directly readable by the application process.

### Audit events

Record:

- authenticated user and organization identity;
- Figma file and configured export profile;
- timestamp and idempotency key;
- hash and size of the submitted payload;
- target repository, branch, and path selected by policy;
- resulting commit SHA and pull-request number;
- validation outcome; and
- GitHub API request identifiers on failure.

Do not record the gateway session, authorization header, GitHub installation
token, GitHub App private key, or complete token payload by default.

### Token Brücke integration options

Token Brücke already supports posting JSON to a custom URL with configured
headers. That can prove the gateway's payload and GitHub behavior, but the
current static-header model is not sufficient for the final authentication
design.

Preferred order:

1. Contribute short-lived gateway authentication and safer secret handling
   upstream.
2. If upstream timing does not meet the project, maintain a small fork containing
   only:
   - organization login/session support;
   - the fixed gateway domain;
   - removal of credential-bearing console logs;
   - password-style handling for credential inputs;
   - explicit message schemas between plugin main code and UI; and
   - exact dependency and source revision pins.
3. Avoid diverging from the token transformation logic. Rebase and security
   review every upstream update before adoption.

The fork should not contain a GitHub App private key or OAuth client secret. Its
only credential should be the designer's short-lived gateway session.

## Threat model and controls

| Threat | Primary controls | Residual risk |
| --- | --- | --- |
| Malicious plugin update steals credentials | Short-lived gateway session, fixed network allowlist, reviewed/pinned plugin build | Session can be abused until expiry |
| Designer account compromise | Organization SSO, MFA, session expiry, authorization policy, audit alerts | Attacker can submit token PRs as that user |
| Gateway compromise | Managed app key, least privilege, egress control, isolation, rotation | App can write within installed repositories |
| Arbitrary repository write | Server-fixed repository/path/branch, one-file tree construction | GitHub App itself remains repository-scoped |
| Malicious token payload | Schema and semantic validation in gateway and CI, payload limit | Valid but harmful visual changes require review |
| Bypass of independent review | Protected `main`, no app bypass, app cannot merge or approve | Administrator bypass remains an organizational risk |
| Replay or duplicate export | Idempotency keys, short sessions, payload hashes | Intentional repeated exports remain possible |
| Concurrent designer updates | Per-user/file branches, optimistic concurrency | Human conflict resolution may still be required |
| Secret leakage through logs | Structured allowlisted logging and redaction | Infrastructure-level debugging must remain controlled |
| Malicious dependency or build release | Exact pins, lockfiles, provenance review, isolated release jobs | Upstream ecosystem compromise cannot be eliminated |

## Rollout plan

### Phase 1: secure the current proof of concept

- Keep the public proof-of-concept repository isolated.
- Replace any classic PAT with a one-repository fine-grained PAT.
- Remove or rotate any PAT used while credential-bearing console logging was
  possible.
- Add the production branch rules and CODEOWNERS policy.
- Confirm package publication occurs only after a reviewed merge.

### Phase 2: choose the production repository boundary

- Use the selected dedicated internal design-token repository.
- Inventory whether token metadata itself is confidential.
- Identify all designers who need to export and all engineers who may approve.
- Verify that none of the exporter identities can bypass `main` protection.
- Record organizational requirements for PATs, GitHub Apps, retention, and SSO.

Deploy the fine-grained PAT design after the credential logging issue and
repository controls are addressed.

### Phase 3: optional gateway proof of concept

- Start this phase only if an escalation criterion in the decision record is
  met.
- Register a development GitHub App on one test repository.
- Implement organization login and a short-lived gateway session.
- Hard-code one repository, one base branch, and one token path in server policy.
- Validate the existing Token Brücke JSON contract.
- Create or update a pull request without merge or approval permissions.
- Test retries, concurrent exports, invalid payloads, expired sessions, app
  suspension, and branch divergence.

### Phase 4: production hardening

- Deploy a separate production GitHub App and gateway service identity.
- Move keys to managed secret storage and document rotation.
- Add rate limits, audit retention, alerts, dashboards, and incident runbooks.
- Restrict the plugin manifest to required domains.
- Pin and review the plugin artifact.
- Perform a focused application security review and threat-model review.
- Pilot with a small designer group before organization-wide rollout.

### Phase 5: ongoing operation

- Review GitHub App permissions and installations at least quarterly.
- Review gateway authorization mappings when Figma files or teams change.
- Rotate app keys according to organization policy and after any suspected
  exposure.
- Re-review upstream Token Brücke changes before updating the fork.
- Test credential revocation and app suspension as part of incident exercises.

## Decision record

Use this decision rule:

| Situation | Decision |
| --- | --- |
| Public proof-of-concept repository | Fine-grained PAT is acceptable |
| Dedicated internal token repository with enforced reviews | Fine-grained PAT is the selected proportionate solution |
| Internal monorepo containing unrelated proprietary code | Use the GitHub App gateway |
| Policy prohibits locally persisted PATs | Use the GitHub App gateway |
| Plugin users can bypass protected branches | Remove bypass or use a gateway identity that cannot bypass |
| Package can publish without independent review | Fix publication governance before production |
| PAT misuse or plugin supply-chain risk exceeds organizational tolerance | Use the GitHub App gateway |
| No capacity to operate a secure gateway | Retain the dedicated repository boundary |

## References

- [Figma `clientStorage` security model](https://developers.figma.com/docs/plugins/api/figma-clientStorage/)
- [Figma plugin manifest network access](https://developers.figma.com/docs/plugins/manifest/#networkaccess)
- [Token Brücke source](https://github.com/tokens-bruecke/figma-plugin)
- [GitHub: About permissions for GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/setting-up-a-github-app/choosing-permissions-for-a-github-app)
- [GitHub: Authenticating as a GitHub App installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [GitHub: Best practices for creating a GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app)
- [GitHub: Managing fine-grained personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [GitHub: Repository visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)
- [GitHub: About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [GitHub Actions security guidance](https://docs.github.com/en/actions/reference/security/secure-use)
