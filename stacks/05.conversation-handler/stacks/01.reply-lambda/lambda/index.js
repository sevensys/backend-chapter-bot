const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const {auth} = require('google-auth-library');
const businessmessages = require('businessmessages');
const {v4: uuidv4} = require('uuid');
const {CREDENTIALS_BUCKET, CREDENTIALS_KEY} = process.env;


const getCredentials = async() => new Promise((resolve, reject) => {
    const getCredentialsParams = {
        Bucket: CREDENTIALS_BUCKET,
        Key: CREDENTIALS_KEY,
        ResponseContentType: 'application/json'
    };
    s3.getObject(getCredentialsParams, (err, data) => {
        if(err) {
            reject(err);
        } else {
            resolve(JSON.parse(data.Body.toString()));
        }
    });
})

const bmApi = new businessmessages.businessmessages_v1.Businessmessages({});

module.exports.handler = async({conversationId, isEvent, resource}) => {
    const credentials = await getCredentials();
    console.info('JSON credentials: '+JSON.stringify(credentials));
    const authClient = auth.fromJSON(credentials);
    authClient.scopes = [
        'https://www.googleapis.com/auth/businessmessages'
    ];

    // Initialize auth token
    await authClient.getAccessToken();

    if(isEvent) {
        const apiParams = {
            auth: authClient,
            eventId: uuidv4(),
            resource,
            parent: 'conversations/' + conversationId
        };
        return new Promise((resolve, reject) => {
            bmApi.conversations.events.create(apiParams, {auth: authClient}, (err, response) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(response);
                }
            });
        });
    } else {
        const apiParams = {
            auth: authClient,
            parent: 'conversations/' + conversationId,
            resource: {
                ... resource,
                messageId: uuidv4()
            }
        };
        return new Promise((resolve, reject) => {
            bmApi.conversations.messages.create(apiParams, {auth: authClient}, (err, response) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(response);
                }
            });
        })
    }
};
