const functions = require('firebase-functions');


const options = {
    method: 'GET',
    url: 'https://microsoft-azure-bing-news-search-v1.p.rapidapi.com/search',
    qs: {},
    headers: {
        'x-rapidapi-host': 'microsoft-azure-bing-news-search-v1.p.rapidapi.com',
        'x-rapidapi-key': 'a11bfb6819mshd1b648e8e6c2ba5p12ba62jsnc05fbb10d711'
    }
};


exports.getNewsEachDay = functions.pubsub.schedule('00 9 * * *')
    .timeZone('Europe/Berlin')
    .onRun(async (context) => {
        const admin = require("firebase-admin");
        admin.initializeApp();
        var request = require("request");

        const db = admin.firestore();
        let company_info = [];

        await db.collection("company_info").get().then(function (querySnapshot) {
            querySnapshot.forEach(function (doc) {
                if ('name' in doc._fieldsProto) {
                    company_info.push({
                        name: doc._fieldsProto.name.stringValue,
                        isin: doc._fieldsProto.isin.stringValue
                    })
                }
            });
        });
        company_info.forEach(async company => {
            var doc_ref = db.collection('news').doc(company['isin']);
            options.qs = {count: '20', mkt: 'de-DE', q: company.name};
            await request(options, function (error, response, body) {
                if (error) throw new Error(error);
                doc_ref.update(JSON.parse(body))
            });
        })

    });
