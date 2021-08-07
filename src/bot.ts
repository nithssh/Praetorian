import { DMChannel, Message, TextChannel, Client, Permissions, MessageEmbed } from "discord.js";
import { ServerPreferencesCache } from "./lib/caching";
import { startVerificationProcess, validateCode, createServerPreferences, deleteVerifiedUser, CodeValidationReturn } from "./lib/backend";
import { isValidCodeCommand, isValidVerifyCommand, isValidConfigureCommand, isSetChannelCommand } from "./lib/utilities";
import token from "./token";
import { SessionCodeReturns, SessionInfoReturn } from "./lib/db";

const client = new Client();
const spm = new ServerPreferencesCache();

client.on("ready", () => {
  console.log(`Logged in as ${client!.user!.tag}!`);
});

// Note: https://stackoverflow.com/a/64632815/8189464
client.on('guildMemberAdd', (guildMember) => {
  // if the guildMemeberRemove deleteVerifiedUser() works properly all the time,
  // we dont have to check to reassign roles to memebers,
  // which would be critical since stored verified users can't start verification again.
  setTimeout(async () => {
    let sp = await spm.getServerPreferences(guildMember.guild.id);
    let textChannel = guildMember!.guild!.channels!.resolve(sp.cmd_channel) as TextChannel;
    if (textChannel) {
      textChannel.send(`Hey! you will need to verify your email from belonging to ${sp.domain.replace(" ", " or ")} to gain access tp this sever.
      Use the command \`${sp.prefix}help\` to get more info.`);
    }
  }, 1000);
})

client.on('guildMemberRemove', (guildMember) => {
  deleteVerifiedUser(guildMember.id, guildMember.guild.id);
})

client.on('guildCreate', (guild) => {
  createServerPreferences(guild.id.toString());
  if (guild.systemChannel) {
    guild!.systemChannel.send(`Hey! First things first, don't forget to use the \`!setup\` command.
    Praetorian only responds to commands in a specific command channel to reduce server spam. This channel will be created automatically by the setup command.
    Also, make sure to check out the \`!help\` command for the documentation and the rest of the configuration commands once \`!setup\` is run.`)
  } else {
    console.error("No system channel present in the server to send intro message in.")
  }
  console.log(`Joined new server [${guild.id}: ${guild.name}]. Generated ServerPreferences successfully.`);
});

/*  Commands:
 *      !help -- prints a help message
 *      !verify <email> -- starts verification for the specified email id
 *      !code <code> -- validates the provided code
 *      !setup
 *      !configure <prefix/domain/setcmdchannel> <*newPrefix* / *newDomain* />
 */
