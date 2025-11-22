# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Installation

```bash
yarn
```

## Local Development

```bash
yarn start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```bash
yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

### Automated Deployment with GitHub Actions

This repository includes a GitHub Actions workflow that automatically deploys the site to GitHub Pages when you push to the `main` or `master` branch.

#### Setup Instructions (IMPORTANT - Do this first!):

1. **Manually Enable GitHub Pages (REQUIRED):**
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions** (NOT "Deploy from a branch")
   - Click **Save**
   - ⚠️ **This step must be done manually before the workflow can run**

2. **Grant necessary permissions:**
   - Go to **Settings** → **Actions** → **General**
   - Scroll down to **Workflow permissions**
   - Select **Read and write permissions**
   - Optionally check **Allow GitHub Actions to create and approve pull requests**
   - Click **Save**

3. **Push your code:**
   ```bash
   git add .
   git commit -m "Add GitHub Actions deployment"
   git push origin main
   ```

3. **Monitor the deployment:**
   - Go to the **Actions** tab in your GitHub repository
   - Watch the workflow run and deploy your site
   - Once complete, your site will be available at: `https://cloudnexus.github.io/cloudnexus-docs/`

#### Manual Deployment (Alternative)

Using SSH:
```bash
USE_SSH=true npm run deploy
```

Not using SSH:
```bash
GIT_USER=<Your GitHub username> npm run deploy
```

### Important Notes:

- Make sure the `baseUrl` in `docusaurus.config.ts` matches your repository name
- If your repository is named differently, update the `baseUrl` accordingly
- The workflow uses Node.js 20 as specified in your `package.json`
