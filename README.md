## 📊 statusboard

[**npm.github.io/statusboard**](https://npm.github.io/statusboard/)

A single view to help monitor the status/health of the [`@npm/cli`](https://github.com/orgs/npm/teams/cli)teams's Open Source Projects.

### Data

#### Adding a project

[GitHub search query for `org:npm topic:npm-cli`](https://github.com/search?q=org%3Anpm+topic%3Anpm-cli&type=repositories)

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

Publish: The site is published on all pushes to `main` that touch files in `workspaces/www/lib`.
