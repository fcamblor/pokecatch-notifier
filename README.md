# Pokecatch-notifier

NodeJS application intended to notify `Incoming WebHooks` slack bot everytime a new pokemon not owned pops in a
user-defined area

# Setup

You can deploy the app as is on an IaaS such as Heroku (free app).

You will need a small mongodb database in order to be able to persist area definitions from one call to another.

Mongolab 500MB free instances are largely enough for this purpose.

You will have to define following environment variables :

  - SLK_HOOK_URL : You will need to setup an [Incoming Webhook bot](https://api.slack.com/incoming-webhooks) on your slack domain
    Once done, you will have a hook URL like this one : 
    `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX`
    This is the SLK_HOOK_URL

  - SLK_USERNAME : The name the bot will take while publishing the notification. By default, will be `Pokemon catcher`
  - MNG_URL : A mongodb url such as `mongodb://myuser:myapikey@mynode.mlab.com:19624/my-db`


# How it works

_To be defined_