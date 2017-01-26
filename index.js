const express = require('express');
const app = express();
const authS3O = require('s3o-middleware');
app.use(authS3O);
const AWS = require('aws-sdk');
const url = require('url');

/** Environment variables **/
var port = process.env.PORT || 3001;
var deweyBucket = process.env.DEWEY_LIBRARY || 'dewey-render';

AWS.config = new AWS.Config();
AWS.config.accessKeyId = process.env.AWS_ACCESS_KEY;
AWS.config.secretAccessKey = process.env.AWS_SECRET_KEY;
const s3 = new AWS.S3();
app.use(function(req, res) {
	var url_parts = url.parse(req.url);

	// Strip off the slash from the path
	var key = url_parts.pathname.substr(1);

	// Default to index page
	if (!key) key = "index.html";
	if (key.indexOf(".") == -1) key += ".html";   //only add extension if no extension is provided
	var params = {Bucket: deweyBucket, Key: key};
	var stream = s3.getObject(params).createReadStream();
	stream.on('error', function (error) {
		if (error.statusCode == 404) {
			res.status(404).send("404: Page not found");
		} else {
			console.error(e);
			res.status(502).send("Internal AWS error: " + error.message);
		}
	});
    res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('content-type', 'text/html');
	stream.pipe(res);
});

app.listen(port, function () {
  console.log('App listening on port '+port);
});
