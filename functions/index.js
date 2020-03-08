const config =  require('./config.json');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const WTD_API_KEY = config.key;

const wtd_base_url = 'https://api.worldtradingdata.com/api/v1/stock';

const WTD_MAPPING_TABLE = ['52_week_high', '52_week_low', 'change_pct', 'close_yesterday', 'day_change',
    'day_high', 'day_low', 'eps', 'gmt_offset', 'market_cap', 'pe', 'price', 'price_open', 'shares', 'volume', 'volume_avg']

const bingNewsOptions = {
    method: 'GET',
    url: 'https://microsoft-azure-bing-news-search-v1.p.rapidapi.com/search',
    qs: {},
    headers: {
        'x-rapidapi-host': 'microsoft-azure-bing-news-search-v1.p.rapidapi.com',
        'x-rapidapi-key': config.bing_key
    }
};


exports.getNewsEachDay = functions.pubsub.schedule('00 9 * * *')
    .timeZone('Europe/Berlin')
    .onRun(async () => {
        var request = require("request");

        const db = admin.firestore();
        let company_info = [];

        await db.collection("company_info").get().then(function (querySnapshot) {
            querySnapshot.forEach(function (doc) {
                if ('name' in doc._fieldsProto) {
                    company_info.push({
                        name: doc._fieldsProto.name.stringValue,
                        isin: doc._fieldsProto.isin.stringValue,
                        symbol: doc._fieldsProto.ticker.stringValue

                    })
                }
            });
        });
        company_info.forEach(async company => {
            var doc_ref = db.collection('company_info').doc(company.symbol);
            bingNewsOptions.qs = {count: '20', mkt: 'de-DE', q: company.name};
            await request(bingNewsOptions, function (error, response, body) {
                if (error) throw new Error(error);
                var news = JSON.parse(body).value
                news.forEach( item => {
                    doc_ref.collection('news').doc().set({isin: company.isin, ...item})
                })
            });
        })
    });

exports.intradayDataUpdates = functions.pubsub.schedule('*/5 9-19 * * 1-5')
    .timeZone('Europe/Berlin')
    .onRun(async () => {
        var request = require("request");

        const db = admin.firestore();
        let company_info = [];

        await db.collection("company_info").get().then(function (querySnapshot) {
            querySnapshot.forEach(function (doc) {
                if ('name' in doc._fieldsProto) {
                    company_info.push(doc._fieldsProto.ticker.stringValue)
                }
            });
        });

        var i, j, temparray, chunk = 5;
        for (i = 0, j = company_info.length; i < j; i += chunk) {
            temparray = company_info.slice(i, i + chunk);
            var request_url = `${wtd_base_url}?symbol=${temparray.join(',')}&api_token=${WTD_API_KEY}`;
            await request({method: 'GET', url: request_url}, function (error, response, body) {
                if (error) throw new Error(error);
                result = JSON.parse(body).data;
                result.forEach(item => {
                    Object.keys(item).map(key =>
                        WTD_MAPPING_TABLE.includes(key) ? item[key] = parseFloat(item[key]) :  undefined );
                    delete Object.assign(item, {['year_high']: item['52_week_high'] })['52_week_high'];
                    delete Object.assign(item, {['year_low']: item['52_week_low'] })['52_week_low'];

                    var doc_ref = db.collection('company_info').doc(item.symbol);
                    doc_ref.collection('realtime').doc().set(item)
                })
            });
        }
    });
