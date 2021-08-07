import { EmbedFieldData, MessageEmbed } from "discord.js";
const img = "https://raw.githubusercontent.com/Dem1se/Praetorian/master/docs/avatar.png?token=AFJ5V4KMOJUJOEIPOVP3FGDA7K2SS";

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
        \`${prefix}setup\` — Set up this server for the bot to work. Creates a verified role, removes all permissions from the everyone role, and creates a verification channel.\n
        \`${prefix}configure domain get\` — List the domains in the domain filter.\n
        \`${prefix}configure domain add example.com\` — Add the specified domain to the domain filter.\n
        \`${prefix}configure domain remove example.com\` — Remove the specified domain from the domain filter.\n
        \`${prefix}configure prefix !\` — Set the bot's command prefix symbol.\n
        \`${prefix}configure setCmdChannel\` — Manually set the verification channel to the channel this command is sent in. Automatically set by the \`setup\` command.\n
        \`${prefix}configure autoverifyall !\` — Add the verified role to all the current server member. This option is for pre-existing communities, that want to switch over to this bot for auto verification.\n
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
    // .setDescription("Fix the following issues preventing autoverifyall command from working.")
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