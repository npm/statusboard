## 📊 statusboard

A single view to help monitor the status/health of [npm](https://github.com/npm)'s Open Source Projects

[View statusboard here: **npm.github.io/statusboard**](https://npm.github.io/statusboard/)

### Data

To be included here a repo must have the `npm-cli` topic added to it. The data is rebuilt daily so it should appear by the next day.

Projects are removed from the list if they are archived on GitHub and deprecated on the npm registry. The topic `npm-cli` does not need to be removed and should be kept on GitHub repos for historical reference.

### Developing:

#### To update maintained projects:

`npm run fetch:maintained -w data`

#### To update daily data:

`npm run fetch:data -w data`

#### To serve site locally

`npm run dev -w www`

