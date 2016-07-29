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
            usernames = []
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
                        name,
                        locations,
                        notifications: {
                            usernames
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
        name,
        locations,
        notifications: {
            usernames = []
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
                        name,
                        locations,
                        notifications: {
                            usernames
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

    createAreaScan({ areaId, scanUntil }) {
        return new Promise((resolve, reject) => {
            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                // Ensuring areaId is valid + no scan is already started for given area
                db.collection('area').count({ _id: new ObjectID(areaId) })
                    .then((count) => {
                        if(!count) { return Promise.reject("No area found for id "+areaId); }

                        return db.collection('area-scans').count({ areaId: new ObjectID(areaId) });
                    }, rejectAndCloseDb)
                    .then((count) => {
                        if(count) { return Promise.reject("Area scan already exists !"); }

                        return db.collection('area-scans').insertOne({
                            areaId: new ObjectID(areaId),
                            until: scanUntil
                        });
                    }, rejectAndCloseDb).then(({ insertedId }) => {
                    resolve(insertedId.toString());
                    db.close();
                }, rejectAndCloseDb).catch(rejectAndCloseDb);
            }, reject);
        });
    }
    
    updateAreaScan({ areaScanId, updatedFields }) {
        return new Promise((resolve, reject) => {
            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                db.collection('area-scans').count({ _id: new ObjectID(areaScanId) }).then((count) => {
                    if(count === 0) { return Promise.reject("No area scan found for id : "+areaScanId); }

                    return db.collection('area-scans').updateOne({ _id: new ObjectID(areaScanId) }, { $set: updatedFields });
                }, rejectAndCloseDb).then(({ insertedId }) => {

                    resolve();
                    db.close();
                }, rejectAndCloseDb).catch(rejectAndCloseDb);
            }, reject);
        });
    }

    findAreaScanByAreaId({ areaId }) {
        return new Promise((resolve, reject) => {
            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                db.collection('area-scans').find({ areaId: new ObjectID(areaId) }).limit(1).next((err, areaScanItem) => {
                    if(err) { rejectAndCloseDb(err); return; }

                    resolve(areaScanItem);
                    db.close();
                });
            }, reject);
        });
    }

    listAreaScans() {
        return new Promise((resolve, reject) => {
            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                db.collection('area-scans').find().toArray().then((areaScans) => {
                    resolve(areaScans);
                    db.close();
                }, rejectAndCloseDb).catch(rejectAndCloseDb);
            }, reject);
        });
    }

    deleteAreaScan({ areaScanId }) {
        return new Promise((resolve, reject) => {
            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                db.collection('area-scans').deleteOne({ _id: new ObjectID(areaScanId )})
                    .then(() => {
                        resolve();
                        db.close();
                    }, rejectAndCloseDb)
                    .catch(rejectAndCloseDb);
            }, reject);
        });
    }

    purgeOutdatedAreaScans() {
        return new Promise((resolve, reject) => {
            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                db.collection('area-scans').deleteMany({ until: { $lt: Date.now() } })
                    .then(() => {
                        resolve();
                        db.close();
                    }, rejectAndCloseDb)
                    .catch(rejectAndCloseDb);
            }, reject);
        });
    }

    createUser({
        name,
        timezone,
        notifications: {
            lang = "fr", // either "en" or "fr"
            slackUsername,
            pokemonWhiteList, // Array of pokemon ids you're looking for
            pokemonBlackList // Array of pokemon ids you want to ignore notifications from
        }
    }) {
        return new Promise((resolve, reject) => {
            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                db.collection('users').count({ name: name })
                    .then((count) => {
                        if(count) { return Promise.reject("User with name "+name+" already exists !"); }

                        return db.collection('users').insertOne({
                            name,
                            timezone,
                            notifications: {
                                lang,
                                slackUsername,
                                pokemonWhiteList,
                                pokemonBlackList
                            }
                        });
                    }, rejectAndCloseDb)
                    .then(({ insertedId }) => {
                        resolve(insertedId.toString());
                        db.close();
                    }, rejectAndCloseDb)
                    .catch(rejectAndCloseDb);
            }, reject);
        });
    }

    updateUser({ userId, updatedFields }) {
        return new Promise((resolve, reject) => {
            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                db.collection('users').count({ _id: new ObjectID(userId) }).then((count) => {
                    if(count === 0) { return Promise.reject("No user found for id : "+userId); }

                    return db.collection('users').updateOne({ _id: new ObjectID(userId) }, { $set: updatedFields });
                }, rejectAndCloseDb).then(({ insertedId }) => {

                    resolve();
                    db.close();
                }, rejectAndCloseDb).catch(rejectAndCloseDb);
            }, reject);
        });
    }

    findAllUsers() {
        return new Promise((resolve, reject) => {
            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                db.collection('users').find().toArray()
                    .then((users) => {

                        resolve(users);
                        db.close();
                    }, rejectAndCloseDb)
                    .catch(rejectAndCloseDb);
            }, reject);
        });
    }

    findUsersByNames({ usernames }) {
        return new Promise((resolve, reject) => {
            this._inMongoConnectionDo((db, rejectAndCloseDb) => {
                db.collection('users').find({ name: { $in: usernames } }).toArray()
                    .then((users) => {

                        resolve(users);
                        db.close();
                    }, rejectAndCloseDb)
                    .catch(rejectAndCloseDb);
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