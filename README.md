# Snyk-project-counter

## Features
Returns organizations that are within 10% of 25000 project limit or over 25000 projects.

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
