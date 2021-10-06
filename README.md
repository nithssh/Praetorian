# Praetorian
Build exclusive communities with this bot for email-verifying new server members, before giving them access to the server. The email has to belong to a set of specific configurable domains.

It was made to be used by communities like college gaming clubs / esports teams, etc. but can obviously be used for other purposes.

## Invite
Invite link *with* admin permission [here](https://discord.com/api/oauth2/authorize?client_id=835201049701646336&permissions=8&scope=bot).

Admin permission is required for the `setup`, and `configure autoverifyall` commands only, but because of the way role heirarcy works, the bot.

## Commands
`verify`, `code`, `help`, `setup`, `configure`

The default prefix is `!`.
Use the `help` command to get an up-to-date explaination on these commands.

```
/ COMMAND STRUCTURE
├── help
├── verify
├── code
├── setup
└── configure
    ├── prefix
    ├── domain
    │   ├── get
    │   ├── add
    │   └── remove
    ├── setCmdChannel
    └── autoVerifyAll
```

## Deployment
Clone the repo, setup the .env file, and run the following commands:-

```
npm install
npm start
```
Note: `npm i` might have to be run with elevated privileges on linux, for the sqlite3 package's build steps.

### `.env` File
The .env file at the root of the project needs to have the following variables.
```env
BOT_TOKEN=""
EMAIL_ID=""
EMAIL_PWD=""
```
