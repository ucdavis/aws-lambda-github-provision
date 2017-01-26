'use strict';

// Required packages provided by AWS Lambda
var fs = require('fs');
var AWS = require('aws-sdk');
// Required packages found in ./node_modules/
var GitHubApi = require("github");

const GITHUB_API_TIMEOUT = 5000;                 // GitHub API timeout
const AWS_REGION = 'us-west-2';                  // required to use AWS KMS service
const ENCRYPTED_FILENAME = './encrypted-secret'; // filename of encrypted KMS credentials

// Check if environment supports native promises
if(typeof Promise === 'undefined') {
    AWS.config.setPromisesDependency(require('bluebird'));
}

// Export the AWS Lambda handler as required.
exports.handler = (event, context, callback) => {
    // Ensure we received the 'username' and 'token' GET parameters
    if((event.queryStringParameters === undefined) || (event.queryStringParameters.username === undefined) || (event.queryStringParameters.token === undefined)) {
        // Incorrect GET parameters
        callback(null, {
            "statusCode": 400,
            "headers": {},
            "body": JSON.stringify({
                success: false,
                username: null,
                message: "GET parameter 'username' and/or 'token' is missing."
            })
        });

        return;
    }

    // Decrypt token and GitHub credentials using key stored in AWS' KMS
    var kms = new AWS.KMS({region: AWS_REGION});
    var encryptedSecret = fs.readFileSync(ENCRYPTED_FILENAME);

    kms.decrypt({ CiphertextBlob: encryptedSecret }, function(err, data) {
        if(err != null) {
            console.log("Unable to decrpyt from KMS.");
            console.log(err, err.stack);
            
            callback(null, {
                "statusCode": 500,
                "headers": {},
                "body": JSON.stringify({
                    success: false,
                    username: null,
                    message: "Error while retrieving GitHub credentials."
                })
            });
        } else {
            var decryptedScret = data['Plaintext'].toString();
            var credentials = JSON.parse(decryptedScret);

            if(event.queryStringParameters.token != credentials.token) {
                // Supplied username and password but token is incorrect
                callback(null, {
                    "statusCode": 401,
                    "headers": {},
                    "body": JSON.stringify({
                        success: false,
                        username: null,
                        message: "GET parameter 'token' is incorrect."
                    })
                });
            } else {
                // We have the username and the correct token, now try to use the GitHub API ...
                var github = new GitHubApi({
                    debug: true,
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
                github.orgs.addOrgMembership({
                    org: "ucdavis",
                    username: event.queryStringParameters.username,
                    role: "member"
                }, function (err, res) {
                    if(err == null) {
                        // Member added. Indicate success to Lambda!
                        callback(null, {
                            "statusCode": 200,
                            "headers": {},
                            "body": JSON.stringify({
                                success: true,
                                username: event.queryStringParameters.username,
                                message: "User added or is already in organization."
                            })
                        });
                    } else {
                        // Error while communicating with GitHub, indicate failure to Lambda.
                        callback(null, {
                            "statusCode": 500,
                            "headers": {},
                            "body": JSON.stringify({
                                success: false,
                                username: event.queryStringParameters.username,
                                message: "GitHub API returned an error."
                            })
                        });
                    }
                });
            }
        }
    });
};
