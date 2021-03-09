const AWS = require('aws-sdk');
const stepFunctions = new AWS.StepFunctions();

exports.handler = async(event) => new Promise((resolve, reject) => {
    const {Name:name, StateMachineArn:stateMachineArn, Input:input} = event;
    const simpleName = name?(name.indexOf('-') > -1?name.substring(0,name.indexOf('-')):name):'cc';
    const params = {
        stateMachineArn,
        name: `${simpleName}-${new Date().getTime()}`,
        input
    };
    stepFunctions.startExecution(params, (err, data) => {
        if(err) {
            reject(`Unable to launch stateMachine: ${stateMachineArn}. ${JSON.stringify(err)}`);
        } else {
            resolve(data.executionArn);
        }
    })
});
