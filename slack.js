"use strict";

var rp = require('request-promise');

class Slack {
    constructor({ hook_url, username }) {
        this.hook_url = hook_url;
        this.username = username;
    }
    
    sendMessage({ message, channel, icon_url }) {
        return rp({
            uri: this.hook_url,
            method: 'POST',
            body: {
                "channel": channel,
                "username": this.username,
                "text": message,
                "icon_url": icon_url
            },
            json: true
        });
    }
}

module.exports = Slack;
