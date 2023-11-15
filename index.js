const express = require('express');
const app = express();
app.listen(3000, () => console.log('APİ HAZIR KULLANILABİLİR DURUMDA'));
app.set('trust proxy', true);
const { JsonDatabase } = require('wio.db');
const db = new JsonDatabase({ databasePath: './database.json' });
const axios = require('axios');
const { HttpProxyAgent } = require('http-proxy-agent');
const punycode = require('punycode');
const randomUseragent = require('random-useragent');

async function keyrequire(req, res, next) {
    const key = 'aptim';
    var givenkey = req.headers['X-Uptimer-Key'] || req.query.key;
    if (givenkey != key) return res.json({ error: 'Unauthorized' });
    next();
}

app.get('/register/url/:userid', keyrequire, async (req, res, next) => {
    var url = req.headers['X-Uptimer-Url'] || req.query.url;
    if (!url) return res.json({ error: 'Missing argument' });
    url = formaturl(url);
    if (db.get('urls') && db.get('urls').length && db.get('urls').find(x => x.url == url))
        return res.json({ error: 'URL already registered in database' });
    const userid = req.params.userid;
    db.push('urls', { url: url, userid: userid, });
    res.json({ url: url, userid: userid });
});

app.get('/delete/url', keyrequire, async (req, res, next) => {
    var url = req.headers['X-Uptimer-Url'] || req.query.url;
    if (!url) return res.json({ error: 'Missing argument' });
    url = formaturl(url);
    if (db.get('urls') && db.get('urls').length && db.get('urls').find(x => x.url == url)) {
        const userid = db.get('urls').find(x => x.url == url).userid;
        db.set('urls', db.get('urls').filter(x => x.url != url));
        return res.json({ url: url, userid: userid })
    } else return res.json({ error: 'Cannot find this URL in database' });
});

app.get('/urls/user/:userid', keyrequire, async (req, res, next) => {
    const urls = db.get('urls');
    if (urls && urls.length && urls.find(x => x.userid == req.params.userid)) {
        res.json({ urls: urls.filter(x => x.userid == req.params.userid) });
    } else return res.json({ error: 'Cannot find data for this user' });
});

app.get('/urls/all', keyrequire, async (req, res, next) => {
    const urls = db.get('urls');
    if (urls && urls.length) {
        res.json({ urls: urls });
    } else return res.json({ error: 'Cannot find any URL in database' });
});

setInterval(() => {
    if (db.get('urls') && db.get('urls').length) {
        var urls = db.get('urls').map(x => x.url);
        urls.forEach(url => {
            var { proxies } = require('./proxies.json');
            var proxy = proxies[Math.floor(Math.random() * proxies.length)];
            fetch(`https://${url}/`, {
                agent: new HttpProxyAgent(`http://${proxy.host}:${proxy.port}`),
            }).then(async (res) => {
                console.log(`Success ${proxy.country}: https://${url}/ Code: ${res.status}`);
                console.log(res);
            }).catch(async (err) => {
                fetch(`https://${url}/`).then(async (res2) => {
                    console.log(`Success --: https://${url}/ Code: ${res2.status} Proxy Error: ${err.code}`);
                }).catch(async (err2) => {
                    console.error(`Cannot fetch this URL: https://${url}/ Error: ${err2.status}`);
                });
            });
        });
    }
}, 2 * 60 * 1000);

if (db.get('urls') && db.get('urls').length) {
    var urls = db.get('urls').map(x => x.url);
    urls.forEach(url => {
        var { proxies } = require('./proxies.json');
        var proxy = proxies[Math.floor(Math.random() * proxies.length)];
        fetch(`https://${url}/`, {
            agent: new HttpProxyAgent(`http://${proxy.host}:${proxy.port}`),
            headers: {
                'user-agent': randomUseragent.getRandom()
            }
        }).then(async (res) => {
            console.log(`Success ${proxy.country}: https://${url}/ Code: ${res.status}`);
            console.log(res);
        }).catch(async (err) => {
            fetch(`https://${url}/`, {
                headers: {
                    'user-agent': randomUseragent.getRandom()
                }
            }).then(async (res2) => {
                console.log(`Success --: https://${url}/ Code: ${res2.status} Proxy Error: ${err.code}`);
            }).catch(async (err2) => {
                console.error(`Cannot fetch this URL: https://${url}/ Error: ${err2.status}`);
            });
        });
    });
}

function formaturl(str) {
    var utf8decoded = decodeURIComponent(str);
    const re = new RegExp(
        '^((http[s]?|ftp):\/\/)?\/?([^\/\.]+\.)*?([^\/\.]+\.[^:\/\s\.]{2,3}(\.[^:\/\s\.]{2,3})?)(:\d+)?($|\/)([^#?\s]+)?(.*?)?(#[\w\-]+)?$'
    );
    utf8decoded.includes('://') ? utf8decoded = utf8decoded.split('://')[1] : utf8decoded = utf8decoded;
    var ascii = punycode.toASCII(utf8decoded);
    ascii.endsWith('/') ? ascii = ascii.slice(0, ascii.length - 1) : ascii = ascii;
    return ascii;
}