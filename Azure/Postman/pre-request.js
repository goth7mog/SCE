// Azure AD OAuth2 Client Credentials Flow - Pre-request Script

// Read required environment variables
const tenantId = pm.environment.get("tenantId");
const clientId = pm.environment.get("clientId");
const clientSecret = pm.environment.get("clientSecret");
const aadScope = pm.environment.get("aadScope");

// Validate required environment variables
const missingVars = [];
if (!tenantId) missingVars.push("tenantId");
if (!clientId) missingVars.push("clientId");
if (!clientSecret) missingVars.push("clientSecret");
if (!aadScope) missingVars.push("aadScope");

if (missingVars.length > 0) {
    pm.test("Required environment variables are set", function () {
        pm.expect.fail("Missing required environment variables: " + missingVars.join(", ") + ". Please set these in your environment.");
    });
} else {
    // Build the token endpoint URL
    const tokenUrl = "https://login.microsoftonline.com/" + tenantId + "/oauth2/v2.0/token";

    // Build the request body (x-www-form-urlencoded)
    const requestBody = {
        mode: "urlencoded",
        urlencoded: [
            { key: "grant_type", value: "client_credentials" },
            { key: "client_id", value: clientId },
            { key: "client_secret", value: clientSecret },
            { key: "scope", value: aadScope }
        ]
    };

    // Send the token request
    pm.sendRequest({
        url: tokenUrl,
        method: "POST",
        header: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: requestBody
    }, function (err, response) {
        if (err) {
            pm.test("Azure AD token request completed", function () {
                pm.expect.fail("Token request failed with error: " + err);
            });
        } else {
            const responseJson = response.json();

            if (response.code === 200 && responseJson.access_token) {
                // Success - store the access token
                pm.environment.set("azureAccessToken", responseJson.access_token);

                // Set the Authorization header using pm.variables.replaceIn
                pm.request.headers.upsert({
                    key: "Authorization",
                    value: pm.variables.replaceIn("Bearer {{azureAccessToken}}")
                });

                pm.test("Azure AD token acquired successfully", function () {
                    pm.expect(responseJson.access_token).to.be.a("string").and.not.empty;
                });

                console.log("Azure AD access token acquired and Authorization header set.");
            } else {
                // Token acquisition failed
                const errorDescription = responseJson.error_description || responseJson.error || "Unknown error";
                pm.test("Azure AD token acquired successfully", function () {
                    pm.expect.fail("Token acquisition failed (HTTP " + response.code + "): " + errorDescription);
                });
            }
        }
    });
}