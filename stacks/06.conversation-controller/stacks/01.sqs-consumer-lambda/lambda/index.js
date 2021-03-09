const AWS = require('aws-sdk');
const sqs = new AWS.SQS();

const {QUEUE_URL} = process.env;

module.exports.handler = async() => new Promise((resolve, reject) => {
    const params = {
        QueueUrl: QUEUE_URL,
        MessageAttributeNames: [
            'All'
        ],
        MaxNumberOfMessages: 1,
        VisibilityTimeout: 900,
        WaitTimeSeconds: 20
    };
    sqs.receiveMessage(params, (err, data) => {
        if(err) {
            reject(`Issue receiving a message from ${QUEUE_URL}: ${JSON.stringify(err)}`);
        } else {
            console.log(`Received messages: ${JSON.stringify(data)}`);
            const Output = {
                AvailableMessage: data.Messages && data.Messages.length > 0? true:false,
                Message: data.Messages && data.Messages.length > 0? JSON.parse(data.Messages[0].Body): {}
            }
            if(Output.AvailableMessage){
                const ReceiptHandle = data.Messages[0].ReceiptHandle;
                const deleteParams = {
                    QueueUrl: QUEUE_URL,
                    ReceiptHandle
                };
                sqs.deleteMessage(deleteParams, (err, data) => {
                    if(err) {
                        reject(`Unable to delete message ${ReceiptHandle} from ${QUEUE_URL}: ${JSON.stringify(err)}`);
                    } else {
                        resolve(Output);
                    }
                });
            } else {
                resolve(Output);
            }
        }
    })
});