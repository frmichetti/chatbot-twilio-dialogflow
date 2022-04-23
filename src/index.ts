import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import bodyParser from "body-parser";

const app: Express = express();
const port = process.env.PORT || 4000;

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

// Get Enviroment Variables
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const dialogFlowProjectId = process.env.DIALOG_FLOW_PROJECT_ID;

// INITIALIZATION
const twilioClient = require('twilio')(twilioAccountSid, twilioAuthToken);
const dialogflow = require('dialogflow');
const dialogFlowClient = new dialogflow.SessionsClient();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req: Request, res: Response) => {
    res.send('Express + TypeScript Server');
});

// Twilio Webhook Function
app.use('/twilio_webhook', async (request: Request, response: Response) => {
    // Get WhatsApp Message Information  
    const body = request.body;
    const receivedMsg = body.Body;
    const userNumber = body.From;
    const myNumber = request.body.To;

    if (receivedMsg) {
        // Configure Dialogflow Session
        const sessionPath = dialogFlowClient.sessionPath(dialogFlowProjectId, userNumber);
        const request = {
            session: sessionPath,
            queryInput: {
                text: {
                    text: receivedMsg,
                    languageCode: "pt-BR",
                },
            },
        };

        // Get Dialogflow Response
        try {
            const fulfillmentMessages = (await dialogFlowClient.detectIntent(request))[0].queryResult.fulfillmentMessages;

            // Iterate over every message
            for (const response of fulfillmentMessages) {
                // Send Text Message
                if (response.text) {
                    const responseMsg = response.text.text[0];
                    const body = {
                        from: myNumber,
                        body: responseMsg,
                        to: userNumber
                    }
                    await twilioClient.messages.create(body)
                }

                // Send media files
                if (response.payload) {
                    if (response.payload.fields.mediaUrl) {
                        const mediaUrl = response.payload.fields.mediaUrl.stringValue;

                        let text = "";

                        if (response.payload.fields.text) {
                            text = response.payload.fields.text.stringValue
                        }

                        const body = {
                            from: myNumber,
                            body: text,
                            to: userNumber,
                            mediaUrl,
                        }
                        await twilioClient.messages.create(body)
                    }
                }
            }
        }
        catch (e) {
            console.log(e)
        }
    }
    response.status(200).send("Sent!");
})

// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues

const { WebhookClient } = require('dialogflow-fulfillment');
const { Card, Suggestion } = require('dialogflow-fulfillment');



// Fullfilment DialogFlow Webhook Function
app.use('/dialogflow_webhook', async (request: Request, response: Response) => {
    const agent = new WebhookClient({ request, response });
    console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
    console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

    function welcome(agent: any) {
        agent.add(`Welcome to my agent!`);
    }

    function fallback(agent: any) {
        agent.add(`I didn't understand`);
        agent.add(`I'm sorry, can you try again?`);
    }

    // // Uncomment and edit to make your own intent handler
    // // uncomment `intentMap.set('your intent name here', yourFunctionHandler);`
    // // below to get this function to be run when a Dialogflow intent is matched
    function yourFunctionHandler(agent: any) {
        agent.add(`This message is from Dialogflow's Cloud Functions for Firebase editor!`);
        agent.add(new Card({
            title: `Title: this is a card title`,
            imageUrl: 'https://pt.wikipedia.org/wiki/Google_Imagens#/media/Ficheiro:Google_Images_2015_logo.svg',
            text: `This is the body text of a card.  You can even use line\n  breaks and emoji! 💁`,
            buttonText: 'This is a button',
            buttonUrl: 'https://assistant.google.com/'
        })
        );

        agent.add(new Suggestion(`Quick Reply`));
        agent.add(new Suggestion(`Suggestion`));
        agent.setContext({ name: 'weather', lifespan: 2, parameters: { city: 'Rome' } });
    }

    // // Uncomment and edit to make your own Google Assistant intent handler
    // // uncomment `intentMap.set('your intent name here', googleAssistantHandler);`
    // // below to get this function to be run when a Dialogflow intent is matched
    // function googleAssistantHandler(agent) {
    //   let conv = agent.conv(); // Get Actions on Google library conv instance
    //   conv.ask('Hello from the Actions on Google client library!') // Use Actions on Google library
    //   agent.add(conv); // Add Actions on Google library responses to your agent's response
    // }
    // // See https://github.com/dialogflow/fulfillment-actions-library-nodejs
    // // for a complete Dialogflow fulfillment library Actions on Google client library v2 integration sample

    // Run the proper function handler based on the matched Dialogflow intent name
    let intentMap = new Map();
    intentMap.set('Default Welcome Intent', welcome);
    intentMap.set('Default Fallback Intent', fallback);
    intentMap.set('Fulfillment', yourFunctionHandler);
    // intentMap.set('your intent name here', googleAssistantHandler);
    agent.handleRequest(intentMap);
});


app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});