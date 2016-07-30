# Pokecatch-notifier

NodeJS application intended to notify `Incoming WebHooks` slack bot everytime a new pokemon not owned pops in a
user-defined area

# Setup

You will need a small mongodb database in order to be able to persist some stuff like area definitions.
Mongolab 500MB free instances are largely enough for this purpose.

You will need a Firebase database to host some live statistics about pokemons which popped in your areas.

You can deploy the app as is on an IaaS such as Heroku (free app).
You will have to define following NodeJS environment variables :

  - SLK_HOOK_URL : You will need to setup an [Incoming Webhook bot](https://api.slack.com/incoming-webhooks) on your Slack domain
    Once done, you will have a hook URL like this one : 
    `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX`
    This is the SLK_HOOK_URL

  - SLK_USERNAME : The name the bot will take while publishing the notification. By default, will be `Pokemon catcher`
  - MNG_URL : A mongodb url such as `mongodb://myuser:myapikey@mynode.mlab.com:19624/my-db`
  - FB_CONFIG : In Firebase, you will need to open your instance's Permissions and create a "Service key".
    Then, you will need to export this key through a JSON file. Content of this JSON file should be one-lined then
    copy/pasted into `FB_CONFIG` variable.
    Content should look like this (don't forget it should be one-linked !) :
    ```
    {
      "type": "service_account",
      "project_id": "XXXXXX",
      "private_key_id": "01234567890abcde01234567890abcde01234567",
      "private_key": "-----BEGIN PRIVATE KEY-----\nblahblahblah\n-----END PRIVATE KEY-----\n",
      "client_email": "XXXX@XXXX.iam.gserviceaccount.com",
      "client_id": "012345678900123456789",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://accounts.google.com/o/oauth2/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/XXXX%40XXXX.iam.gserviceaccount.com"
    }
    ```
  - FB_DATABASE_URL : Your firebase root database url. Something like `https://XXXX.firebaseio.com`
  

# Known issues on Mac OS X

If you tries to run the NodeJS app while being on Mac OS, you will need to `npm install --no-optional` (instead of
standard `npm install`) as some transitive dependencies don't work on Mac OS currently (those transitive dependencies
are not really required at runtime, so it doesn't make any problem to not install it).


# How it works

Once started, the server will do nothing than waiting for some incoming HTTP requests.
First request will be to create a user which will be notified in Slack :
```
curl -X POST -H "Content-Type: application/json" -d '{
    "name": "fcamblor",
    "timezone": "Europe/Paris",
    "notifications": {
        "lang": "fr",
        "slackUsername": "fred",
        "pokemonWhiteList": null,
        "pokemonBlackList": [
            1,16,17,19,25,27,37,41,52,58,63,81,100
        ]
    }
}
' "http://localhost:8080/users"
```
Here, I'm defining a user named `fcamblor`, having a `@fred` *already existing Slack account* (which will be notified) 
and who doesn't care of a bunch of Pokemons (for instance, 25=Pikachu) because he already owns them.
Once created, you will receive a unique token corresponding to your created user. Remember this token since it may be 
needed to update your user in the future (using a `PUT /users/{id}`

Once your user is defined, you will need to create an `Area`.
An area is an aggregate of GPS coordinates corresponding to a location (for instance your home, or your work).
You can create a new Area by sending a request looking like this :
```
curl -X POST -H "Content-Type: application/json" -d '{
    "name": "grandeJetee",
    "locations": [
        46.229824531177,
        -1.488121747970581,
        46.229171403717864,
        -1.4855575561523438,
        46.22957218739817,
        -1.4906215667724607,
        46.22902296457509,
        -1.4889800548553467,
        46.229245623138716,
        -1.482628583908081,
        46.229698359432604,
        -1.4924883842468262
    ],
    "notifications": {
        "usernames": [ "fcamblor" ]
    }
}' "http://localhost:8080/area"
```

Once the area is created, remember its token since it will be very useful for upcoming commands.

Now, we will start scanning the area for Pokemons. For doing this, simply call the following request :
```
curl -X POST -H "Content-Type: application/json" "http://localhost:8080/area/1234567890abcde/startScan?duration=3600000
```
where `1234567890abcde` is your area's token, and you want to scan this area during 1h (3600000ms).
By default, if you don't put any `duration`, the default is 10 minutes.
Once done, the app will start looping over every area's locations and scan for pokemon around these locations, one by one,
using the [pokevision](www.pokevision.com) website (big thanks to them !), meaning if you go to www.pokevision.com after
having started the scanning process, you will see the pokemons on the map without having to click the "scan" button.


Now, once the scan process is started, if you want to be notified on Slack, you will need to call following request :
```
curl -X POST -H "Content-Type: application/json" "http://localhost:8080/area/1234567890abcde/startNotifications
```
and call the `/stopNotifications` as well to stop it.

By doing this, everytime a pokemon is detected on a location, we will retrieve area's notified users informations, and 
particularly his pokemon's white/black list : if the user is interested by the Pokemon which just popped, a Slack 
notification direct message will be sent to him.

![Slack notification screenshot](screenshots/Slack Notifications.png
