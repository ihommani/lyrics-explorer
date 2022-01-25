const { returnLyricsUrl } = require('./lyrics_fetcher')

const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const myBucket = storage.bucket('ihommani-html-bucket');

const axios = require('axios');

// We get the trigger from a cloud task: define the model of the message in a class
exports.getLyricsHTML = async (req, res) => {
    // request must contain: album name, year, artist name
    // TODO: expose the model {artist, genre, reelase_date, album_name, track} as a class with service to lazy load its url
    

    let {artist, genre, release_date, album_name, track} = req.body
    let url = await returnLyricsUrl([artist, track]).catch(err => console.log(err))

    if (!url)
        res.send(`Nothing found`)

    // TODO: create this array through queue message payload consumption
    let path = ['rap', artist, release_date, album_name, track].reduce((previousValue, currentValue) => previousValue.concat('/', currentValue))

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