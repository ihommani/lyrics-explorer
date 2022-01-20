require('dotenv').config()

const jq = require('node-jq')
const SpotifyWebApi = require('spotify-web-api-node');


const clientId = process.env.SPOTIFY_APP_CLIENT_ID,
    clientSecret = process.env.SPOTIFY_APP_CLIENT_SECRET


const spotifyApi = new SpotifyWebApi({
    clientId: clientId,
    clientSecret: clientSecret
});

spotifyApi.clientCredentialsGrant()
    .then((data) => spotifyApi.setAccessToken(data.body['access_token']))
    .catch(err => console.log('Something went wrong when retrieving an access token', err))

exports.generatePayloads = async function* generatePayloads(artistOfInterest) {
    const trackNameFilter = '.[] |= {"name": .name}'
    let messagePayload

    for await (let albumContainer of generateAlbumContainers(artistOfInterest)) {
        let albumSongs = await albumContainer.tracks
        let tracks = await jq.run(trackNameFilter, albumSongs.body.items, { input: 'json', output: 'json' })

        messagePayload = tracks.map((track) => ({
            'artist': albumContainer.artist.name, 'genre': albumContainer.artist.genres,
            'release_date': albumContainer.album.release_date, 'album_name': albumContainer.album.name,
            'track': track.name
        }))
        console.log(messagePayload)
        yield messagePayload
    }
}

async function* generateAlbumContainers(artistName) {
    let artist = await getArtistInformation(artistName)
    let albums = await getAlbumInformations(artist.id)

    for (album of albums) {
        yield ({ 'artist': artist, 'album': album, 'tracks': getTracksFromAlbum(album.id) })
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