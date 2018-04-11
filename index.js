'use strict';

const logger = require('@financial-times/n-logger').default;
const path = require('path');
const express = require('express');
const authS3O = require('s3o-middleware');
const AWS = require('aws-sdk');

/** Environment variables * */
const port = process.env.PORT || 3001;
const deweyBucket = process.env.DEWEY_LIBRARY || 'dewey-render';

AWS.config = new AWS.Config();
AWS.config.accessKeyId = process.env.AWS_ACCESS_KEY;
AWS.config.secretAccessKey = process.env.AWS_SECRET_KEY;

const app = express();

app.set('trust proxy', 2);

const overrideHostHeaderForS3o = request =>
    Object.assign({}, request, {
        headers: Object.assign({}, request.headers, {
            host: request.hostname
        })
    });

app.use((request, response, next) =>
    authS3O(overrideHostHeaderForS3o(request), response, next)
);

const s3 = new AWS.S3();

const getKey = (systemCode = 'index') => {
    return path.extname(systemCode) ? systemCode : `${systemCode}.html`;
};

const getItem = (request, response) => {
    response.setHeader(
        'Cache-Control',
        'private, no-cache, no-store, must-revalidate, max-age=0'
    );
    response.setHeader('Content-Type', 'text/html');

    const key = getKey(request.params.systemCode);

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
};

const attachRoutes = router => {
    router.get('/:systemCode', getItem);
    return router;
};

const runbookRouter = attachRoutes(express.Router());
const baseRouter = attachRoutes(express.Router());

app.use('/', baseRouter);
app.use('/runbooks', runbookRouter);

app.listen(port, () => {
    logger.info(`App listening on port ${port}`);
});
