var restify = require('restify');
var _ = require('lodash');

var requiredEnvKeysFilled = true;
_.each(['SLK_HOOK_URL', 'MNG_URL'], function (requiredEnvKey) {
    if (!process.env[requiredEnvKey]) {
        console.error("Missing mandatory environment key : %s", requiredEnvKey);
        requiredEnvKeysFilled = false;
    }
});
if (!requiredEnvKeysFilled) {
    process.exit();
}

var server = restify.createServer({
    name: 'pokecatch-slack-notifier',
    version: '1.0.0'
});

console.log("Promise check ...", Promise, Promise.all);

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());
server.listen(parseInt(process.env.PORT, 10) || 8080, function () {
    console.log('%s listening at %s', server.name, server.url);
});
