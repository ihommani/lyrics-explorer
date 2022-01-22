const { returnLyricsUrl } = require('./lyrics_fetcher')

const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const myBucket = storage.bucket('ihommani-html-bucket');

const axios = require('axios');


exports.getLyricsHTML = async (req, res) => {
    // request must contain: album name, year, artist name
    // TODO: expose the model {artist, genre, reelase_date, album_name, track} as a class with service to lazy load its url
    let url = await returnLyricsUrl(["Diam's", "la boulette"]).catch(err => console.log(err))

    if (!url)
        res.send(`Nothing found`)

    // TODO: create this array through queue message payload consumption
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