Description
-----------

NodeJS script designed to run in AWS Lambda + API Gateway to provision a GitHub account into
the UC Davis organization.

Setting Up with AWS Lambda, AWS KMS, and AWS Gateway API
--------------------------------------------------------

1. Set up the KMS-encrypted credentials file in S3:

	Credentials for GitHub are a JSON file encrypted by KMS and stored in a S3 bucket.

	To produce the file:

	aws kms encrypt --key-id THE_AWS_KMS_KEY_ID --plaintext "{\"username\": \"ORG_WRITING_GH_USERNAME\", \"password\": \"THE_PASSWORD\", \"token\": \"TOKEN_TO_RUN\"}" --query CiphertextBlob --output text | base64 -D > ./encrypted-secret

	Copy the resulting file to S3 and configure the bucket name and key in the constants section near the top of index.js.

2. Upload the code to Lambda:

	To upload to AWS Lambda, select their upload function and provide it with a .zip file generated, e.g.:

	cd into_the_directory_with_index_js
	zip -r filename.zip *

Using
-----

Once set up, run, e.g. curl -v "https://something.amazonaws.com/stag_name/lambda_name?username=EXISTING_GH_USERNAME&token=TOKEN_TO_RUN".

Version 1.0
Author: Christopher Thielen <cmthielen@(at)ucdavis.edu>
