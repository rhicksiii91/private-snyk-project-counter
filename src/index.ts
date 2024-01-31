import fetch from 'node-fetch';

const snykToken: any = process.env.SNYK_TOKEN;
const snykOrgId: any = process.env.SNYK_ORG_ID;
const debug: any = process.env.DEBUG;
const restApiVersion: string = '2023-09-14'


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
    // Debug log
    if (debug) {
        console.debug("Snyk Token: " + snykToken)
        console.debug("Org ID: " + snykOrgId)
    }
    let orgIdAndName: any = await fetchOrgs()

    // Checking if SNYK_ORG_ID ernvironment variable exist and is not undefined.  If true, data results for organziation.  If the result is false, return data for all organizations
    if (snykOrgId !== undefined && snykOrgId.length >= 1){
        // Looping through org IDs and returning project count
        for (const orgData of orgIdAndName) {
            if (snykOrgId === orgData.id){
                let projectCount: number | undefined = await fetchProjectsCount(orgData.id, orgData.name);

                // Check if project count is within 10% of 25000 limit or over 25000 limit
                if (projectCount != undefined) {
                    if (projectCount >= 22500 && projectCount <= 24999) {
                        console.log("Snyk Organziation " + orgData.name + " has " + JSON.stringify(projectCount) + " projects and is within 10% of the maximun project count")
                    }
                    if (projectCount >= 25000) {
                        console.log("Snyk Organziation " + orgData.name + " has " + JSON.stringify(projectCount) + " projects and is over the maximun project count")
                    }
                }
                process.exit(0);
            }
        }
    }
    else {
        // Looping through org IDs and returning project count
        for (const orgData of orgIdAndName) {
            let projectCount: number | undefined = await fetchProjectsCount(orgData.id, orgData.name);

            // Check if project count is within 10% of 25000 limit or over 25000 limit
            if (projectCount != undefined){
                if (projectCount >= 22500 && projectCount <= 24999) {
                    console.log("Snyk Organziation " + orgData.name + " has " + JSON.stringify(projectCount) + " projects and is within 10% of the maximun project count")
                }
                if (projectCount >= 25000) {
                    console.log("Snyk Organziation " + orgData.name + " has " + JSON.stringify(projectCount) + " projects and is over the maximun project count")
                }
            }   
        }
        process.exit(0);
    }
    
}

async function fetchProjectsCount(orgId: string, orgName: string) {
    let url: string = `https://api.snyk.io/rest/orgs/${orgId}/projects?version=${restApiVersion}&limit=100`
    let hasNextLink = true;
    let projectCount = 0;
    
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
            if (debug){
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
                // Counting projects
                projectCount = projectCount + Object.keys(projectData.data).length

                // Checking for more pages
                if (projectData.links && projectData.links.next) {
                    hasNextLink = true
                    url = "https://api.snyk.io" + projectData.links.next
                }
                else {
                    hasNextLink = false
                    return projectCount;
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
    let orgInfo: OrgInfo[] = [];
    let paramsString: any = { version: restApiVersion, limit: "100", }
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

            if(debug){
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
                    let orgDataHolder: OrgInfo = {
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

