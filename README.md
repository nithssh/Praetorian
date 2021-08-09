# Praetorian
A bot for email-verifying new server members, before giving them access to the server. The email has to belong to a specific configurable domain.

It was made to be used by communities like college gaming discord servers / esports teams, etc. but can obviously can be used.

## Invite
Invite link *with* admin permission [here](https://discord.com/api/oauth2/authorize?client_id=835201049701646336&permissions=8&scope=bot), is recommended for the best experience.

Admin permissions can be removed after the setup command is called as only that requires it.

## Commands
`verify`, `code`, `help`, `setup`, `configure`

Use the `!help` command to get an up to date explaination on these commands

## `.env` File
The .env file at the root of the project needs to have the following variables.
```env
BOT_TOKEN=""
EMAIL_ID=""
EMAIL_PWD=""
```
