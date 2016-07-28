"use strict";

let rp = require('request-promise');
let moment = require('moment');
let PokeSensor = require('./pokesensor');

class PokeRadar {
    constructor({ store }) {
        this.store = store;
        this.pokesensor = new PokeSensor();
    }

    startRadarForArea({ areaId, duration = 10 * 60 * 1000, skipAreaScanCreation = false }) {
        return new Promise((resolve, reject) => {
            let scanUntil = Date.now() + duration;
            let context = {
                area: null,
                areaScanId: null
            };

            let rollbackAndReject = (error) => {
                if (context.areaScanId) {
                    this.store.deleteAreaScan(context.areaScanId);
                }
                reject(error);
            };

            this.store.findAreaById({areaId})
                .then((area) => {
                    context.area = area;

                    return skipAreaScanCreation?Promise.resolve(null):this.store.createAreaScan({areaId, scanUntil});
                }, rollbackAndReject)
                .then((areaScanId) => {
                    context.areaScanId = areaScanId;

                    this._handleFindNearbyPokemonsForAreaLocation({area: context.area, locationIdx: 0, autoScanNextLocations: true});

                    resolve();
                }, rollbackAndReject)
                .catch(rollbackAndReject);
        });
    }
    
    resumeRadarScans() {
        return new Promise((resolve, reject) => {
            this.store.purgeOutdatedAreaScans()
                .then(() => this.store.listAreaScans(), reject)
                .then((areaScans) => Promise.all(
                    areaScans.map( (areaScan) => this.startRadarForArea({ areaId: areaScan.areaId, duration: areaScan.until - Date.now(), skipAreaScanCreation: true }) )
                ), reject)
                .then(resolve, reject)
                .catch(reject);
        });
    }
    
    _handleFindNearbyPokemonsForAreaLocation({ area, locationIdx, autoScanNextLocations }) {
        return new Promise((resolve, reject) => {
            // First, we should ensure a valid area scan is still present in db
            this.store.findAreaScanByAreaId({ areaId: area._id.toString() })
                .then((areaScan) => {
                    if(moment(areaScan.until).isBefore()) {
                        this.store.deleteAreaScan({ areaScanId: areaScan._id.toString() });
                        console.info("Outdated area scan => Stopping scan !");
                        return Promise.reject("Outdated area scan !");
                    }

                    // If area scan is valid, trying to find pokemons around here
                    return this.pokesensor.findPokemonsAround({ lat: area.locations[locationIdx], long: area.locations[locationIdx+1] });
                }, reject)
                .then((pokemons) => {
                    // TODO: We may imagine to store pokemon results into firebase here someday...

                    resolve(pokemons);

                    if(autoScanNextLocations) {
                        let loopDelay = 0;
                        if(locationIdx+2 === area.locations.length) {
                            // Once we looped over every possible locations, delaying new loop
                            // during 60s...
                            loopDelay += 60000;
                        }
                        setTimeout(() => this._handleFindNearbyPokemonsForAreaLocation({ area, locationIdx: (locationIdx+2)%area.locations.length, autoScanNextLocations }), loopDelay);
                    }
                }, reject)
                .catch(reject);
        });
    }
}

module.exports = PokeRadar;