"use strict";

let MongoClient = require('mongodb').MongoClient;
let ObjectID = require('mongodb').ObjectID;
let assert = require('assert');
let _ = require('lodash');

class Store {
    constructor({ mongo_url }) {
        this.mongo_url = mongo_url;
    }

    createArea({
        name,
        locations,
        notifications: {
            lang = "fr", // either "en" or "fr"
            slackChannel = "#missing-pokemons-in-"+name,
            pokemonWhiteList, // Array of pokemon ids you're looking for
            pokemonBlackList // Array of pokemon ids you want to ignore notifications from
        }
    }) {
        return new Promise((resolve, reject) => {
            if(pokemonWhiteList && pokemonBlackList) {
                reject("You can only put either notifications.pokemonWhiteList *or* notifications.pokemonBlackList entries when defining an area !");
                return;
            }

            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                db.collection('area').count({ name: name }).then((count) => {
                    if(count) { return Promise.reject("Area already exists with name : "+name); }

                    return db.collection('area').insertOne({
                        lang,
                        name,
                        locations,
                        notifications: {
                            slackChannel,
                            pokemonWhiteList,
                            pokemonBlackList
                        }
                    });
                }, rejectAndCloseDb).then(({ insertedId }) => {

                    resolve(insertedId).toString();
                    db.close();
                }, rejectAndCloseDb).catch(rejectAndCloseDb);
            }, reject);
        });
    }

    updateArea(areaId, {
        lang = "fr", // either "en" or "fr"
        name,
        locations,
        notifications: {
            slackChannel = "#missing-pokemons-in-"+name,
            pokemonWhiteList, // Array of pokemon ids you're looking for
            pokemonBlackList // Array of pokemon ids you want to ignore notifications from
        }
    }) {
        return new Promise((resolve, reject) => {
            if(pokemonWhiteList && pokemonBlackList) {
                reject("You can only put either notifications.pokemonWhiteList *or* notifications.pokemonBlackList entries when defining an area !");
                return;
            }

            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                db.collection('area').count({ _id: new ObjectID(areaId) }).then((count) => {
                    if(count === 0) { return Promise.reject("No area found for id : "+areaId); }

                    return db.collection('area').updateOne({ _id: new ObjectID(areaId) }, { $set: {
                        lang,
                        name,
                        locations,
                        notifications: {
                            slackChannel,
                            pokemonWhiteList,
                            pokemonBlackList
                        }
                    } });
                }, rejectAndCloseDb).then(({ insertedId }) => {

                    resolve();
                    db.close();
                }, rejectAndCloseDb).catch(rejectAndCloseDb);
            }, reject);
        });
    }

    listArea() {
        return new Promise((resolve, reject) => {
            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                db.collection('area').find().toArray().then((area) => {

                    resolve(_(area).map((areaItem) => _.omit(areaItem, "_id")).value());
                    db.close();
                }, rejectAndCloseDb).catch(rejectAndCloseDb);
            }, reject);
        });
    }

    findAreaById({ areaId }) {
        return new Promise((resolve, reject) => {
            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                db.collection('area').find({ _id: new ObjectID(areaId) }).limit(1).next((err, areaItem) => {
                    if(err) { rejectAndCloseDb(err); return; }

                    resolve(areaItem);
                    db.close();
                });
            }, reject);
        });
    }

    deleteAreaById(areaId) {
        return new Promise((resolve, reject) => {
            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                db.collection('area').count({ _id: new ObjectID(areaId) }).then((count) => {
                    if(!count) { return Promise.reject("No area found for id "+areaId); }

                    return db.collection('area').deleteOne({ _id: new ObjectID(areaId) });
                }, rejectAndCloseDb).then(() => {

                    resolve();
                    db.close();
                }, rejectAndCloseDb).catch(rejectAndCloseDb);
            }, reject);
        });
    }

    _inMongoConnectionDo(executionCallback, reject){
        if(!executionCallback) { throw new Error("Missing execution callback in _inMongoConnectionDo() call !"); }
        if(!reject) { throw new Error("Missing outer rejection promise in _inMongoConnectionDo() call !"); }

        MongoClient.connect(this.mongo_url, (err, db) => {
            if(err) { reject(err); return; }

            executionCallback(db, function(){ reject.apply(null, arguments); db.close(); });
        });
    }

}

module.exports = Store;