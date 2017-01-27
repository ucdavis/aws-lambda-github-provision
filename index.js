'use strict';

// Required packages provided by AWS Lambda
const AWS = require('aws-sdk');
const S3 = new AWS.S3({ apiVersion: '2006-03-01' });

// Required packages found in ./node_modules/
var GitHubApi = require("github");

// GitHub API timeout
const GITHUB_API_TIMEOUT = 5000;

// AWS KMS service is region-specific
const AWS_REGION         = 'us-west-2';

// S3 bucket/key with encrpyted GitHub credentials and usage token
const S3_BUCKET_NAME     = 'lambda-github-credentials';
const S3_KEY_NAME        = 'encrypted-secret';

// GitHub ID of the team a new organization member should be added to.
// Found via API call to organization's team list. See GitHub API docs.
const GITHUB_TEAM_ID     = 34315;

// Ensure Promise support is available
if(typeof Promise === 'undefined') {
    Promise = require('bluebird');
    AWS.config.setPromisesDependency(Promise);
}

// Export the AWS Lambda handler as required.
exports.handler = (event, context, callback) => {
    // Ensure we received the 'username' and 'token' GET parameters
    if((event.queryStringParameters === undefined) || (event.queryStringParameters.username === undefined) || (event.queryStringParameters.token === undefined)) {
        // Incorrect GET parameters
        lambdaResult(callback, 400, false, "GET parameter 'username' and/or 'token' is missing.");
        return;
    }

    var retrieveCredentials = retrieveCredentialsFromS3();

    retrieveCredentials.then(function(credentials) {
        if(event.queryStringParameters.token != credentials.token) {
            // Supplied username and password but token is incorrect
            lambdaResult(callback, 401, false, "GET parameter 'token' is incorrect.");
            return;
        } else {
            var gitHubOperation = addToGitHub(credentials, event.queryStringParameters.username);

            gitHubOperation.then(function(data) {
                lambdaResult(callback, 200, true, "User added or is already in organization.");
                return;
            }).catch(function(err) {
                lambdaResult(callback, 500, false, "GitHub API returned an error.");
                return;
            });
        }
    }).catch(function(err) {
        lambdaResult(callback, 500, false, "Unable to retrieve credentials from S3");
        return;
    });
};

// Shorthand for Lambda's callback() method
var lambdaResult = function(callback, statusCode, success, message) {
    callback(null, {
        "statusCode": statusCode,
        "headers": {},
        "body": JSON.stringify({
            success: success,
            message: message
        })
    });
};

// Decrypt token and GitHub credentials using key stored in AWS' KMS
var retrieveCredentialsFromS3 = function() {
    return new Promise(function(resolve, reject) {
        var kms = new AWS.KMS({region: AWS_REGION});

        var getS3Object = S3.getObject({
            Bucket: S3_BUCKET_NAME,
            Key: S3_KEY_NAME,
        }).promise();

        getS3Object.then(function(data) {
            let encryptedS3data = data.Body;

            var decryptFromKms = kms.decrypt({ CiphertextBlob: encryptedS3data }).promise();
            
            decryptFromKms.then(function(data) {
                var decryptedScret = data['Plaintext'].toString();
                var credentials = JSON.parse(decryptedScret);

                resolve(credentials);
            }).catch(function(err) {
                // Unable to decrypt S3 object
                reject("Unable to decrpyt S3 object.");
            });
        }).catch(function(err) {
            // Unable to get S3 object
            reject("Unable to fetch S3 object.");
        });
    });
}

// Using 'credentials', add 'username' to the UC Davis organization and the 'ucdavis/developers' team.
var addToGitHub = function(credentials, username) {
    return new Promise(function(resolve, reject) {
        var github = new GitHubApi({
            debug: false,
            protocol: "https",
            host: "api.github.com",
            pathPrefix: "",
            headers: {
                "user-agent": "UCD-DSS-GH-Provision"
            },
            Promise: require('bluebird'),
            followRedirects: false,
            timeout: GITHUB_API_TIMEOUT
        });

        github.authenticate({
            type: "basic",
            username: credentials.username,
            password: credentials.password
        });

        // Add member to org
        var addToOrg = github.orgs.addOrgMembership({
            org: "ucdavis",
            username: username,
            role: "member"
        });
        
        addToOrg.then(function(data) {
            var addToTeam = github.orgs.addTeamMembership({
                id: GITHUB_TEAM_ID,
                username: username,
                role: "member"
            });

            addToTeam.then(function(data) {
                resolve("Member added to organization and team, or already had membership.");
            }).catch(function(err) {
                // Error while communicating with GitHub.
                reject("GitHub API returned an error while adding member to team.");
            });
        }).catch(function(err) {
            // Error while communicating with GitHub.
            reject("GitHub API returned an error while adding member to organization.");
        });
    });
}
