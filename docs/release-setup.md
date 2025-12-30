# Release Setup Guide

This document explains how to configure the release infrastructure for dpr.

## Overview

The release process uses:
- **npm Trusted Publishers** (OIDC) for npm publishing - no tokens required
- **GitHub Personal Access Token** for Homebrew tap updates
- **GitHub Actions** for automated builds and releases

## Prerequisites

Before your first release:

1. Create an npm account at https://www.npmjs.com/signup
2. Enable 2FA on your npm account (required for publishing)
3. Create a GitHub repository for Homebrew: `tx2z/homebrew-tap`

---

## 1. npm Trusted Publishers Setup

npm trusted publishers uses OpenID Connect (OIDC) for authentication, eliminating the need for long-lived access tokens. This is more secure than classic tokens which expire every 90 days.

### First-time Package Setup

For a **new package** (never published before):

1. Publish the package manually once to claim the name:
   ```bash
   npm login
   npm publish --access public
   ```

2. After the initial publish, set up trusted publishing (see below)

### Configure Trusted Publisher on npm

1. Go to https://www.npmjs.com and log in
2. Navigate to your package: `@tx2z/dev-process-runner`
3. Click **Settings** (gear icon)
4. Under **Trusted Publisher**, click **GitHub Actions**
5. Fill in the connection details:

   | Field | Value |
   |-------|-------|
   | Organization or user | `tx2z` |
   | Repository | `dpr` |
   | Workflow filename | `release.yml` |
   | Environment name | *(leave empty)* |

6. Click **Set up connection**

### How It Works

When the GitHub Action runs:
1. GitHub generates an OIDC token proving the workflow identity
2. npm verifies the token matches the trusted publisher configuration
3. npm allows the publish without requiring an access token

Provenance attestations are automatically generated, providing cryptographic proof of where the package was built.

### Requirements

- **npm 11.5.1+** (required for OIDC support - Node 22 doesn't ship with this by default)
- GitHub-hosted runners (self-hosted not yet supported)
- Public repository (for provenance attestations)

> **Note:** The workflow installs `npm@latest` before publishing to ensure OIDC compatibility.

---

## 2. Homebrew Tap Setup

### Create the Homebrew Tap Repository

1. Create a new GitHub repository: `tx2z/homebrew-tap`
2. Initialize with a README
3. Create the Formula directory structure:
   ```
   homebrew-tap/
   └── Formula/
       └── (formulas will be added here by CI)
   ```

### Create GitHub Personal Access Token

The CI needs write access to the homebrew-tap repository:

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Click **Fine-grained tokens** → **Generate new token**
3. Configure the token:

   | Setting | Value |
   |---------|-------|
   | Token name | `homebrew-tap-ci` |
   | Expiration | 1 year (or custom) |
   | Resource owner | `tx2z` |
   | Repository access | Only select repositories → `tx2z/homebrew-tap` |

4. Under **Permissions** → **Repository permissions**:
   - Contents: **Read and write**
   - Metadata: **Read-only** (auto-selected)

5. Click **Generate token** and copy it immediately

### Add Token to dpr Repository

1. Go to the `tx2z/dpr` repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the secret:

   | Name | Value |
   |------|-------|
   | `HOMEBREW_TAP_TOKEN` | *(paste the token from above)* |

---

## 3. Verify Setup

### Test npm Trusted Publishing

You can verify the trusted publisher is configured correctly:

1. Go to your package on npmjs.com
2. Check Settings → Trusted Publisher shows your GitHub repository

### Test Homebrew Token

```bash
# Clone the tap repo using the token
git clone https://<TOKEN>@github.com/tx2z/homebrew-tap.git
```

---

## 4. Release Process

Once setup is complete, releasing is simple:

```bash
./scripts/release.sh
```

This will:
1. Run validation (typecheck, lint, format, tests)
2. Prompt for version bump (patch/minor/major)
3. Update package.json and create git tag
4. Push to GitHub, triggering the release workflow

The GitHub Action will:
1. Publish to npm (using OIDC, no token needed)
2. Build executables for macOS, Linux, Windows
3. Create GitHub Release with binaries
4. Update Homebrew formula

---

## Troubleshooting

### npm publish fails with 404

The OIDC token wasn't matched to your package. Verify:
- Organization/user name matches exactly (case-sensitive)
- Repository name matches exactly
- Workflow filename is correct (`release.yml`)
- You're publishing from the correct branch

### Homebrew update fails

- Check the `HOMEBREW_TAP_TOKEN` secret is set correctly
- Verify the token has write access to the homebrew-tap repo
- Check the token hasn't expired

### Build fails on specific platform

- Check the GitHub Actions logs for the specific matrix job
- Ensure dependencies are compatible with that platform

---

## References

- [npm Trusted Publishers Documentation](https://docs.npmjs.com/trusted-publishers/)
- [npm OIDC Announcement (July 2025)](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/)
- [GitHub Fine-grained PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Homebrew Tap Documentation](https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap)
