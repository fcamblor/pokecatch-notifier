"use strict";

let assert = require('assert');
let firebase = require('firebase');
let _ = require('lodash');
let moment = require('moment');

class FirebaseStore {
    constructor({ serviceAccount, databaseUrl, pokedex }){
        this.serviceAccount = serviceAccount;
        this.databaseUrl = databaseUrl;
        this.pokedex = pokedex;
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
}

module.exports = FirebaseStore;