client.on("message", async (msg: Message) => {
  if (msg.author.bot) return;
  if (typeof msg.channel == typeof DMChannel) return;

  // Get the server preferences
  let sp = await spm.getServerPreferences(msg!.guild!.id.toString());
  let isChannelSetup = await spm.isCmdChannelSetup(msg!.guild!.id.toString());
  const prefix = sp.prefix;

  // make sure message is in the right channel
  if (isChannelSetup && !isSetChannelCommand(msg) && msg.content !== `${prefix}setup`) {
    if (msg.channel.id != sp.cmd_channel) return;
  } else {
    if (msg.channel.type != "dm") { // redundant check to please the linter lol
      if (!msg.channel.name.toLowerCase().includes("verification") && !isSetChannelCommand(msg) && msg.content !== `${prefix}setup`) return;
    }
  }

  if (msg.content.toLowerCase().startsWith(`${prefix}help`)) {
    const img = "https://raw.githubusercontent.com/Dem1se/Praetorian/master/docs/avatar.png?token=AFJ5V4KMOJUJOEIPOVP3FGDA7K2SS";
    let embedMessage;
    if (msg!.guild!.member(msg.author)!.hasPermission(['MANAGE_ROLES', 'MANAGE_GUILD'])) {
      embedMessage = new MessageEmbed()
        .setAuthor('Full Help Message', img)
        .setColor('#cccccc')
        .setTitle("Praetorian")
        .setDescription(`A bot for email verifying new server members, before giving them access to the server. The email has to belong to a specific configurable domain.`)
        .addFields(
          {
            name: "User Commands", value: `
  \`${prefix}verify user@example.com\` — Start user verification for the specified email id.\n
  \`${prefix}code 123456\` — Validate the entered verification code.\n
  \`${prefix}help\` — Print this help message.\n
              `},
          {
            name: "Admin Commands", value: `
  \`${prefix}setup\` — Set up this server for the bot to work. Creates a verified role, removes all permissions from the everyone role, and creates a verification channel.\n
  \`${prefix}configure domain get\` — List the domains in the domain filter.\n
  \`${prefix}configure domain add example.com\` — Add the specified domain to the domain filter.\n
  \`${prefix}configure domain remove example.com\` — Remove the specified domain from the domain filter.\n
  \`${prefix}configure prefix !\` — Set the bot's command prefix symbol.\n
  \`${prefix}configure setCmdChannel\` — Manually set the verification channel to the channel this command is sent in. Automatically set by the \`setup\` command.\n
  \`${prefix}configure autoverifyall !\` — Add the verified role to all the current server member. This option is for pre-existing communities, 
that want to switch over to this bot for auto verification.\n
              `}
        )
        .setFooter('Version 1.0.0-beta', img);
    } else {
      embedMessage = new MessageEmbed()
        .setAuthor('Help Message', img)
        .setColor('#cccccc')
        .setTitle("Praetorian")
        .setDescription(`A bot for email verifying new server members, before giving them access to the server. The email has to belong to a specific configurable domain.`)
        .addFields(
          {
            name: "User Commands", value: `
  \`${prefix}verify user@example.com\` — Start user verification for the specified email id.\n
  \`${prefix}code 123456\` — Validate the entered verification code.\n
  \`${prefix}help\` — Print this help message.\n
              `}
        )
        .setFooter('Version 1.0.0-beta', img);
    }
    msg.channel.send(embedMessage);
  }

  if (msg.content.toLowerCase().startsWith(`${prefix}verify`)) {
    if (!isValidVerifyCommand(msg)) {
      msg.reply("Invalid command. Must be !verify <*email*>, where *email* is a valid email address.");
      return;
    }
    if (!sp.domain.includes(msg.content.split(" ")[1].split("@")[1].toLowerCase())) {
      msg.reply(`The email must be part of the \`${sp.domain.replace(" ", ", ")}\` domains. Please try again with the right email address [example@${sp.domain.split(" ")[0]}].`);
      return;
    }

    let status = await startVerificationProcess(msg.content.split(" ")[1], msg.author.id.toString(), msg!.guild!.id.toString());
    if (status === SessionInfoReturn.EmailAlreadyTaken) {
      msg.reply(`This email is already taken [${msg.content.split(" ")[1]}].`);
    } else if (status === SessionInfoReturn.SessionAlreadyActive) {
      msg.reply(`Verification code already requested within the last 15 mins. Check your email for the code, or try again later.`);
    } else if (status === SessionInfoReturn.SuccessfullyCreated) {
      msg.reply(`Verification email sent to ${msg.content.split(" ")[1]}`);
    } else if (status === SessionInfoReturn.SuccessfullyUpdated) {
      msg.reply(`Verification re-requested successfully. Check your email for the code.`);
    } else if (status === SessionInfoReturn.ServerMemberAlreadyVerified) {
      msg.reply(`you are already verified in this server.`)
    }
  }

  if (msg.content.toLowerCase().startsWith(`${prefix}code`)) {
    if (!isValidCodeCommand(msg)) {
      msg.reply("Invalid command. Must be !code <*code*>, where *code* is a 6-digit number.");
      return;
    }
    if (!msg!.guild!.me!.hasPermission(['MANAGE_ROLES'])) {
      msg.reply(`the \`code\` command requires Praetorian bot to have \`Manage Messages\` permission.`);
      return;
    }

    let status = await validateCode(msg.content.split(" ")[1], msg.author.id.toString(), msg!.guild!.id!.toString());
    if (status in CodeValidationReturn) {
      if (status == CodeValidationReturn.ValidationSuccess) {
        if (msg!.guild!.member(msg.author.id)!.roles.highest.position > msg!.guild!.me!.roles.highest.position) {
          msg.reply(`has a higher role than Pratorian. Please fix this by moving the Pratorian role to higher position. 
Bots can only manage the roles of members with roles all lower than their role in the hierarchy. 
Discord permissions are weird, I know right. Please contact a admin/mod`);
        } else {
          msg.guild!.member(msg.author.id)!.roles.add(sp.role_id);
          msg.reply(`Successfully verified! Welcome to ${msg!.guild!.name}!`);
        }
      } else {
        msg.reply("Entered code is invalid, please try again.");
      }
    } else if (status in SessionCodeReturns) {
      if (status === SessionCodeReturns.NoActiveSession) {
        msg.reply("No active verification request. Use the `!verify <email>` command to start one.");
      } else if (status === SessionCodeReturns.LastSessionExpired) {
        msg.reply("Your last request has expired. Use the `!verify <email>` command again to try again.");
      }
    }
  }

  if (msg.content.toLowerCase().startsWith(`${prefix}setup`)) {
    if (!msg.guild!.member(msg.author)!.hasPermission(['MANAGE_ROLES', 'MANAGE_GUILD'])) {
      msg.reply("Only members with `manage server` and `manager roles` permissions can use this command.");
      return;
    }
    if (!msg.guild!.me!.hasPermission('ADMINISTRATOR')) {
      msg.reply(`the \`setup\` command requires Praetorian bot to have \`administrator\` permission.
None of the other commands and regular operation require admin permissions. The permission can be removed after the setup command.`);
      return;
    }

    // clear the everyone role
    let roleManager = await msg.guild!.roles.fetch();
    await roleManager.everyone.setPermissions([]).then(() => {
      msg.channel.send(`Modified \`everyone\` role's permissions`)
    });

    // create the verified role and the channel
    if (!roleManager.cache.has(sp.role_id)) {
      try {
        let role = await roleManager.create({
          data: {
            name: "Verified",
            position: 1,
            permissions: new Permissions(['VIEW_CHANNEL', 'CREATE_INSTANT_INVITE', 'CHANGE_NICKNAME',
              'SEND_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES', 'USE_EXTERNAL_EMOJIS', 'READ_MESSAGE_HISTORY',
              'CONNECT', 'SPEAK', 'STREAM', 'USE_VAD'])
          },
          reason: "Created by Praetorian",
        });
        await spm.setServerPreferences({
          "server_id": sp.server_id,
          "domain": sp.domain,
          "prefix": sp.prefix,
          "cmd_channel": sp.cmd_channel,
          "role_id": role.id.toString(),
        });
        msg.channel.send(`Created \`Verified\` role`)
      } catch {
        console.error("Couldn't create verified role");
      }
    } else {
      msg.channel.send(`\`Verified\` role already exists`);
    }

    // create the verification channel
    let spUpdated = await spm.getServerPreferences(msg.guild!.id);
    if (msg.guild!.channels.cache.filter((value) => value.name.toLowerCase() === "verification").size == 0) {
      let createdChannel = await msg.guild!.channels.create('Verification', {
        topic: "",
        nsfw: false,
        position: 1,
        permissionOverwrites: [
          {
            id: roleManager.everyone,
            allow: new Permissions(['VIEW_CHANNEL', 'SEND_MESSAGES'])
          },
          {
            id: spUpdated.role_id,
            deny: new Permissions(['VIEW_CHANNEL'])
          }
        ],
        reason: `Channel created by Praetorian after setup command by ${msg.author.username}`
      });
      await spm.setServerPreferences({
        "server_id": spUpdated.server_id,
        "domain": spUpdated.domain,
        "prefix": spUpdated.prefix,
        "cmd_channel": createdChannel.id,
        "role_id": spUpdated.role_id
      });
      msg.channel.send(`Created and Updated \`#verification\` channel`);
    } else {
      msg.channel.send(`Channel named \`#verification\` already exisits`);
    };
  }

  if (msg.content.toLowerCase().startsWith(`${prefix}configure`)) {
    if (!isValidConfigureCommand(msg)) {
      msg.reply("Invalid command. Check help for usage.")
      return;
    }
    if (!msg.guild!.member(msg.author)!.hasPermission(['MANAGE_ROLES', 'MANAGE_GUILD'])) {
      msg.reply("Only members with `manage server` and `manager roles` permissions can use this command.");
      return;
    }

    let cmdParts = msg.content.split(" ");
    if (cmdParts[1].toLowerCase() === "domain") {
      if (cmdParts[2].toLowerCase() == "add") {
        if (sp.domain.includes(cmdParts[3])) {
          msg.reply("provided domain is already part of the filter.")
        } else {
          spm.setServerPreferences({
            "server_id": sp.server_id,
            "domain": `${sp.domain} ${cmdParts[3]}`,
            "prefix": sp.prefix,
            "cmd_channel": sp.cmd_channel,
            "role_id": sp.role_id
          });
          msg.reply(`Successfully added \`${cmdParts[3]}\` to the domain filter.`);
        }
      } else if (cmdParts[2].toLowerCase() == "remove") {
        if (sp.domain.includes(cmdParts[3])) {
          if (sp.domain.split(" ").length === 1) {
            msg.reply("can't remove the last domain in the filter");
          }
          else {
            spm.setServerPreferences({
              "server_id": sp.server_id,
              "domain": sp.domain.replace(cmdParts[3], ""),
              "prefix": sp.prefix,
              "cmd_channel": sp.cmd_channel,
              "role_id": sp.role_id
            });
            msg.reply(`Successfully removed \`${cmdParts[3]}\` from the domain filter.`);
          }
        }
      } else if (cmdParts[2].toLowerCase() == "get") {
        msg.reply(`The domains currently in the domain filter are: ${sp.domain.replace(" ", ", ")}`)
      }
    } else if (cmdParts[1].toLowerCase() === "prefix") {
      spm.setServerPreferences({
        "server_id": sp.server_id,
        "domain": sp.domain,
        "prefix": cmdParts[2],
        "cmd_channel": sp.cmd_channel,
        "role_id": sp.role_id
      });
      msg.reply(`Successfully updated command prefix to \`${cmdParts[2]}\``);
    } else if (cmdParts[1].toLowerCase() === "setcmdchannel") {
      // reset the permissionOverwrites for the previous 
      if (sp.cmd_channel != null) {
        let cmdChannel = msg.guild!.channels.resolve(sp.cmd_channel);
        if (cmdChannel) {
          cmdChannel.updateOverwrite(
            msg.guild!.roles.everyone,
            {
              'VIEW_CHANNEL': null,
              'SEND_MESSAGES': null
            }
          );
          if (msg.guild!.roles.resolve(sp.role_id)) {
            cmdChannel.updateOverwrite(
              msg.guild!.roles.resolve(sp.role_id)!,
              {
                'VIEW_CHANNEL': null
              }
            );
          }
        }
      }
      spm.setServerPreferences({
        "server_id": sp.server_id,
        "domain": sp.domain,
        "prefix": sp.prefix,
        "cmd_channel": msg.channel.id.toString(),
        "role_id": sp.role_id
      });
      if (msg.channel.type != 'dm') {
        msg.reply(`Successfully updated command channel to \`${msg.channel.name}\``);
      }
    } else if (cmdParts[1].toLowerCase() === "autoverifyall") {
      // message author needs to have admin
      // bot needs to have admin
      // bot needs to have highest -2 role position at least
      if (!msg.guild!.member(msg.author)!.hasPermission(['ADMINISTRATOR'])) {
        msg.reply("Only members with admin can call this command.");
        return;
      }
      if (!msg.guild!.me!.hasPermission('ADMINISTRATOR')) {
        msg.reply(`Due to the way managing roles works on Discord, the bot needs to have Admin permission, 
and also has to be at the top of the permissions list so that this command can work. Only this command requires this much privilige.`)
        return;
      }
      if (msg.guild!.roles.highest.position - msg.guild!.me!.roles.highest.position > 2) {
        msg.reply(`The bot can only manage the roles of members with roles lower than its role in the list. 
So please move the Praetorian role to the top or give Praetorian bot the highest role.`);
        return;
      }
      msg.guild!.members.fetch().then(
        (guildMembers) => {
          guildMembers.forEach((value, key, collection) => {
            value.roles.add(sp.role_id);
          });
        }
      ).then(() => {
        msg.reply("Successfully completed `autoverifyall` command. If anyone was left from being verified, it is due to their higher role compared to the bot.")
      }
      );
    }
  }
});
client.login(token);
