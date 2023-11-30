import fetch from 'node-fetch';

const snykToken: any = process.env.SNYK_TOKEN;
const snykOrgId: any = process.env.SNYK_ORG_ID;
const projectTagKey: any = process.env.SNYK_PROJECT_TAG_KEY;
const debug: any = process.env.DEBUG;
const restApiVersion: string = '2023-09-14'
const restBetaApiVersion: string = '2023-09-14~beta'
const restExperimentalApiVersion: string = '2023-09-14~experimental'

interface OrgInfo {
    id: string;
    name: string;

}

interface OrgData {
    data: [{
        id: string,
        attributes: {
            group_id: string
            name: string
        }
    }],
    links: {
        next: string
    }
}

async function app() {
    let orgIdAndName: any = await fetchOrgs()
    let userId: string | undefined = await fetchUserId()

    // Debug log
    if (debug) {
        console.debug("Snyk Token: " + snykToken)
        console.debug("Org ID: " + snykOrgId)
        console.log("UserID " + userId)
    }


    // Checking if SNYK_ORG_ID ernvironment variable exist and is not undefined.  If true, data results for organziation.  If the result is false, return data for all organizations
    if (snykOrgId !== undefined && snykOrgId.length >= 1) {
        // Looping through org IDs and returning project count
        for (const orgData of orgIdAndName) {
            if (snykOrgId === orgData.id) {
                let projectData: Object | undefined = await fetchProjects(orgData.id, orgData.name);
                console.log(JSON.stringify(projectData, null, 2))
                let taggingStatus: number | undefined = await createTagsForProjects(orgData.id, projectData, userId)
                process.exit(0);
            }

        }
    }
    else {
        // Looping through org IDs and returning project count
        for (const orgData of orgIdAndName) {
            let projectData: Object | undefined = await fetchProjects(orgData.id, orgData.name);
            console.log(JSON.stringify(projectData, null, 2))
            let taggingStatus: number | undefined = await createTagsForProjects(orgData.id, projectData, userId)

            process.exit(0);
        }
    }

}

async function createTagsForProjects(orgId: string, projectData: any, userId: any) {
    let foundBranch: boolean = false;
    let setTag: boolean = true;

    for (const x in projectData) {
        for (const keyProjects in projectData[x]) {
            if (debug){console.log("Print target reference : " + JSON.stringify(projectData[x][keyProjects].attributes['target_reference'], null, 2))}

            // Checking to see if Branch name is present in target_reference
            if (projectData[x][keyProjects].attributes['target_reference']) {
                // Debug logging
                if (debug){console.log("Found branch name, checking for branch tag")}
                foundBranch = true
            }
            else {
                if (debug){console.log("Project: " + projectData[x][keyProjects].attributes['name'] + " does not have branch data.  This is probably a CLI project and will not be tagged.  Project ID is the following: " + projectData[x][keyProjects]['id'])}
                setTag = false
            }

            // Looping through tags to check if Branch tag already exist.
            if (projectData[x][keyProjects].attributes['tags'].length >= 1 && foundBranch) {
                for (const keyTags in projectData[x][keyProjects].attributes['tags']) {

                    if(debug){
                    console.log("Printing Tag key and value: " + JSON.stringify(projectData[x][keyProjects].attributes['tags'][keyTags], null, 2));
                    }

                    if (projectData[x][keyProjects].attributes['tags'][keyTags].key === projectTagKey && projectData[x][keyProjects].attributes['tags'][keyTags].value === projectData[x][keyProjects].attributes['target_reference']) {
                        setTag = false
                        break;
                    }

                }
            }
            // Create tag on project
            if (setTag) {
                let tagResponse: any = await setSnykTag(orgId, projectData[x][keyProjects]['id'], userId, projectData[x][keyProjects].attributes['target_reference'])
                console.log(tagResponse)
            }
            else {
                setTag = true
            }

        }
    }
    return 0;
}

