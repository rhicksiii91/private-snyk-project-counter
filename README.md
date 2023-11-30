# Snyk project tagger

## Features
Sets Snyk tags for all projects belonging to the user or a specified organization.  It will take the SNYK_PROJECT_TAG_KEY as the key and the value will be the repo branch name. The user will NEED to use their personal tokens since a service account can not set a tag.  Be Careful when running this tool, it will set tags on all projects once it starts.

## Environment variables
```
  SNYK_TOKEN                   Snyk serivce or personal token [required]
  SNYK_PROJECT_TAG_KEY         Snyk tag key value for api     [required]
  SNYK_ORG_ID                  Snyk organization ID           [optional]
  DEBUG                        Enables debug logging when set to true.
                               Default value is false         [optional]
```

## Requirements
Node 16

## Running
```bash
export SNYK_TOKEN=$SNYKTOKEN
export SNYK_PROJECT_TAG_KEY=Branch

git clone https://github.com/rhicksiii91/snyk-project-counter.git
npm install
npm run start:dev

```
