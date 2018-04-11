'use strict';

const logger = require('@financial-times/n-logger').default;
const path = require('path');
const express = require('express');
const authS3O = require('s3o-middleware');
const AWS = require('aws-sdk');
const url = require('url');

const app = express();
app.use(authS3O);

/** Environment variables * */
const port = process.env.PORT || 3001;
const deweyBucket = process.env.DEWEY_LIBRARY || 'dewey-render';

AWS.config = new AWS.Config();
AWS.config.accessKeyId = process.env.AWS_ACCESS_KEY;
AWS.config.secretAccessKey = process.env.AWS_SECRET_KEY;

const s3 = new AWS.S3();

const getKey = (requestPath) => {
    const key = requestPath.replace(/^\//, '') || 'index'

    return path.extname(key) ? key : `${key}.html`;
}

app.use((request, response) => {
    response.setHeader(
        'Cache-Control',
        'private, no-cache, no-store, must-revalidate, max-age=0'
    );
    response.setHeader('Content-Type', 'text/html');

    const key = getKey(request.path);

    s3
        .getObject({ Bucket: deweyBucket, Key: key })
        .createReadStream()
        .on('error', error => {
            if (error.statusCode === 404) {
                response.status(404).send('404: Page not found');
            } else {
                logger.error(error);
                response
                    .status(502)
                    .send(`Internal AWS error: ${error.message}`);
            }
        })
        .pipe(response);
});

app.listen(port, () => {
    logger.info(`App listening on port ${port}`);
});
