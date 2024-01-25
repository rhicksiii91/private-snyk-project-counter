import equal from 'fast-deep-equal';
import _ from 'lodash';
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

interface snapshotIdAndCreatedDate {
    id: string,
    created: string
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


    // Checking if SNYK_ORG_ID ernvironment variable exist and is not undefined.  If true, data results for that organziation.  If the result is false, return data for all organziations.
    if (snykOrgId !== undefined && snykOrgId.length >= 1) {
        // Looping through org IDs and returning project count
        for (const orgData of orgIdAndName) {
            if (snykOrgId === orgData.id) {
                let projectData: Object | undefined = await fetchContatinerProjects(orgData.id, orgData.name);
                // console.log(JSON.stringify(projectData, null, 2))
                let projectIds: any = returnProjectIds(projectData)
                console.log("Here are the project ids: " + projectIds)

                for (const projectId of projectIds) {
                    console.log("Project Id: " + projectId)
                    let projectSnapshotData = await findLastTwoSnapshotsIds(orgData.id, projectId)
                    console.log("Snapshot main Data: " + JSON.stringify(projectSnapshotData, null, 2))
                    console.log("ID 1: " + projectSnapshotData[0].id)
                    console.log("ID 2: " + projectSnapshotData[1].id)

                    // Pull in snapshot issues
                    let currentIssues = await fetchAggregatetdProjectSnapshotsIssues(orgData.id, projectId, projectSnapshotData[0].id)
                    let pastSnapshotIssues = await fetchAggregatetdProjectSnapshotsIssues(orgData.id, projectId, projectSnapshotData[1].id)

                    // Check if results are different
                    let diffbool = _.isEqual(currentIssues, pastSnapshotIssues)
                    
                    console.log("Here is the diffbool value: " + diffbool)
                    console.log(currentIssues.length)
                    console.log(pastSnapshotIssues.length)
                    if (!diffbool) {
                        console.log("Detected new issues, starting compare")

                        let newIssues = new Array;


                        for (let currentIssue of currentIssues) {
                            let foundIssue: boolean = false;
                            for (let pastIssue of pastSnapshotIssues) {
                                // console.log("Here is current issue: " + JSON.stringify(currentIssue, null, 2))
                                if (currentIssue.id === pastIssue.id) {
                                    foundIssue = true
                                    break;
                                    // console.log("Sometihng: " + JSON.stringify(newIssues))
                                }
                            }
                            if (foundIssue) {
                                console.log("Found existing issue, skipping")
                                foundIssue = false
                            }
                            else {
                                newIssues.push(currentIssue)
                                console.log("Here is the new issue: " + JSON.stringify(currentIssue, null, 2))
                            }
                        }

                        console.log("Here is the diff: " + JSON.stringify(newIssues, null, 2))
                        // console.log("No new issues found")
                    }
                    else{
                        console.log("No issues found")
                    }

                }
                // let taggingStatus: number | undefined = await createTagsForProjects(orgData.id, projectData, userId)
                process.exit(0);
            }

        }
    }
    else {
        // Looping through org IDs and returning project count
        for (const orgData of orgIdAndName) {
            let projectData: Object | undefined = await fetchContatinerProjects(orgData.id, orgData.name);
            console.log(JSON.stringify(projectData, null, 2))
            // let taggingStatus: number | undefined = await createTagsForProjects(orgData.id, projectData, userId)
            process.exit(0);
        }
    }

}

function getDifference(o1: any, o2: any) {
    let diff = {};
    let tmp: any = [];
    if (JSON.stringify(o1) === JSON.stringify(o2)) return;

    for (var k in o1) {
        if (Array.isArray(o1[k]) && Array.isArray(o2[k])) {
            tmp = o1[k].reduce(function (p, c, i) {
                var _t = getDifference(c, o2[k][i]);
                if (_t)
                    p.push(_t);
                return p;
            }, []);
            if (Object.keys(tmp).length > 0)
                diff[k] = tmp;
        } else if (typeof (o1[k]) === "object" && typeof (o2[k]) === "object") {
            tmp = getDifference(o1[k], o2[k]);
            let diff = Object.keys(tmp)[0]
            if (tmp && diff.length > 0)
                diff[k] = tmp;
        } else if (o1[k] !== o2[k]) {
            diff[k] = o2[k]
        }
    }
    return diff;
}

