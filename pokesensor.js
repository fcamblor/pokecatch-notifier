"use strict";

let rp = require('request-promise');

class PokeSensor {
    constructor() {
    }

    findPokemonsAround({ lat, long }) {
        return new Promise((resolve, reject) => {
            this._retrieveJobIdFor({ lat, long })
                .then((jobId) => this._retrieveMapData({ lat, long, jobId }), reject)
                .then((pokemons) => resolve(pokemons), reject)
                .catch(reject);
        });
    }

    _retrieveJobIdFor({ lat, long }) {
        return new Promise((resolve, reject) => {
            rp({
                uri: "https://pokevision.com/map/scan/"+lat+"/"+long,
                json: true,
                headers: {
                    'referer': 'https://pokevision.com/'
                }
            })
                .then((scanResult) => {
                    if (scanResult.status === 'success') {
                        resolve(scanResult.jobId);
                    } else if(scanResult.message === '{scan-throttle}') {
                        console.info("JobId scan throttling detected... delaying...");
                        setTimeout(() => this._retrieveJobIdFor({ lat, long }).then(resolve, reject), 5000);
                    } else {
                        return Promise.reject("Error during job id retrieval : "+scanResult.message);
                    }
                }, reject)
                .catch(reject);
        });
    }

    _retrieveMapData({ lat, long, jobId}) {
        return new Promise((resolve, reject) => {
            let startTimestamp = Date.now();
            rp({
                uri: "https://pokevision.com/map/data/"+lat+"/"+long+"/"+jobId,
                json: true,
                headers: {
                    'referer': 'https://pokevision.com/'
                }
            })
                .then((mapResult) => {
                    if(mapResult.jobStatus == 'failure' || mapResult.jobStatus == 'unknown') { // Error happened
                        return Promise.reject("Map data error / timeout");
                    } else if(mapResult.jobStatus == 'in_progress') { // Sensor job still in progress
                        setTimeout(() => this._retrieveMapData({ lat, long, jobId }).then(resolve, reject), 5000 - Date.now() + startTimestamp);
                    } else { // Sensor job successful
                        resolve(mapResult.pokemon);
                    }
                }, reject)
                .catch(reject);
        });
    }
}

module.exports = PokeSensor;