async function setSnykTag(orgId: string, projectId: string, userId: string, keyValue: string) {
    let url: string = `https://api.snyk.io/rest/orgs/${orgId}/projects/${projectId}?version=${restExperimentalApiVersion}`

    try {
        // Calling Snyk Rest Targets endpoint
        const response: any = await fetch(url, {
            method: 'PATCH',
            body: JSON.stringify({
                "data": {
                    "attributes": {
                        "tags": [
                            {
                                "key": `${projectTagKey}`,
                                "value": `${keyValue}`
                            }
                        ]
                    },
                    "id": `${projectId}`,
                    "relationships": {
                        "owner": {
                            "data": {
                                "id": `${userId}`,
                                "type": "user"
                            }
                        }
                    },
                    "type": "project"
                }
            }),
            headers: {
                'Content-Type': 'application/vnd.api+json',
                'Authorization': `token ${snykToken}`
            }
        });

        // Rate limit check and sleep
        if (response.status == 429) {
            console.log("Hit the rate limit, sleeping for one minute")
            await new Promise(resolve => setTimeout(resolve, 60001));
        }

        if (response.status == 200) {
            const tagResponse: any = await response.json()
            return response.status
        }

    } catch (error) {
        console.log('There was an error fetching data from targets endpoint', {
            extra: {
                errors: JSON.stringify(error),
            },
        });
    }
}

async function fetchUserId() {
    let url: string = `https://api.snyk.io/rest/self?version=${restExperimentalApiVersion}`

    try {
        // Calling Snyk Rest Targets endpoint
        const response: any = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/vnd.api+json',
                'Authorization': `token ${snykToken}`
            }
        });

        // Rate limit check and sleep
        if (response.status == 429) {
            console.log("Hit the rate limit, sleeping for one minute")
            await new Promise(resolve => setTimeout(resolve, 60001));
        }

        if (response.status == 200) {
            const userData: any = await response.json()
            return userData.data.id
        }

    } catch (error) {
        console.log('There was an error fetching data from targets endpoint', {
            extra: {
                errors: JSON.stringify(error),
            },
        });
    }
}

async function fetchIssueCount(orgId: string, orgName: string) {
    let url: string = `https://api.snyk.io/rest/orgs/${orgId}/issues?version=${restExperimentalApiVersion}&limit=100`
    let hasNextLink = true;
    let issueCount = 0;
    let criticalSeverityCount = 0;
    let highSeverityCount = 0;
    let mediumSeverityCount = 0;
    let lowSeverityCount = 0;

    while (hasNextLink) {

        try {
            // Calling Snyk Rest Projects endpoint
            const response: any = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'Authorization': `token ${snykToken}`
                }
            });

            // Debug log
            if (debug) {
                console.debug("Issue api call status code: " + response.status)
                console.debug("Org name: " + orgName)
            }

            // Rate limit check and sleep
            if (response.status == 429) {
                console.log("Hit the rate limit, sleeping for one minute")
                await new Promise(resolve => setTimeout(resolve, 60001));
            }


            if (response.status == 200) {
                const issueData: any = await response.json()
                for (const key in issueData.data) {
                    switch (issueData.data[key].attributes['effective_severity_level']) {
                        case 'low':
                            lowSeverityCount = lowSeverityCount + 1;
                            break;
                        case 'medium':
                            mediumSeverityCount = mediumSeverityCount + 1;
                            break;
                        case 'high':
                            highSeverityCount = highSeverityCount + 1;
                            break;
                        case 'critical':
                            criticalSeverityCount = criticalSeverityCount + 1;
                            break;
                    }
                }
                // Counting issues
                issueCount = issueCount + Object.keys(issueData.data).length

                // Checking for more pages
                if (issueData.links && issueData.links.next && Object.keys(issueData.data).length != 0) {
                    hasNextLink = true
                    url = "https://api.snyk.io" + issueData.links.next
                }
                else {
                    console.log("Printing issue counts for each severity")
                    console.log("Critical Count: " + criticalSeverityCount)
                    console.log("High Count: " + highSeverityCount)
                    console.log("Medium Count: " + mediumSeverityCount)
                    console.log("Low Count: " + lowSeverityCount)
                    hasNextLink = false
                    return issueCount;
                }
            }

        } catch (error) {
            console.log('There was an error fetching data from projects endpoint', {
                extra: {
                    errors: JSON.stringify(error),
                },
            });
            hasNextLink = false
        }
    }

}

