# Snyk-project-counter

## Features
Returns project and target count for all organizations that the SNYK_TOKEN has access to.  You can specify a Snyk organization id to return project and target data.

## Environment variables
```
  SNYK_TOKEN         Snyk serivce or personal token [required]
  SNYK_ORG_ID        Snyk organization ID           [optional]
  DEBUG              Enables debug logging when set to true.
                     Default value is false         [optional]
```

## Requirements
Node 16

## Running
```bash
export SNYK_TOKEN=$SNYKTOKEN

git clone https://github.com/rhicksiii91/snyk-project-counter.git
npm install
npm run start:dev

```
