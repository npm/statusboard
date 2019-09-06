# statusboard
Community &amp; Open Source Statusboard

## Querying repositories

Using [hub](https://github.com/github/hub), you can query the **npm** org's public repositories.

Example of bash/shell script to query & output repositories.

```bash
# getting a github org's public repos
# ex. repos "npm" | awk '/\.nameWithOwner\t/ { print $2 }'
repos() {
  local user="${1?}"
  shift 1
  paginate hub api -t graphql -f user="$user" "$@" -f query='
    query($user: String!, $per_page: Int = 100, $after: String) {
      organization(login: $user) {
				repositories(first: $per_page, after: $after, privacy: PUBLIC) {
          nodes {
            updatedAt
            nameWithOwner
            stargazers {
              totalCount
            }
            pushedAt
            issues(states:OPEN) {
              totalCount
            }
            pullRequests(states:OPEN) {
              totalCount
            }
            licenseInfo {
              name
            }
            watchers {
              totalCount
            }
            collaborators {
              totalCount
            }
            releases {
              totalCount
            }
            codeOfConduct {
              name
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  '
}

paginate() {
  local output cursor
  output="$("$@")"
  cursor="$(awk '/\.hasNextPage/ { has_next=$2 } /\.endCursor/ { if (has_next=="true") print $2 }' <<<"$output")"
  printf "%s\n" "$output"
  [ -z "$cursor" ] || paginate "$@" -f after="$cursor"
}
```