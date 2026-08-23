# AI Agent Guidelines & Safety Guardrails

This document defines behavioral constraints and operational rules for AI coding assistants working in this repository.

---

## 🔒 Protected Commands & Actions (Explicit Approval Required)

The agent **MUST NEVER** execute any of the following commands or actions without obtaining explicit, upfront confirmation from the user in the current turn:

1. **Remote Git Operations**:
   - `git push` (pushing commits, tags, or branches to remote)
   - `git push origin --tags` / `git push origin <tag>`

2. **Git Tag Operations**:
   - `git tag` (creating, modifying, or deleting Git tags)

3. **Release & Version Automation**:
   - `npm run release` / `./scripts/release.sh`
   - `npm run version:bump` / `node scripts/bump_version.js`

4. **Destructive Git Operations**:
   - `git reset --hard`
   - `git clean -f`
   - `git checkout -- .` / `git restore .` (unless explicitly requested for specific files)

---

## 📋 Required Approval Workflow

Before running any protected command:
1. **Explain the proposed action** (e.g. proposed version bump, commit message, or tag name).
2. **Stop and ask the user for confirmation**.
3. **Wait for the user to explicitly reply** (e.g. "proceed", "yes", "push", or "approve") before executing.
