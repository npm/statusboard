# statusboard
Community &amp; Open Source Statusboard

You can view the live board here: [npm.github.io/statusboard](https://npm.github.io/statusboard/)

### Todo

- [ ] Set up a better development environment/workflow
- [ ] Recursively follow paginated responses (currently we're not grabbing all repositories)
- [ ] Set up GitHub actions to generate the data dump & build
- [ ] Allow for searching/filtering of projects by column value
- [ ] Remove all badges in place of static queries
- [ ] Clean up styles/formatting
- [ ] Add secondary metrics (ex. specific labels/count)
- [ ] Store data snapshots
- [ ] Generate charts/diagrams/histograms
- [ ] Go public with project (ie. allow others to copy/clone this work)

### Developing

1. Install `npm i`
2. Fetch `npm run fetch` (fetches data from services)
3. Build `npm run build` (builds the index from the `hbs` template)
4. Serve `npm run serve` (runs a basic `http-server`)