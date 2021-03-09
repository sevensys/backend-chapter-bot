const AWS = require('aws-sdk');
const moment = require('moment');
const dynamodb = new AWS.DynamoDB();
const {v4: uuidv4} = require('uuid');

const {LOCKS_TABLE} = process.env;

module.exports.handler = async(request) => new Promise((resolve, reject) => {
    const {cmd, lock, owner} = request;
    const version = request.version || uuidv4();

    const params = {
        TableName: LOCKS_TABLE,
        ExpressionAttributeValues: {
            ":LockVersion": {
                S: version
            }
        }
    };

    switch(cmd) {
        case 'acquire':
            const lease = moment().add(Math.abs(request.lease || 20), 'seconds').unix();
            params.Item = {
                LockName: {
                    S: lock
                },
                LockVersion: {
                    S: version
                },
                LockOwner: {
                    S: owner
                },
                ExpiresAt: {
                    N: `${lease}`
                }
            };
            params.ConditionExpression = `attribute_not_exists(LockName) OR (attribute_exists(LockName) AND LockVersion = :LockVersion)`;

            dynamodb.putItem(params, (err, data) => {
                if(err) {
                    reject(err);
                } else {
                    resolve({
                        cmd,
                        lock,
                        owner,
                        version,
                        lease
                    });
                }
            });
            break;
        case 'release':
            params.Key = {
                LockName: {
                    S: lock
                }
            }
            params.ReturnValues = 'ALL_OLD';
            params.ConditionExpression = `attribute_exists(LockName) AND LockVersion = :LockVersion`;
            dynamodb.deleteItem(params, (err, data) => {
                if(err) {
                    reject(err);
                } else {
                    const attributes = data.Attributes;
                    resolve({
                        cmd,
                        lock,
                        owner,
                        version,
                        lease: Number(attributes['ExpiresAt'].N)
                    });
                }
            });
            break;
        default:
            return reject(`Unknown cmd: ${cmd}`);
    }

});

