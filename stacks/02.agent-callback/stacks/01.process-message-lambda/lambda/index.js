const crypto = require('crypto');
const moment = require('moment');
const {v4: uuidv4} = require('uuid');

const {PARTNER_KEY} = process.env;
const KNOWN_MESSAGE_TYPES = [
    'userStatus', 'message', 'receipts', 'suggestionResponse', 'authenticationResponse', 'surveyResponse'
];

module.exports.handler = async({Signature, Payload}) => {
    const startsAt = new Date().getMilliseconds();
    console.info(`Processing signature: ${Signature} and payload: ${Payload}`);
    const GeneratedSignature = crypto
        .createHmac('sha512', PARTNER_KEY)
        .update(Buffer.from(Payload, 'utf8'))
        .digest('base64');
    const ParsedPayload = JSON.parse(Payload);
    const {agent:Agent, conversationId:ConversationId, requestId:RequestId, sendTime} = ParsedPayload;
    const Message = {
        ConversationId,
        RequestId,
        SendTime: moment(sendTime).valueOf(),
        Agent,
        CustomAgentId: ParsedPayload['customAgentId']? ParsedPayload['customAgentId']: '',
        Type: KNOWN_MESSAGE_TYPES.find(KnownType => !!ParsedPayload[KnownType]) || '',
        Signature:GeneratedSignature,
        ValidSignature: GeneratedSignature == Signature,
        Uuid: uuidv4()
    }
    const ms = new Date().getMilliseconds() - startsAt;
    console.info(`Processed request in ${ms} ms`);
    return Message;
}