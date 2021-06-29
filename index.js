const reddit = require("redddit");
const got = require("got");
const cheerio = require("cheerio");
const linkify = require('linkifyjs');
const url = require("url");
const fs = require("fs");

checkAndSave();

function checkAndSave() {
    reddit.getURL("/search", "?q=pastebin.com&sort=new", function(err, resp) {
        if (err) {console.log(err);}
        else {
            for (var c in resp) {
                var b = getPastebin(resp[c].data.selftext);
                archiveAll(b, resp[c].data.url);
            }
        }
    })
}

function getPastebin(text) {
    var a = [];
    for (var c in linkify.find(text)) {
        if (linkify.find(text)[c].type !== "url") {continue;}
        var host = url.parse(linkify.find(text)[c].href).hostname;
        if (host !== "pastebin.com") {continue;}
        if (linkify.find(text)[c].href.includes("](")) {var u = linkify.find(text)[c].href.split("](")[0];} else {var u = linkify.find(text)[c].href;}
        if (u == "https://pastebin.com") {continue;}
        a.push(u);
    }
    return a;
}

function archiveAll(array, src) {
    for (var c in array) {
        if (fs.existsSync(__dirname + "/archived.json")) {
            var j = JSON.parse(fs.readFileSync(__dirname + "/archived.json"));
            if (isAlreadyThere(j, array[c])) {continue;}
        }

        if (fs.existsSync(__dirname + "/permalinks.json")) {
            var j = JSON.parse(fs.readFileSync(__dirname + "/permalinks.json"));
            if (isAlreadyThere(j, array[c])) {continue;}
        }

        if (array[c] == "https://pastebin.com") {continue;}
        // dumb scraper smh

        archive(array[c], src, function(err, resp) {
            if (err && !err.message.includes("429")) {
                console.log("[!] there was an error archiving " + array[c], err);
            } else {
                if (resp.success == true) {
                    if (!fs.existsSync(__dirname + "/archived.json")) {var a = [];} else {var a = JSON.parse(fs.readFileSync(__dirname + "/archived.json"));}
                    if (!fs.existsSync(__dirname + "/permalinks.json")) {var p = [];} else {var p = JSON.parse(fs.readFileSync(__dirname + "/permalinks.json"));}
                    a.push(array[c]);
                    fs.writeFileSync(__dirname + "/archived.json", JSON.stringify(a));
                    if (!isAlreadyThere(p, src)) {
                        p.push(src);
                        fs.writeFileSync(__dirname + "/permalinks.json", JSON.stringify(p));
                    }

                    console.log("[i] successfully archived " + array[c]);
                } else {
                    console.log("[!] there was an error archiving " + array[c], JSON.parse(resp.resp));
                }
            }
        });
    }
    // auto restart in 5 minutes
    setTimeout(function() {checkAndSave();}, 300000);
}

function isAlreadyThere(haystack, needle) {
    for (var c in haystack) {
        if (haystack[c] !== needle) {continue;} else {return true;}
    }
    return false;
}

function archive(url, red, cb) {
    var b = "url=" + encodeURIComponent(url) + "&capture_all=on";
    var s = encodeURI(b).split(/%..|./).length - 1;
    got.post("https://web.archive.org/save/" + url, {
        body: b,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US",
            "Accept-Encoding": "gzip, deflate, br",
            "Referer": "https://web.archive.org/save",
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": s,
            "Origin": "https://web.archive.org",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-User": "?1",
            "Sec-GPC": "1",
            "TE": "trailers"
        }
    }).then(function(resp) {
        var watchId = resp.body.split('spn.watchJob("')[1].split('",')[0];
        var b = setInterval(function() {
            got("https://web.archive.org/save/status/" + watchId + "?_t=" + (new Date()).toString()).then(function(resp) {
                var j = JSON.parse(resp.body);
                if (j.status == "success") {
                    cb(null, {
                        "backed": "https://web.archive.org/web/" + url,
                        "permalink": red,
                        "success": true
                    })
                    clearInterval(b);
                } else if (j.status !== "pending") {
                    cb(null, {
                        "backed": null,
                        "permalink": red,
                        "success": false,
                        "resp": JSON.stringify(j)
                    })
                    clearInterval(b);
                }
            })
        }, 6000);
    }).catch(function(err) {
        cb(err, null);
    })
}