'use strict';

exports.handler = (event, context, callback) => {
    var data = null;

    if((event.queryStringParameters !== undefined) && (event.queryStringParameters.username !== undefined)) {
        // Decrypt GitHub credentials using key stored in AWS' KMS
        var fs = require('fs');
        var AWS = require('aws-sdk');
        var kms = new AWS.KMS({region:'us-west-2'});

        var secretPath = './encrypted-secret';
        var encryptedSecret = fs.readFileSync(secretPath);

        var params = {
            CiphertextBlob: encryptedSecret
        };

        kms.decrypt(params, function(err, data) {
            if(err) {
                console.log("Unable to decrpyt from KMS.");
                console.log(err, err.stack);
            } else {
                var decryptedScret = data['Plaintext'].toString();

                var credentials = JSON.parse(decryptedScret);

                // Key obtained and decrypted. Now try GitHub ...
                var GitHubApi = require("github");

                var github = new GitHubApi({
                    // optional
                    debug: true,
                    protocol: "https",
                    host: "api.github.com",
                    pathPrefix: "",
                    headers: {
                        "user-agent": "UCD-DSS-GH-Provision"
                    },
                    Promise: require('bluebird'),
                    followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects
                    timeout: 5000
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
                        // Username supplied. Attempt to add to GitHub
                        data = {
                            success: true,
                            username: event.queryStringParameters.username
                        };
                    
                        // here's the object we need to return
                        const res = {
                            "statusCode": 200,
                            "headers": {},
                            "body": JSON.stringify(data)
                        };
                        
                        callback(null, res);
                    } else {
                        // Error while communicating with GitHub
                        data = {
                            success: false,
                            username: null
                        };

                        const res = {
                            "statusCode": 500,
                            "headers": {},
                            "body": JSON.stringify(data)
                        };
                    
                        callback(null, res);
                    }
                });
            }
        });
    } else {
        // Incorrect query parameters
        data = {
           success: false,
           username: null
        };

        const res = {
            "statusCode": 400,
            "headers": {},
            "body": JSON.stringify(data)
        };
    
        callback(null, res);
    }
};
