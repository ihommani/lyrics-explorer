require('dotenv').config()
const SpotifyWebApi = require('spotify-web-api-node');

//https://stackoverflow.com/questions/31413749/node-js-promise-all-and-foreach
//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise
//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises
//https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await

const clientId = process.env.SPOTIFY_APP_CLIENT_ID,
  clientSecret = process.env.SPOTIFY_APP_CLIENT_SECRET

// Create the api object with the credentials
var spotifyApi = new SpotifyWebApi({
  clientId: clientId,
  clientSecret: clientSecret
});

// Retrieve an access token.
spotifyApi.clientCredentialsGrant().then(
  function (data) {
    // Save the access token so that it's used in future calls
    spotifyApi.setAccessToken(data.body['access_token']);
  }
).catch(err => console.log('Something went wrong when retrieving an access token', err))

function getAlbumIds(artistId) {
  return spotifyApi.getArtistAlbums(artistId, { limit: 2, offset: 0 }) // warning point for throtling
    .then(data => data.body)
    .then(body => body.items)
    .then(items => items.map(element => element.id))
    .catch(err => console.log(err))
}

function getTracksFromAlbum(albumId) {
  return spotifyApi.getAlbumTracks(albumId)
};

function getArtistId(artistName) {
  return spotifyApi.searchArtists(artistName)
    .then(resp => resp.body.artists.items[0].id)
}

async function getTracksFromArtist(artistName) {
  let artistId = await getArtistId(artistName)
  let albumIds = await getAlbumIds(artistId)
  let trackPromises = albumIds.map(id => getTracksFromAlbum(id))
  return Promise.all(trackPromises)
}

// main
exports.helloWorld = async (req, res) => {

  const artistOfInterest = req.query.artist || 'Diams'

  let tracks = await getTracksFromArtist(artistOfInterest)
    .then(resp => resp
      .map(e => e.body)
      .reduce((acc, x) => acc.concat(x.items), []) //Should work with a flatMap starting node11
      .map(e => e.name))
    .catch(err => console.log(err))

  res.send(tracks);
};