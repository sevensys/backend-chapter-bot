const AWS = require('aws-sdk')
const {CONVERSATIONS_TABLE, WORKFLOW_ARN} = process.env;
const stepFunctions = new AWS.StepFunctions();
const dynamoDb = new AWS.DynamoDB();

const getExistingExecutionId = ConversationId => new Promise((resolve, reject) => {
    const params = {
        TableName: CONVERSATIONS_TABLE,
        Key: {
            ConversationId: {
                S: ConversationId
            }
        },
        ConsistentRead: true
    };
    dynamoDb.getItem(params, (err, data) => {
        if(err) {
            reject(err);
        } else {
            if(data.Item && data.Item.ExecutionId && data.Item.ExecutionId.S) {
                resolve(data.Item.ExecutionId.S);
            } else {
                reject("No item found for conversation id: " + ConversationId);
            }

        }
    })
});

const getExecutionState = executionArn => new Promise((resolve, reject) => {
    const params = {
        executionArn
    };
    stepFunctions.describeExecution(params, (err, data) => {
        if(err) {
            reject(err);
        } else {
            resolve(data.status);
        }
    });
});

const startWorkflow = ConversationId => new Promise((resolve, reject) => {
    const params = {
        stateMachineArn: WORKFLOW_ARN,
        input: JSON.stringify({ConversationId}),
        name: `${ConversationId}-${new Date().getTime()}`
    }
    stepFunctions.startExecution(params, (err, data) => {
        if(err) {
            reject(err);
        } else {
            resolve(data.executionArn);
        }
    })
});

const persistConversationIdAndExecutionArn = (ConversationId, ExecutionId) => new Promise((resolve, reject) => {
    const params = {
        TableName: CONVERSATIONS_TABLE,
        Item: {
            ConversationId: {
                S: ConversationId
            },
            ExecutionId: {
                S: ExecutionId
            }
        }
    }

    dynamoDb.putItem(params, (err, data) => {
        if(err) {
            reject(err);
        } else {
            resolve(data);
        }
    })
});

module.exports.handler = async({ConversationId}) => {
    let RestartConversation;
    let ExecutionId = '';
    try{
        ExecutionId = await getExistingExecutionId(ConversationId);
        const State = await getExecutionState(ExecutionId);
        RestartConversation = State !== 'RUNNING';
    } catch (e) {
        console.error(
            'Unable to determine execution state of conversation handler: ' + ConversationId,
            JSON.stringify(e)
        );
        RestartConversation = true;
    }

    if(RestartConversation) {
        ExecutionId = await startWorkflow(ConversationId);
        await persistConversationIdAndExecutionArn(ConversationId, ExecutionId);
    }
    return ExecutionId;
}