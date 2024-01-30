# Snyk Container Project Delta

## Features
Scans all organizations that belonging to the SNYK_TOKEN or the ORG_ID specified for container projects and returns the issue delta from the ttwo project snapshots.

## Environment variables
```
  SNYK_TOKEN                   Snyk serivce or personal token [required]
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

git clone https://github.com/rhicksiii91/private-snyk-project-counter.git
npm install
npm run start:dev

```
