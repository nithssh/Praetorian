import { EmbedFieldData, MessageEmbed } from "discord.js";
const img = "https://raw.githubusercontent.com/Dem1se/Praetorian/master/docs/avatar.png";

export function fullHelpMessage(prefix: string) {
  return new MessageEmbed()
    .setAuthor('Full Help Message', img)
    .setColor('#cccccc')
    .setTitle("Praetorian")
    .setDescription(`A bot for email verifying new server members, before giving them access to the server. The email has to belong to a specific configurable domain.`)
    .addFields(
      {
        name: "User Commands",
        value: `
          \`${prefix}verify user@example.com\` — Start user verification for the specified email id.\n
          \`${prefix}code 123456\` — Validate the entered verification code.\n
          \`${prefix}help\` — Print this help message.\n`
      },
      {
        name: "Admin Commands", value: `
        \`${prefix}setup\` — Set up this server for the bot to work. \
        Creates a verified role, removes all permissions from the everyone role, \
        and creates a verification channel.\
        Can also be used to fix server configuration is some cases.\n
        \`${prefix}configure domain get\` — List the domains in the domain filter.\n
        \`${prefix}configure domain add example.com\` — Add the specified domain to the domain filter.\n
        \`${prefix}configure domain remove example.com\` — Remove the specified domain from the domain filter.\n
        \`${prefix}configure prefix !\` — Set the bot's command prefix symbol.\n
        \`${prefix}configure setCmdChannel\` — Manually set the verification channel to the channel this command is sent in. \
        Automatically set by the \`setup\` command.\n
        \`${prefix}configure autoverifyall\` — Add the verified role to all the current server member. \
        This option is for pre-existing communities, that want to switch over to this bot for verification.\n
      `})
    .setFooter('Version 1.0.0-beta', img);
}

export function miniHelpMessage(prefix: string) {
  return new MessageEmbed()
    .setAuthor('Help Message', img)
    .setColor('#cccccc')
    .setTitle("Praetorian")
    .setDescription(`A bot for email verifying new server members, before giving them access to the server. The email has to belong to a specific configurable domain.`)
    .addFields({
      name: "User Commands",
      value: `
        \`${prefix}verify user@example.com\` — Start user verification for the specified email id.\n
        \`${prefix}code 123456\` — Validate the entered verification code.\n
        \`${prefix}help\` — Print this help message.\n
    `})
    .setFooter('Version 1.0.0-beta', img);
}

export function errorMessage(issues: EmbedFieldData[]) {
  return new MessageEmbed()
    .setAuthor('Error executing command', img)
    .setColor('#cccccc')
    .setTitle('Encountered the following issues:')
    // .setDescription("Fix the following issues preventing the {} command from working.")
    .addFields(issues);
}

export function domainList(domains: string[]) {
  let list: EmbedFieldData[] = [];
  for (let domain of domains) [
    list.push({
      name: `:white_small_square: ${domain}`,
      value: "‎" // there is a zero width joiner in this string.
    })
  ]
  return new MessageEmbed()
    .setAuthor('Domain Filter List', img)
    .setColor('#cccccc')
    .setTitle("‎")
    .addFields(list);
}

export function introMessage() {
  return new MessageEmbed()
    .setAuthor('Praetorian', img)
    .setColor('#cccccc')
    .setTitle("Hey!")
    .setDescription(`Before I can start working properly, a few things have to be done.`)
    .addFields([
      {
        name: "1️⃣ Use the \`!setup\` command",
        value: `This will create a 'Verified' role and tranfer the basic permission from everyone to this role instead.
        It will also create a verification channel, which is the only place the bot will respond to user commands to reduce spam.`
      },
      {
        name: "2️⃣ Use the \`!help\` command in the verification channel",
        value: "This will list all the available commands, along with a description of what they do."
      }
    ])
    .setFooter('Version 1.0.0-beta', img);
}
