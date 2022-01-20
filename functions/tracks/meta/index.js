
'use strict'
const {generatePayloads} = require('./meta_fetcher');
const {PubSub} = require('@google-cloud/pubsub');

const pubSubClient = new PubSub();
const topic = pubSubClient.topic('opinion')


// main to get {artist, album ,track} meta
exports.getSongsMetadata = async (req, res) => {
    const artistOfInterest = req.query.artist || 'Diams' // TODO: reject with error on missing artist
    
    for await (let payloads of generatePayloads(artistOfInterest)) {
          Promise.all(payloads.map(payload => topic.publishMessage({json: payload})))
    }
    res.send('hello')
}