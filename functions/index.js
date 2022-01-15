require('dotenv').config()

const SpotifyWebApi = require('spotify-web-api-node');
const {PubSub} = require('@google-cloud/pubsub');
const axios = require('axios');
const jq = require('node-jq')

const pubSubClient = new PubSub();
const topic = pubSubClient.topic('opinion')

const {Storage} = require('@google-cloud/storage');

const storage = new Storage();

const myBucket = storage.bucket('ihommani-html-bucket');

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

// main to get {artist, album ,track} meta
exports.getSongsMetadata = async (req, res) => {
  const artistOfInterest = req.query.artist || 'Diams' // TODO: reject with error on missing artist
  
  for await (let payloads of generatePayloads(artistOfInterest)) {
        Promise.all(payloads.map(payload => topic.publishMessage({json: payload})))
    }
  res.send('hello')
}

// main to get html lyrics
exports.getLyricsHTML = async (req, res) => {
  // request must contain: album name, year, artist name
  // TODO: expose the model {artist, genre, reelase_date, album_name, track} as a class with service to lazy load its url
  let url = await returnLyricsUrl(["Diam's", "la boulette"]).catch(err => console.log(err))
  
  if(!url)
    return
    
  // TODO: create this array through queue message consumption
  let path = ['rap', 'diams', '2006-06-02', 'dans_ma_bulle', 'la_boullette'].reduce((previousValue, currentValue) => previousValue.concat('/', currentValue))
  
  const file = myBucket.file(path + '.html')

  await axios({
    method: 'get',
    url: url,
    responseType: 'stream'
  })
  .then((response) => {
      response.data.pipe(file.createWriteStream()).on('finish', () => {
        console.log('Finished !!'); // TODO: log the path on GCS
      });
    })
  .catch(err => console.log(err))

  res.send(`<a href=${url}>htmlUrl</a>`)
}

async function returnLyricsUrl(searchItems) {
  // TODO: control the input which is an array of string
  const requestParameter = searchItems.reduce((previousValue, currentValue) => previousValue.concat(' ', currentValue))
  let {data} = await geniusApi.get('/search', {params: {q : requestParameter }})
  // We trust the Genius search engine accurracy to return the right result in first position
  return data.response.hits?.[0]?.result.url
}

async function* generatePayloads(artistOfInterest) {
  const trackNameFilter = '.[] |= {"name": .name}'
  let messagePayload

  for await (let albumContainer of generateAlbumContainers(artistOfInterest)){
    let albumSongs = await albumContainer.tracks
    let tracks = await jq.run(trackNameFilter, albumSongs.body.items, { input: 'json', output: 'json' })

    messagePayload = tracks.map((track) => ({ 'artist': albumContainer.artist.name, 'genre': albumContainer.artist.genres,
                                                       'release_date': albumContainer.album.release_date, 'album_name': albumContainer.album.name,
                                                       'track': track.name }))
    console.log(messagePayload)
    yield messagePayload
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