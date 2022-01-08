require('dotenv').config()

const SpotifyWebApi = require('spotify-web-api-node');
const {PubSub} = require('@google-cloud/pubsub');
const axios = require('axios');
const jq = require('node-jq')

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
  const artistOfInterest = req.query.artist || 'Diams' // TODO: reject with error on missing artist
  
  for await (let payloads of generatePayloads(artistOfInterest)) {
        Promise.all(payloads.map(payload => topic.publishMessage({json: payload})))
    }
  res.send('hello')
};

exports.getLyricsHTML = async (req, res) => {
  // request must contain: album name, year, artist name, 
  let {data} = await geniusApi.get('/search', {params: {q : 'Kendrick'}})
  if (data.response.hits.length === 0) return null;
  let htmlUrl = data.response.hits[0].result.url
  // TODO: call the content and push it to GCS
  res.send(`<a href=${htmlUrl}>htmlUrl</a>`)
}

async function* generatePayloads(artistOfInterest) {
  const trackNameFilter = '.[] |= {"name": .name}'
  let pubSubMessagePayload

  for await (let albumContainer of generateAlbumContainers(artistOfInterest)){
    let albumSongs = await albumContainer.tracks
    let tracks = await jq.run(trackNameFilter, albumSongs.body.items, { input: 'json', output: 'json' })

    pubSubMessagePayload = tracks.map((track) => ({ 'artist': albumContainer.artist.name, 'genre': albumContainer.artist.genres,
                                                       'release_date': albumContainer.album.release_date, 'album_name': albumContainer.album.name,
                                                       'track': track.name }))
    yield pubSubMessagePayload
  }
}

async function* generateAlbumContainers(artistName) {
  let artist = await getArtistInformation(artistName)
  let albums = await getAlbumInformations(artist.id)

  for(album of albums) {
    yield ({'artist': artist, 'album': album, 'tracks': getTracksFromAlbum(album.id) })
  }
}

async function getArtistInformation(artistName) {
  //https://developer.spotify.com/documentation/web-api/reference/#/operations/get-an-artist
  const artistMetaFilter = '. | {name: .name, id:.id, genres: .genres}'

  let artist = await spotifyApi.searchArtists(artistName).then(resp => resp.body.artists.items[0])
  return jq.run(artistMetaFilter, artist, { input: 'json', output: 'json' })
}

async function getAlbumInformations(artistId) {
  // https://developer.spotify.com/documentation/web-api/reference/#/operations/get-an-album
  // oddly enough we cannot get tracks within the reponse body as explicited in the documentation model
  const albumMetaFilter = '.[] |= {id: .id, release_date:.release_date, name:.name}'

  let albums = await spotifyApi.getArtistAlbums(artistId) // warning point for throtling
                              .then(data => data.body)
                              .then(body => body.items)
                              .catch(err => console.log(err))

  return jq.run(albumMetaFilter, albums, { input: 'json', output: 'json' })
}

function getTracksFromAlbum(albumId) {
  // https://developer.spotify.com/documentation/web-api/reference/#/operations/get-an-albums-tracks
  return spotifyApi.getAlbumTracks(albumId)
                  .catch(err => console.log(err))
}