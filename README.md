Description
-----------

NodeJS script designed to run in AWS Lambda + API Gateway to provision a GitHub account into
the UC Davis organization.

Setting Up with AWS Lambda, AWS KMS, and AWS Gateway API
--------------------------------------------------------

1. Set up the KMS-secured credentials file:

	The script currently stores credentials for GitHub in a file named 'encrypted-secret', meant to be in the same directory as the script.

	The file is encrypted using a key stored in AWS' KMS. Once you have an encryption key in KMS, create the file:

	(Using the 'aws' CLI)

	aws kms encrypt --key-id THE_KEY_ID --plaintext "{\"username\": \"ORG_WRITING_GH_USERNAME\", \"password\": \"THE_PASSWORD\", \"token\": \"TOKEN_TO_RUN\"}" --query CiphertextBlob --output text | base64 -D > ./encrypted-secret

2. Package the code with the encrypted file and upload to Lambda:

	To upload to AWS Lambda, select their upload function and provide it with a .zip file generated, e.g.:

	cd into_the_directory_with_index_js
	zip -r filename.zip *

Using
-----

Once set up, run, e.g. curl -v "https://something.amazonaws.com/stag_name/lambda_name?username=EXISTING_GH_USERNAME".

Version 1.0
Author: Christopher Thielen <cmthielen@(at)ucdavis.edu>
