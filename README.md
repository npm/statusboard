## 📊 statusboard

[**npm.github.io/statusboard**](https://npm.github.io/statusboard/)

A single view to help monitor the status/health of the [`@npm/cli`](https://github.com/orgs/npm/teams/cli) teams's Open Source Projects.

### CLI dependencies

The separate [CLI deps page](https://npm.github.io/statusboard/cli-deps.html) shows npm-owned dependency repositories required by the configured CLI lines. Select a CLI line and **Not latest in line** to find integrations missing the newest stable release in a required major; **Latest overall not integrated** also compares across majors. Expand a repository for exact package versions, published releases, branch HEADs, checks, and dependency paths.

The collector derives runtime and dev-only requirements from pinned CLI lockfiles and workspace manifests, including testing/linting dependencies. It retains template-oss itself but excludes transitives reachable only through it. Branches are discovered and matched by package manifests, not maintained in a dependency-branch list. **Potential gaps** are missing branch mappings, not confirmed support violations or upgrade recommendations.

CLI inputs and the template-oss scope rule are configured in [`cli-deps-policy.js`](./workspaces/data/lib/cli-deps-policy.js). Generated data lives in [`cli-deps.json`](./workspaces/www/lib/data/cli-deps.json), independently of project-health data. Collection failures retain the previous dataset and record an error in the shared metadata file; the page displays the last success and failed/stale refreshes.

Refresh locally with `npm run fetch:cli-deps -w data` using `AUTH_TOKEN`, or use the existing `gh workflow run fetch-data.yml` trigger. The daily/manual data workflow refreshes both datasets. PRs build both pages into the Pages artifact; the existing main-branch publish workflow deploys them after merge.

### Data

#### Adding a project

[GitHub search query for `org:npm topic:npm-cli fork:true`](https://github.com/search?q=org%3Anpm+topic%3Anpm-cli+fork%3Atrue&type=repositories)

To be included here a repo must be in the `npm` org and have the `npm-cli` topic added to it. The data is rebuilt daily so the repo should appear by the next day.

Repos are also searched for workspaces via the `package.json#workspaces` array and those are included if they do not have `package.json#private`.

### Removing a project

Projects are removed from the list if they are archived on GitHub and deprecated on the npm registry, or if they are archived and moved to a workspace of another repo we track. The topic `npm-cli` does not need to be removed and should be kept on GitHub repos for historical reference.

### Developing:

#### To update maintained projects:

Locally: `npm run fetch:maintained -w data`

CI: `gh workflow run fetch-maintained.yml`

#### To update daily data:

Locally: `npm run fetch:data -w data`

CI: `gh workflow run fetch-data.yml`

#### Serve / Publish Site

Serve: `npm run dev -w www`

Publish: The site is published to GitHub Pages on all pushes to `main`.

### Forking

This project aims to have some portability, but it will not work out-of-the-box if forked. Here are the things we're aware of that you should change if you fork this:

- Enable the GitHub Action workflows after forking. They are not enabled by default on forked repos
- Update misc links and references to your org
- Delete all historical data from [`workspaces/www/lib/data/**/*.json`](./workspaces/www/lib/data/**/*.json)
- Update the necessary config items in:
  - [`data/lib/config.js`](./workspaces/data/lib/config.js) This controls what data is fetched and filtered from GitHub
  - [`www/lib/js/columns.js`](./workspaces/www/lib/js/columns.js) This is most of how that data get parsed on the frontend for display, sorting, filtering, etc
  - [`www/lib/js/selectors.js`](./workspaces/www/lib/js/selectors.js) These are some data selectors that are shared throughout the frontend
- Have a `AUTH_TOKEN=${{ GITHUB TOKEN}}` in `workspaces/data/.env` if you are fetching data locally. All the data here is from open source repos and packages on the npm registry. So if you're data is private this token will need to have the proper scopes. You can look in [`data/lib/api/`](./workspaces/data/lib/api/) to see all the calls that are made.
- Run `npm run fetch:maintained -w data` and `npm run fetch:data -w data` to populate your new data

