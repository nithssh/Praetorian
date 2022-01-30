# Praetorian
Build exclusive communities with this bot for email-verifying new server members, before giving them access to the server. The email has to belong to a set of specific configurable domains.

Made to be used by communities like college gaming clubs / esports teams, etc. but can obviously be used for other purposes.

## Invite

Invite link with admin permission [here](https://discord.com/api/oauth2/authorize?client_id=835201049701646336&permissions=8&scope=bot).

Admin permission is only strictly required by the `setup`, and `configure autoverifyall` commands, but because of the way role heirarcy works, the bot works most reliably when given admin and the Praetorian role is near the top of the list.

Make sure to read the `help` message and run the `setup` command after adding the bot to a server.

Note that the bot will only respond to messages in the verification channel it set up if any, especially once the `setup` command is run. So if the bot is not responding to your commands you might want to make sure you're using the right channel.



## Commands
`verify`, `code`, `help`, `setup`, `configure`

The default prefix is `!`. Use the `help` command to get an up-to-date explaination of these commands.

The bot will process commands any text channel if:
- It is the `!setup` command
- It is the `!configure setcmdchannel` command
- The command channel is not set yet (either through `!setup` or `!configure`)

All the commands in the command channel (named "*Verification*" initially) will be processed.

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

These are the planned application commands:
```
/verify start
/verify code
/setup
/prefix
/domain get
/domain add
/domain remove
/autoverifyall
```
## Deployment
### Docker
~~Pull this image from Docker Hub, and run it using these commands. Fill in the quotes with your credentials.~~
The Docker image is not maintained anymore, since I didn't have any use for it, and no one has deployed it to be honest XD
```
# docker pull dem1se/praetorian
# docker run -e BOT_TOKEN=" " -e EMAIL_ID=" " -e EMAIL_PWD=" " dem1se/praetorian
```

### Bare Node.js application
Clone the repo, [setup the .env file](#.env-file), and run the following commands:-

```
npm install
npm start
```
Note: `npm install` might have to be run with elevated privileges on linux, for the sqlite3 package's build steps.

#### .env File
The .env file at the root of the project needs to have the following variables if running as directly as node application.
```env
BOT_TOKEN=""
EMAIL_ID=""
EMAIL_PWD=""
```

## Some exit codes
- 0: Everything's good. Take a break!
- 2: There is an error with the secrets (environmental variables). If using the [Docker image](#docker), make sure you fill in the quotes in the `docker run` command. If running as node application directly, [setup the .env file](#.env-file)
- 3: Issue with the logger. There was an error creating a latest.log file. Please check file system permissions or other related causes.
