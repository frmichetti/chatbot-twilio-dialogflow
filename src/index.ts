import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import bodyParser from "body-parser";

const app: Express = express();
const port = process.env.PORT || 4000;

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

app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});