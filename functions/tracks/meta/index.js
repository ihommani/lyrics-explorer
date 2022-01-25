
'use strict'
const { generatePayloads } = require('./meta_fetcher');
const { createHttpTaskWithToken } = require('./create_task');
const { PubSub } = require('@google-cloud/pubsub');

const pubSubClient = new PubSub();
const topic = pubSubClient.topic('opinion')


// main to get {artist, album ,track} meta
exports.getSongsMetadata = async (req, res) => {
    const artistOfInterest = req.query.artist || 'Diams' // TODO: reject with error on missing artist
    for await (let payloads of generatePayloads(artistOfInterest)) {
        // TODO: in fact we need to generate message to a cloud task not a pubsub topic
        // Create class that represent the message payload with method to format and send it (through a dedicated serice)

        // await Promise.all(payloads.map(payload => topic.publishMessage({ json: payload })))
        await Promise.all(payloads.map(payload => createHttpTaskWithToken(
            'sandbox-ihommani', // Your GCP Project id
            'genius-test', // Name of your Queue
            'us-central1', // The GCP region of your queue
            'https://us-central1-sandbox-ihommani.cloudfunctions.net/getLyricsHTML', // The full url path that the request will be sent to
            'sandbox-ihommani@appspot.gserviceaccount.com', // Cloud IAM service account
            payload, // The task HTTP request body
            new Date() // Intended date to schedule task
        )))
    }
    res.send('hello')
}