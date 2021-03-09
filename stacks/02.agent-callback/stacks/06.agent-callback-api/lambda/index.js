const AWS = require('aws-sdk');
const stepfunctions = new AWS.StepFunctions();

const {AGENT_CALLBACK_WORKFLOW_ARN} = process.env;

module.exports.handler = async(event) => {
    const Signature = event.headers['X-Goog-Signature'];
    const Payload = event.body;
    const params = {
        stateMachineArn: AGENT_CALLBACK_WORKFLOW_ARN,
        input: JSON.stringify({Signature, Payload}),
        name: `acw-${new Date().getTime()}`
    };
    console.info(`Parameters: ${JSON.stringify(params)}.`);
    return new Promise((resolve, reject) => {
        stepfunctions.startSyncExecution(params, (err, data) => {
            if (err) reject(err);
            else {
                const {output:outputString} = data;
                const output = JSON.parse(outputString);
                resolve({
                    statusCode: output.statusCode? output.statusCode: 500,
                    body: JSON.stringify({message: output.message? output.message: output})
                });
            }
        });
    });
};