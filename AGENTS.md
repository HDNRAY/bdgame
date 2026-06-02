# Project Memory

This is a roguelite auto-battle game (代号《单挑》).
Tech stack: TypeScript + Vite 6 + React 19 + Zustand + CSS Modules + Canvas API.

## RTK (token-saving command compression)

RTK is installed on this machine. When running shell commands via `bash`, **always prefix with `rtk`** where supported to reduce token cost and save on API usage:

| Normal command | Use instead | Why |
|---|---|---|
| `git status` | `rtk git status` | 45 lines → ~12 lines |
| `git diff` | `rtk git diff` | Condensed diff |
| `git log -n 10` | `rtk git log -n 10` | One-line commits |
| `git add/commit/push` | `rtk git add"/"rtk git commit"/"rtk git push` | → "ok" / "ok abc1234" |
| `ls` / `ls -la` | `rtk ls` | Tree view, ~80% less |
| `cat src/foo.ts` | `rtk read src/foo.ts` | Smart file reading |
| `grep "pattern" .` | `rtk grep "pattern" .` | Grouped search results |
| `npm test` / `npx vitest` | `rtk test npm test` | Failures only, ~90% less |
| `npx tsc --noEmit` | `rtk tsc` | Errors grouped by file |
| `npx eslint .` | `rtk lint` | Grouped by rule/file |

For commands not in this table, run normally — RTK passes through unknown commands.
