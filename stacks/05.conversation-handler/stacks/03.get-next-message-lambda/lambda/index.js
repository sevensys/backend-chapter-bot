const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB();
const {MESSAGES_TABLE} = process.env;

module.exports.handler = async({ConversationId}) => new Promise((resolve, reject) => {
    const queryParams = {
        TableName: MESSAGES_TABLE,
        KeyConditionExpression: 'ConversationId = :ConversationId',
        Limit: 1,
        ScanIndexForward: true,
        ExpressionAttributeValues: {
            ':ConversationId': {S: ConversationId}
        },
        IndexName: 'MessagesBySendTime'
    };
    console.log('Query params: '+JSON.stringify(queryParams));
    dynamodb.query(queryParams, (err, data) => {
        if(err) {
            reject(err);
        } else {
            const {Items, Count} = data;
            console.info('data: '+JSON.stringify(data));
            if(Count > 0) {
                const Item = Items[0];
                const {ConversationId, RequestId, Agent, SendTime, Signature, Type} = Item;
                const Output = {
                    MessageAvailable: true,
                    Message: {
                        ConversationId: ConversationId.S,
                        RequestId: RequestId.S,
                        CustomAgentId: Item.CustomAgentId && Item.CustomAgentId.S? Item.CustomAgentId.S: '',
                        Agent: Agent.S,
                        SendTime: SendTime.S,
                        Signature: Signature.S,
                        Type: Type.S
                    }
                };
                console.log('Output: ', JSON.stringify(Output));
                const deleteParams = {
                    TableName: MESSAGES_TABLE,
                    Key: {
                        ConversationId,
                        RequestId
                    }
                };
                dynamodb.deleteItem(deleteParams, (err, data) => {
                    if(err) {
                        reject(err);
                    } else {
                        resolve(Output);
                    }
                });
            } else {
                resolve({
                    MessageAvailable: false,
                    Message: {}
                })
            }
        }
    });
});