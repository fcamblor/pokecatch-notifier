"use strict";

let restify = require('restify');
let _ = require('lodash');
let Store = require('./store');
let Slack = require('./slack');
let Pokedex = require('./pokedex');

let requiredEnvKeysFilled = true;
_.each(['SLK_HOOK_URL', 'MNG_URL'], function (requiredEnvKey) {
    if (!process.env[requiredEnvKey]) {
        console.error("Missing mandatory environment key : %s", requiredEnvKey);
        requiredEnvKeysFilled = false;
    }
});
if (!requiredEnvKeysFilled) {
    process.exit();
}

let slack = new Slack({
    hook_url: process.env.SLK_HOOK_URL,
    username: process.env.SLK_USERNAME || "Pokemon catcher"
});
let store = new Store({
    mongo_url: process.env.MNG_URL
});
let pokedex = new Pokedex();

let server = restify.createServer({
    name: 'pokecatch-slack-notifier',
    version: '1.0.0'
});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser({ mapParams: false }));

let httpErrorHandlerFactory = ({res, next}) => (error) => {
    console.error(error);
    res.send(500, error);
    next();
};
let httpSuccessHandlerFactory = ({ res, next, returnedContent = (arg1) => arg1, httpCode = 200 }) => {
    return function() { // Using function here since arrow function doesn't have one !
        let content = returnedContent.apply(null, arguments);
        res.send(httpCode, content);
        next();
    };
};

server.get('/area', (req, res, next) => 
    store.listArea().then(httpSuccessHandlerFactory({ res, next }), httpErrorHandlerFactory({ res, next })) 
);
server.post('/area',  (req, res, next) => 
    store.createArea(req.body).then(httpSuccessHandlerFactory({ res, next, httpCode: 201, returnedContent: (id) => { return { id }; } }), httpErrorHandlerFactory({ res, next }))
);
server.del('/area/:id', (req, res, next) =>
    store.deleteAreaById(req.params.id).then(httpSuccessHandlerFactory({ res, next }), httpErrorHandlerFactory({ res, next })) 
);

pokedex.init().then(() => {
    server.listen(parseInt(process.env.PORT, 10) || 8080, function () {
        console.log('%s listening at %s', server.name, server.url);
    });
});
