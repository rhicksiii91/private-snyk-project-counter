import _ from 'lodash';
import fetch from 'node-fetch';


const snykToken: any = process.env.SNYK_TOKEN;
const snykOrgId: any = process.env.SNYK_ORG_ID;
const debug: any = process.env.DEBUG;
const restApiVersion: string = '2023-09-14'
const restExperimentalApiVersion: string = '2023-09-14~experimental'

interface OrgInfo {
    id: string;
    name: string;

}

interface ProjectInfo {
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
        // console.debug("Snyk Token: " + snykToken)
        console.debug("Org ID: " + snykOrgId)
        console.log("UserID " + userId)
    }


    // Checking if SNYK_ORG_ID ernvironment variable exist and is not undefined.  If true, data results for that organziation.  If the result is false, return data for all organziations.
    if (snykOrgId !== undefined && snykOrgId.length >= 1) {
        // Looping through org IDs and returning project count
        for (const orgData of orgIdAndName) {
            if (snykOrgId === orgData.id) {
                console.log("Searching for container projects in " + orgData.name)
                let projectData: Object | undefined = await fetchContatinerProjects(orgData.id, orgData.name);
                let projectIdsAndNames: any = returnProjectIds(projectData)

                for (const project of projectIdsAndNames) {
                    if (debug) {
                        console.log("Project Id: " + project.id)
                    }
                    // Find and return project snapshot ids
                    let projectSnapshotData = await findLastTwoSnapshotsIds(orgData.id, project.id)

                    if (debug) {
                        console.log("ID 1: " + projectSnapshotData[0].id)
                        console.log("ID 2: " + projectSnapshotData[1].id)
                    }
                    let currentIssues: any = [];
                    let pastSnapshotOneIssues: any = [];
                    let pastSnapshotTwoIssues: any = [];

                    // Pull in snapshot issues depending on if one, two or no snapshots are found
                    switch (projectSnapshotData.length) {
                        case 0:
                            console.log("Issue with returning snapshots, none found.");
                            break;
                        case 1:
                            console.log("Project doesn't have any historical snapshots.");
                            break;
                        case 2:
                            currentIssues = await fetchAggregatetdProjectSnapshotsIssues(orgData.id, project.id, projectSnapshotData[0].id);
                            pastSnapshotOneIssues = await fetchAggregatetdProjectSnapshotsIssues(orgData.id, project.id, projectSnapshotData[1].id);
                            break;
                        case 3:
                            currentIssues = await fetchAggregatetdProjectSnapshotsIssues(orgData.id, project.id, projectSnapshotData[0].id)
                            pastSnapshotOneIssues = await fetchAggregatetdProjectSnapshotsIssues(orgData.id, project.id, projectSnapshotData[1].id)
                            pastSnapshotTwoIssues = await fetchAggregatetdProjectSnapshotsIssues(orgData.id, project.id, projectSnapshotData[2].id)
                            break;
                    }

                    // Check if results are different
                    let diffValueFirstSnapshot = _.isEqual(currentIssues, pastSnapshotOneIssues)
                    let diffValueFirstSnapshotSecondSnapshot = _.isEqual(currentIssues, pastSnapshotTwoIssues)

                    if (debug) {
                        console.log("Here is the diffValueFirstSnapshot value: " + diffValueFirstSnapshot)
                        console.log("Current issues object length: " + currentIssues.length)
                        console.log("Past issues object length: " + pastSnapshotOneIssues.length)
                    }

                    // Check to see if the first snapshot is different and second snapshot is the same
                    if (!diffValueFirstSnapshot && diffValueFirstSnapshotSecondSnapshot) {
                        if (debug) {
                            console.log("Detected new issues in first snapshot, starting to compare projects snapshots")
                        }

                        const results = getSnapshotDifference(currentIssues, pastSnapshotOneIssues)

                        if (results.length >= 1) {
                            console.log("Project Id: " + project.id)
                            console.log("Project name: " + project.name)
                            console.log("Here is the diff: " + JSON.stringify(results, null, 2))
                        }
                        else {
                            console.log("No issues found")
                        }
                    }
                    // Check to see if the second snapshot is different and first snapshot is the same
                    if (diffValueFirstSnapshot && !diffValueFirstSnapshotSecondSnapshot) {
                        if (debug) {
                            console.log("Detected new issues in first snapshot, starting to compare projects snapshots")
                        }

                        const results = getSnapshotDifference(currentIssues, pastSnapshotTwoIssues)

                        if (results.length >= 1) {
                            console.log("Project Id: " + project.id)
                            console.log("Project name: " + project.name)
                            console.log("Here is the diff: " + JSON.stringify(results, null, 2))
                        }
                        else {
                            console.log("No issues found")
                        }
                    }
                    // Check to see if the last two snapshots came back false
                    if (!diffValueFirstSnapshot && !diffValueFirstSnapshotSecondSnapshot) {
                        if (debug) {
                            console.log("Detected new issues in first snapshot, starting to compare projects snapshots")
                        }

                        const resultsFirstSnapshot = getSnapshotDifference(currentIssues, pastSnapshotOneIssues)
                        const resultsSecondSnapshot = getSnapshotDifference(currentIssues, pastSnapshotTwoIssues)

                        let mergedNewIssues = Object.assign({}, ...resultsFirstSnapshot, ...resultsSecondSnapshot)

                        if (resultsFirstSnapshot.length >= 1 || resultsSecondSnapshot.length >= 1) {
                            console.log("Project Id: " + project.id)
                            console.log("Project name: " + project.name)
                            console.log("Here is the diff for merged snapshot: " + JSON.stringify(mergedNewIssues, null, 2))
                        }
                        else {
                            console.log("No issues found in merged snapshot")
                        }
                    }

                }
                process.exit(0);
            }

        }
    }
    else {
        // Looping through org IDs and returning project count
        for (const orgData of orgIdAndName) {
            console.log("Searching for container projects in " + orgData.name)
            let projectData: Object | undefined = await fetchContatinerProjects(orgData.id, orgData.name);
            let projectIdsAndNames: any = returnProjectIds(projectData)

            for (const project of projectIdsAndNames) {
                if (debug) {
                    console.log("Project Id: " + project.id)
                }
                // Find and return project snapshot ids
                let projectSnapshotData = await findLastTwoSnapshotsIds(orgData.id, project.id)

                if (debug) {
                    console.log("ID 1: " + projectSnapshotData[0].id)
                    console.log("ID 2: " + projectSnapshotData[1].id)
                }
                let currentIssues: any = [];
                let pastSnapshotOneIssues: any = [];
                let pastSnapshotTwoIssues: any = [];

                // Pull in snapshot issues depending on if one, two or no snapshots are found
                switch (projectSnapshotData.length) {
                    case 0:
                        console.log("Issue with returning snapshots, none found.");
                        break;
                    case 1:
                        console.log("Project doesn't have any historical snapshots.");
                        break;
                    case 2:
                        currentIssues = await fetchAggregatetdProjectSnapshotsIssues(orgData.id, project.id, projectSnapshotData[0].id);
                        pastSnapshotOneIssues = await fetchAggregatetdProjectSnapshotsIssues(orgData.id, project.id, projectSnapshotData[1].id);
                        break;
                    case 3:
                        currentIssues = await fetchAggregatetdProjectSnapshotsIssues(orgData.id, project.id, projectSnapshotData[0].id)
                        pastSnapshotOneIssues = await fetchAggregatetdProjectSnapshotsIssues(orgData.id, project.id, projectSnapshotData[1].id)
                        pastSnapshotTwoIssues = await fetchAggregatetdProjectSnapshotsIssues(orgData.id, project.id, projectSnapshotData[2].id)
                        break;
                }

                // Check if results are different
                let diffValueFirstSnapshot = _.isEqual(currentIssues, pastSnapshotOneIssues)
                let diffValueFirstSnapshotSecondSnapshot = _.isEqual(currentIssues, pastSnapshotTwoIssues)

                if (debug) {
                    console.log("Here is the diffValueFirstSnapshot value: " + diffValueFirstSnapshot)
                    console.log("Current issues object length: " + currentIssues.length)
                    console.log("Past issues object length: " + pastSnapshotOneIssues.length)
                }

                // Check to see if the first snapshot is different and second snapshot is the same
                if (!diffValueFirstSnapshot && diffValueFirstSnapshotSecondSnapshot) {
                    if (debug) {
                        console.log("Detected new issues in first snapshot, starting to compare projects snapshots")
                    }

                    const results = getSnapshotDifference(currentIssues, pastSnapshotOneIssues)

                    if (results.length >= 1) {
                        console.log("Project Id: " + project.id)
                        console.log("Project name: " + project.name)
                        console.log("Here is the diff: " + JSON.stringify(results, null, 2))
                    }
                    else {
                        console.log("No issues found")
                    }
                }
                // Check to see if the second snapshot is different and first snapshot is the same
                if (diffValueFirstSnapshot && !diffValueFirstSnapshotSecondSnapshot) {
                    if (debug) {
                        console.log("Detected new issues in first snapshot, starting to compare projects snapshots")
                    }

                    const results = getSnapshotDifference(currentIssues, pastSnapshotTwoIssues)

                    if (results.length >= 1) {
                        console.log("Project Id: " + project.id)
                        console.log("Project name: " + project.name)
                        console.log("Here is the diff: " + JSON.stringify(results, null, 2))
                    }
                    else {
                        console.log("No issues found")
                    }
                }
                // Check to see if the last two snapshots came back false
                if (!diffValueFirstSnapshot && !diffValueFirstSnapshotSecondSnapshot) {
                    if (debug) {
                        console.log("Detected new issues in first snapshot, starting to compare projects snapshots")
                    }

                    const resultsFirstSnapshot = getSnapshotDifference(currentIssues, pastSnapshotOneIssues)
                    const resultsSecondSnapshot = getSnapshotDifference(currentIssues, pastSnapshotTwoIssues)

                    let mergedNewIssues = Object.assign({}, resultsFirstSnapshot, resultsSecondSnapshot)

                    if (resultsFirstSnapshot.length >= 1 || resultsSecondSnapshot.length >= 1) {
                        console.log("Project Id: " + project.id)
                        console.log("Project name: " + project.name)
                        console.log("Here is the diff for merged snapshot: " + JSON.stringify(mergedNewIssues, null, 2))
                    }
                    else {
                        console.log("No issues found in merged snapshot")
                    }
                }

            }
        }
        process.exit(0);
    }

}

function getSnapshotDifference(currentIssues: any, pastSnapshotOneIssues: any) {
    let newIssues = new Array;

    for (let currentIssue of currentIssues) {
        let foundIssue: boolean = false;
        for (let pastIssue of pastSnapshotOneIssues) {
            if (currentIssue.id === pastIssue.id) {
                foundIssue = true
                break;
            }
        }
        if (foundIssue) {

            foundIssue = false
        }
        else {
            newIssues.push(currentIssue)
        }
    }

    return newIssues;
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
        if (snapshotIdAndCreatedDate.length === 3) {
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
    let projectIds: ProjectInfo[] = [];

    for (const x in projectData) {
        for (const keyProjects in projectData[x]) {
            const projectDataHolder: ProjectInfo = {
                id: projectData[x][keyProjects].id,
                name: projectData[x][keyProjects]['attributes'].name
            };

            // orgInfo.push(orgDataHolder)
            projectIds.push(projectDataHolder)
            // projectIds.push(projectData[x][keyProjects].id)
            // console.log("See project data here")
            // console.log(JSON.stringify(projectData[x][keyProjects], null, 2))
        }
    }
    return projectIds;
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