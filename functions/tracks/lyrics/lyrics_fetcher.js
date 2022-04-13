require('dotenv').config()

const axios = require('axios');

const geniusToken = process.env.GENIUS_TOKEN

const geniusApi = axios.create({
    baseURL: 'https://api.genius.com',
    timeout: 3000,
    headers: { 'Authorization': 'Bearer ' + geniusToken }
});

exports.returnLyricsUrl = async function returnLyricsUrl(searchItems) {
    // TODO: control the input which is an array of string
    const requestParameter = searchItems.reduce((previousValue, currentValue) => previousValue.concat(' ', currentValue))
    let { data } = await geniusApi.get('/search', { params: { q: requestParameter } })
    // We trust the Genius search engine accurracy to return the right result in first position
    return data.response.hits?.[0]?.result.url
}