async function fetchTargetCount(orgId: string, orgName: string) {
    let url: string = `https://api.snyk.io/rest/orgs/${orgId}/targets?version=${restBetaApiVersion}&limit=100&excludeEmpty=false`
    let hasNextLink = true;
    let targetCount = 0;

    while (hasNextLink) {
        try {
            // Calling Snyk Rest Targets endpoint
            const response: any = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'Authorization': `token ${snykToken}`
                }
            });

            // Debug log
            if (debug) {
                console.debug("Targets api call status code: " + response.status)
                console.debug("Org name: " + orgName)
            }

            // Rate limit check and sleep
            if (response.status == 429) {
                console.log("Hit the rate limit, sleeping for one minute")
                await new Promise(resolve => setTimeout(resolve, 60001));
            }

            if (response.status == 200) {
                const targetData: any = await response.json()
                // Counting targets
                targetCount = targetCount + Object.keys(targetData.data).length

                // Checking for more pages
                if (targetData.links && targetData.links.next) {
                    hasNextLink = true
                    url = "https://api.snyk.io/rest" + targetData.links.next
                }
                else {
                    hasNextLink = false
                    return targetCount;
                }
            }

        } catch (error) {
            console.log('There was an error fetching data from targets endpoint', {
                extra: {
                    errors: JSON.stringify(error),
                },
            });
            hasNextLink = false
        }
    }

}

async function fetchProjects(orgId: string, orgName: string) {
    let url: string = `https://api.snyk.io/rest/orgs/${orgId}/projects?version=${restApiVersion}&limit=100`
    let hasNextLink = true;
    let projectDataHolder = new Array;

    while (hasNextLink) {

        try {
            // Calling Snyk Rest Projects endpoint
            const response: any = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'Authorization': `token ${snykToken}`
                }
            });

            // Debug log
            if (debug) {
                console.debug("Projects api call status code: " + response.status)
                console.debug("Org name: " + orgName)
            }

            // Rate limit check and sleep
            if (response.status == 429) {
                console.log("Hit the rate limit, sleeping for one minute")
                await new Promise(resolve => setTimeout(resolve, 60001));
            }


            if (response.status == 200) {
                const projectData: any = await response.json()
                // Collecting project data
                projectDataHolder.push(projectData.data)

                // Checking for more pages
                if (projectData.links && projectData.links.next) {
                    hasNextLink = true
                    url = "https://api.snyk.io" + projectData.links.next
                }
                else {
                    hasNextLink = false
                    return projectDataHolder;
                }
            }

        } catch (error) {
            console.log('There was an error fetching data from projects endpoint', {
                extra: {
                    errors: JSON.stringify(error),
                },
            });
            hasNextLink = false
        }
    }

}

async function fetchOrgs() {
    let url: string = "https://api.snyk.io/rest/orgs?";
    let hasNextLink = true;
    const orgInfo: OrgInfo[] = [];
    let paramsString: any = { version: restApiVersion, limit: "10", }
    url = url + new URLSearchParams(paramsString)

    console.log("Starting to collect Organization data")
    while (hasNextLink) {
        try {

            // Calling Snyk Rest orgs endpoint
            const response: any = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/vnd.api+json',
                    'Authorization': `token ${snykToken}`
                }
            });

            if (debug) {
                console.debug("Orgs api call status code: " + response.status)
            }

            // Rate limit check and sleep
            if (response.status == 429) {
                console.log("Hit the rate limit, sleeping for one minute")
                await new Promise(resolve => setTimeout(resolve, 60001));
            }

            if (response.status == 200) {
                const orgData: OrgData = await response.json()

                for (const i of orgData.data) {
                    const orgDataHolder: OrgInfo = {
                        id: i.id,
                        name: i.attributes.name
                    };

                    orgInfo.push(orgDataHolder)
                }

                // Checking for more pages
                if (orgData.links && orgData.links.next) {
                    hasNextLink = true
                    url = "https://api.snyk.io" + orgData.links.next
                }
                else {
                    hasNextLink = false
                    return orgInfo;
                }
            }

        } catch (error) {
            console.log('There was an error fetching data from /orgs', {
                extra: {
                    errors: JSON.stringify(error),
                },
            });
            hasNextLink = false
        }
    }
}

// Running app
app()

