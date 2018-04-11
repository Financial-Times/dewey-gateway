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

const overrideHostHeaderForS3o = (request, response, next) => {
    request.headers.host = request.hostname;
    next();
};

app.use(overrideHostHeaderForS3o);
app.use(authS3O);

const s3 = new AWS.S3();

const getKey = (systemCode = 'index') => {
    return path.extname(systemCode) ? systemCode : `${systemCode}.html`;
};

const getItem = (request, response, next) => {
    const { params } = request;
    response.setHeader(
        'Cache-Control',
        'private, no-cache, no-store, must-revalidate, max-age=0'
    );
    response.setHeader('Content-Type', 'text/html');

    const key = getKey(params && params.systemCode);

    logger.info({ key, params }, 'Getting object from S3');

    s3
        .getObject({ Bucket: deweyBucket, Key: key })
        .createReadStream()
        .on('error', error => {
            if (error.statusCode === 404) {
                return next();
            }
            logger.error(error);
            return response
                .status(502)
                .send(`Internal AWS error: ${error.message}`);
        })
        .pipe(response);
};

const attachRoutes = router => {
    router.use('/', getItem);
    router.use('/:systemCode', getItem);
    return router;
};

const runbookRouter = attachRoutes(express.Router());
const baseRouter = attachRoutes(express.Router());

app.use('/runbooks', runbookRouter);
app.use('/', baseRouter);

app.listen(port, () => {
    logger.info(`App listening on port ${port}`);
});