async function fetchAggregatetdProjectSnapshotsIssues(orgId: string, projectId: string, snapshotId: string) {
    let url: string = `https://snyk.io/api/v1/org/${orgId}/project/${projectId}/history/${snapshotId}/aggregated-issues`

    try {
        // Calling Snyk Rest Targets endpoint
        const response: any = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `token ${snykToken}`
            }
        });

        // Rate limit check and sleep
        if (response.status == 429) {
            console.log("Hit the rate limit, sleeping for one minute")
            await new Promise(resolve => setTimeout(resolve, 60001));
        }

        if (response.status == 200) {
            const snapshotResponse: any = await response.json()
            return snapshotResponse.issues
        }

    } catch (error) {
        console.log('There was an error fetching data from targets endpoint', {
            extra: {
                errors: JSON.stringify(error),
            },
        });
    }
}

async function findLastTwoSnapshotsIds(orgId: string, projectId: string) {
    let snapshotIdAndCreatedDate: snapshotIdAndCreatedDate[] = [];
    let projectSnapshotData = await fetchProjectSnapshots(orgId, projectId);
    for (const snapshot of projectSnapshotData) {
        let idAndTimePlaceholder: any = {
            id: snapshot.id,
            created: snapshot.created
        }
        snapshotIdAndCreatedDate.push(idAndTimePlaceholder)
        if (snapshotIdAndCreatedDate.length === 2) {
            break;
        }
    }

    return snapshotIdAndCreatedDate;
}

async function fetchProjectSnapshots(orgId: string, projectId: string) {
    let url: string = `https://snyk.io/api/v1/org/${orgId}/project/${projectId}/history?perPage=100&page=1`

    try {
        // Calling Snyk Rest Targets endpoint
        const response: any = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `token ${snykToken}`
            }
        });

        // Rate limit check and sleep
        if (response.status == 429) {
            console.log("Hit the rate limit, sleeping for one minute")
            await new Promise(resolve => setTimeout(resolve, 60001));
        }

        if (response.status == 200) {
            const snapshotResponse: any = await response.json()
            return snapshotResponse.snapshots
        }

    } catch (error) {
        console.log('There was an error fetching data from targets endpoint', {
            extra: {
                errors: JSON.stringify(error),
            },
        });
    }
}

function returnProjectIds(projectData: any) {
    let projectIds: string[] = [];

    for (const x in projectData) {
        for (const keyProjects in projectData[x]) {
            projectIds.push(projectData[x][keyProjects].id)
            // console.log("See project data here")
            // console.log(JSON.stringify(projectData[x][keyProjects].id, null, 2))
        }
    }
    return projectIds;
}

async function createTagsForProjects(orgId: string, projectData: any, userId: any) {
    let foundBranch: boolean = false;
    let setTag: boolean = true;

    for (const x in projectData) {
        for (const keyProjects in projectData[x]) {
            if (debug) { console.log("Print target reference : " + JSON.stringify(projectData[x][keyProjects].attributes['target_reference'], null, 2)) }

            // Checking to see if Branch name is present in target_reference
            if (projectData[x][keyProjects].attributes['target_reference']) {
                // Debug logging
                if (debug) { console.log("Found branch name, checking for branch tag") }
                foundBranch = true
            }
            else {
                if (debug) { console.log("Project: " + projectData[x][keyProjects].attributes['name'] + " does not have branch data.  This is probably a CLI project and will not be tagged.  Project ID is the following: " + projectData[x][keyProjects]['id']) }
                setTag = false
            }

            // Looping through tags to check if Branch tag already exist.
            if (projectData[x][keyProjects].attributes['tags'].length >= 1 && foundBranch) {
                for (const keyTags in projectData[x][keyProjects].attributes['tags']) {

                    if (debug) {
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

async function fetchContatinerProjects(orgId: string, orgName: string) {
    let url: string = `https://api.snyk.io/rest/orgs/${orgId}/projects?version=${restApiVersion}&limit=100&types=deb%2Cdockerfile%2Crpm%2Clinux%2Capk`
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