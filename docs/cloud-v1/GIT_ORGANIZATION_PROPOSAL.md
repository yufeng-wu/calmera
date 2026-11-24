# Proposed Git organization — discussion draft, 2026-10-19

No branch, index, commit, remote or history has been changed for this proposal. Remote heads were inspected read-only with git ls-remote; no fetch/pull/reset/stash/clean was performed.

## Observed repository state

- The enclosing calmera_for_chatgpt folder is not a repository. Mobile and backend already have separate Git histories and GitHub remotes.
- Mobile: yufeng-wu/calmera, local main and remote main at d936721. At inspection there were 27 modified tracked files, 104 untracked files and nothing staged. Newly implemented native modules, app configuration, shared UI, tests, build scripts and docs are still untracked. Counts can grow as the current fixes and this proposal are added.
- Backend: yufeng-wu/cal_backend. Local main is b8b818c; its cached origin/main is 042a0d1, while the live remote main is 9c9ad733c98e94fa244d0c1d07524a461727a114. The local checkout also has substantial modifications overlapping the deployed recovery/auth/device-inference work. It must be compared with the current remote before committing or merging.
- The older calmera(dot) prototype has its own repository and is outside the shipping Expo app. Its historical iMessage/Shortcut paths need not be imported into the app repositories.

## Recommendation: keep the two existing repositories for this MVP

This keeps backend deployment and existing app history attached to their current remotes. A monorepo can be considered later if there is a concrete need for shared contracts or release tooling; it is not required to make the current MVP reproducible.

1. Review the mobile ignore rules and source inventory. Track the existing .gitignore, lockfile, app configuration, modules/calmera-chatgpt, app/components/hooks/lib, tests, build scripts and project documentation. A branch alone does not preserve uncommitted or untracked files; reviewed commits do.
2. Create codex/chatgpt-ios-mvp for mobile and save a reviewed, buildable baseline. The current changes are interconnected; the baseline should include everything required to build the already-tested app. Subsequent changes should be small focused commits, such as Goals navigation, voice feedback, cache behavior or a specific UI adjustment.
3. Preserve the dirty backend checkout while comparing it against a fresh checkout/worktree of remote main. Only port genuinely missing changes onto a new codex branch. Already-merged/deployed fixes should remain in their existing remote history.
4. For the initial mobile baseline, keep the iOS source project and Podfile.lock needed by the current local build scripts. Exclude Pods, DerivedData/build products, xcuserdata, local signing/provisioning files, local environment files and device artifacts. The custom Swift implementation in modules/ is essential source. A later change can switch fully to generated native projects after clean prebuild reproducibility is verified; current EAS upload rules already regenerate ios separately and should be documented.
5. Use feature branches and PRs for later work. Keep main at a tested point, with a short validation note for each merge. Tag the first complete reproducible mobile MVP and compatible API version once their tests/builds are verified. Deployment should remain a separate explicit decision.

## Decision to discuss

Recommended: retain cal_mobile + cal_backend and establish the reviewed baseline first. Alternative: create a new monorepo for Calmera's ChatGPT-based app, preserving the existing repositories as history and explicitly migrating deployment configuration.

No changes to repository organization or publishing have been applied yet.


## Selected structure

On 2026-10-19 the user selected keeping the two existing repositories. The full UI refresh was completed before the baseline step. No branch, staging, commit, push or backend synchronization has yet been performed; the existing source modifications remain available for review.


## Baseline preparation

The user requested the name chatgpt-inference-mvp. Mobile work is now being saved on codex/chatgpt-inference-mvp with source, native modules, tests and documentation. Ignore rules exclude local environment/credential/signing files, machine/editor state and build products. The existing main branch is retained. Backend differences are compared against remote main without altering the dirty local checkout.
