require('dotenv').config()

const SpotifyWebApi = require('spotify-web-api-node');
const {PubSub} = require('@google-cloud/pubsub');
const axios = require('axios');

const pubSubClient = new PubSub();
const topic = pubSubClient.topic('opinion')

//https://stackoverflow.com/questions/31413749/node-js-promise-all-and-foreach
//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises
//https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await

const clientId = process.env.SPOTIFY_APP_CLIENT_ID,
  clientSecret = process.env.SPOTIFY_APP_CLIENT_SECRET,
  geniusToken = process.env.GENIUS_TOKEN

// Create the api object with the credentials
const spotifyApi = new SpotifyWebApi({
  clientId: clientId,
  clientSecret: clientSecret
});

const geniusApi = axios.create({
  baseURL: 'https://api.genius.com',
  timeout: 3000,
  headers: { 'Authorization': 'Bearer ' + geniusToken}
});

// Retrieve an access token.
spotifyApi.clientCredentialsGrant().then(
  function (data) {
    // Save the access token so that it's used in future calls
    spotifyApi.setAccessToken(data.body['access_token']);
  }
).catch(err => console.log('Something went wrong when retrieving an access token', err))

// main
exports.getSongsMetadata = async (req, res) => {
  const artistOfInterest = req.query.artist || 'Diams'
  let songs = await sendMessages(artistOfInterest)
  await Promise.all(songs.pubsubPromises)
  res.send(songs.songs);
};

exports.getLyricsHTML = async (req, res) => {
  // request must contain: album name, year, artist name, 
  let {data} = await geniusApi.get('/search', {params: {q : 'Kendrick'}})
  if (data.response.hits.length === 0) return null;
  let htmlUrl = data.response.hits[0].result.url
  res.send(`<a href=${htmlUrl}>htmlUrl</a>`)
}

async function sendMessages(artistOfInterest) {

  let songs = await getTracksFromArtist(artistOfInterest)
  .then(resp => resp
    .map(e => e.body)
    .reduce((acc, x) => acc.concat(x.items), []) // Should work with a flatMap starting node11
    .map(e => e.name))
  .catch(err => console.log(err))

  let [genre, artist, date, album, song] =  ['rap', 'diams', '2000-11-06', 'Melanie', 'la boulette']

  var promises = songs
                 .map((track) => ({'song': track, 'artist': artist, 'genre': genre, 'date': date, 'album': album, 'song': song}))
                 .map(jsonObject => topic.publishMessage({json: jsonObject}))

  return {'songs': songs, 'pubsubPromises': promises }
}

async function getTracksFromArtist(artistName) {
  let artistId = await getArtistId(artistName)
  let albumIds = await getAlbumIds(artistId)
  let trackPromises = albumIds.map(id => getTracksFromAlbum(id))
  return Promise.all(trackPromises)
}

function getArtistId(artistName) {
  return spotifyApi.searchArtists(artistName)
    .then(resp => resp.body.artists.items[0].id)
}

function getTracksFromAlbum(albumId) {
  return spotifyApi.getAlbumTracks(albumId)
}

function getAlbumIds(artistId) {
  return spotifyApi.getArtistAlbums(artistId, { limit: 2, offset: 0 }) // warning point for throtling
    .then(data => data.body)
    .then(body => body.items)
    .then(items => items.map(element => element.id))
    .catch(err => console.log(err))
}