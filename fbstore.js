"use strict";

let assert = require('assert');
let firebase = require('firebase');
let _ = require('lodash');
let moment = require('moment');

class FirebaseStore {
    constructor({ serviceAccount, databaseUrl, pokedex, slack, store }){
        this.serviceAccount = serviceAccount;
        this.databaseUrl = databaseUrl;
        this.pokedex = pokedex;
        this.slack = slack;
        this.store = store;

        let withMomentLocale = (lang, callback) => {
            moment.locale(lang);
            let result = callback();
            moment.locale();
            return result;
        };
        this.i18nMessages = {
            fr: (area, pokemon, lang) => withMomentLocale(lang, () => "Un nouveau *"+this.pokedex.pokemonName(pokemon.pid, lang)+"* est disponible dans la zone *"+area.name+"* et tu ne le possède pas encore. Attrape-le vite ou il disparaîtra à *"+moment(pokemon.exp*1000).format("HH:mm")+" ("+moment(pokemon.exp*1000).fromNow()+")* !"),
            en: (area, pokemon, lang) => withMomentLocale(lang, () => "A new *"+this.pokedex.pokemonName(pokemon.pid, lang)+"* is available in *"+area.name+"* area and you don't own it yet. Catch it quickly, or it will disappear at *"+moment(pokemon.exp*1000).format("HH:mm")+"("+moment(pokemon.exp*1000).locale(lang).fromNow()+")* !")
        };
    }

    init(){
        return new Promise((resolve, reject) => {
            console.info("[startup] Initializing firebase ...");
            this.fb = firebase.initializeApp({ 
                serviceAccount: this.serviceAccount,
                databaseURL: this.databaseUrl
            });

            resolve();
        });
    }
    
    storePokemonStats({ pokemons, area }) {
        return new Promise((resolve, reject) => {
            var areaStatsNode = this.fb.database().ref("stats/byArea/"+area.name);
            // Sometimes (for unknown reasons), it happens that we have twice the same pokemon info with
            // an expiration time shifted from 1s
            // The modulo below will allow to round expiration times by 10s and thus will remove these
            // pokemons "twins" in 9 case out of 10.
            // Taking a greater modulo will lower the probability to exceptions for these twins detection, however
            // it will remove precision for expiration time
            var sameExpirationModulo = 10;
            Promise.all(
                _(pokemons).map((pokemon) => {
                    var pokemonKey = _.padLeft(pokemon.pokemonId, 3, "0")+"-"+this.pokedex.pokemonName(pokemon.pokemonId, area.notifications.lang).replace(/[\.$#\[\]\r\n]/gi, "_");
                    var locationKey = (""+pokemon.latitude+"|"+pokemon.longitude).replace(/[\.$#\[\]\r\n]/gi, "_");
                    var expirationDate = new Date((pokemon.expiration_time - pokemon.expiration_time%sameExpirationModulo)*1000);
                    var hourInDay = _.padLeft(expirationDate.getUTCHours(), 2, "0");
                    var day = moment((pokemon.expiration_time - pokemon.expiration_time%sameExpirationModulo)*1000).utc().format("YYYYMMDD");

                    var pushedPokemon = {pid: pokemon.pokemonId, pName: this.pokedex.pokemonName(pokemon.pokemonId, area.notifications.lang), lat: pokemon.latitude, lon: pokemon.longitude, exp: pokemon.expiration_time - pokemon.expiration_time%sameExpirationModulo};
                    var timedKey = (pokemon.expiration_time - pokemon.expiration_time%sameExpirationModulo)+"|"+pokemon.pokemonId;
                    return [
                        areaStatsNode.child("pokemons").child(timedKey).set(pushedPokemon),
                        areaStatsNode.child("byHourInDay/"+hourInDay+"/byDay/"+day).child(timedKey).set(pushedPokemon),
                        areaStatsNode.child("byLocation/"+locationKey+"/byPokemon/"+pokemonKey).child(timedKey).set(pushedPokemon),
                        areaStatsNode.child("byLocation/"+locationKey+"/byExp/"+pokemon.expiration_time).child(timedKey).set(pushedPokemon),
                        areaStatsNode.child("byPokemon/"+pokemonKey+"/byLocation/"+locationKey).child(timedKey).set(pushedPokemon)
                    ];
                }).flatten().value()
            ).then(resolve, reject);
        });
    }

    startAreaNotificationsForMissingPokemons({ areaId, skipAlreadyStarted = false }) {
        return new Promise((resolve, reject) => {
            let context = { 
                firstTime: true,
                area: null
            };
            
            this.store.findAreaById({ areaId })
                .then((area) => {
                    context.area = area;
                    
                    return this.store.findAreaScanByAreaId({areaId});
                }, reject)
                .then((areaScan) => {

                    if (areaScan.notificationsStarted && !skipAlreadyStarted) {
                        return Promise.reject("Area notifications already started for area " + areaId);
                    }

                    return this.store.updateAreaScan({
                        areaScanId: areaScan._id.toString(), updatedFields: {
                            notificationsStarted: true
                        }
                    });
                }, reject)
                .then(() => {
                    
                    this.fb.database().ref("stats/byArea/"+context.area.name+"/pokemons/").on('child_added', (pokemonSnapshot) => {
                        if(context.firstTime) {
                            // Do nothing
                        } else {
                            let pokemon = pokemonSnapshot.val();
                            this._notifyUsers({ usernames: context.area.notifications.usernames, pokemon, area: context.area });
                        }
                    });

                    // First time we call the on('child_added'), callback is instantly called with initialization node
                    setTimeout(function(){
                        context.firstTime = !context.firstTime;
                        resolve();
                    }, 1000);

                }, reject)
                .catch(reject);
        });
    }

    _notifyUsers({ usernames, pokemon, area }) {
        return new Promise((resolve, reject) => {
            this.store.findUsersByNames({ usernames })
                .then((users) => {
                    return Promise.all(
                        users.filter((user) => {
                            return ((user.notifications.pokemonWhiteList && user.notifications.pokemonWhiteList.indexOf(pokemon.pid)!==-1)
                            || (user.notifications.pokemonBlackList && user.notifications.pokemonBlackList.indexOf(pokemon.pid)===-1));
                        }).map((user) => {
                            console.log("New pokemon not owned yet by "+user.name+" detected : "+pokemon.pName);
                            return this.slack.sendMessage({
                                message: this.i18nMessages[area.notifications.lang](area, pokemon, area.notifications.lang),
                                channel: "@"+user.notifications.slackUsername,
                                icon_url: "http://pokeapi.co/media/sprites/pokemon/"+pokemon.pid+".png"
                            });
                        })
                    ).then(resolve, reject)
                    .catch(reject);
                });
        });
    }

    stopAreaNotificationsForMissingPokemons({ areaId }) {
        return new Promise((resolve, reject) => {
            this.store.findAreaById({areaId})
                .then((area) => {
                    this.fb.database().ref("stats/byArea/" + area.name + "/pokemons/").off('child_added');
                    this.store.findAreaScanByAreaId({ areaId }).then((areaScan) => {
                        this.store.updateAreaScan({ areaScanId: areaScan._id.toString(), updatedFields: {
                            notificationsStarted: false
                        }});
                    });
                    resolve();
                }, reject)
                .catch(reject);
        });
    }
}


module.exports = FirebaseStore;