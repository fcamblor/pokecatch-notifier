"use strict";

var rp = require('request-promise');

class Pokedex {
    constructor() {
    }

    init(){
        return new Promise((resolve, reject) => {
            rp({
                uri: "https://gist.githubusercontent.com/fcamblor/be86c342c3a81cafb81c152fbb2ef204/raw/pokemon-names.json",
                method: 'GET',
                json: true
            }).then((pokemonNames) => {
                this.pokemon_names = pokemonNames;
                resolve();
            }, reject).catch(reject);
        });
    }
    
    pokemonName(pokemonId, lang) {
        return this.pokemon_names[pokemonId].names[lang];
    }
}

module.exports = Pokedex;
