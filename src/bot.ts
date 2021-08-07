import { Client, DMChannel, EmbedFieldData, Message, Permissions, TextChannel } from "discord.js";
import { CodeValidationReturn, createServerPreferences, deleteVerifiedUser, startVerificationProcess, validateCode } from "./lib/backend";
import { ServerPreferencesCacher } from "./lib/caching";
import { SessionCodeReturns, SessionInfoReturn } from "./lib/db";
import { domainList, errorMessage, fullHelpMessage, miniHelpMessage } from "./lib/embeds";
import { isSetChannelCommand, isValidCodeCommand, isValidConfigureCommand, isValidVerifyCommand } from "./lib/utilities";
import token from "./token";


const client = new Client();
const spm = new ServerPreferencesCacher();

client.on("ready", () => {
  console.log(`Logged in as ${client!.user!.tag}!`);
});

// Note: https://stackoverflow.com/a/64632815/8189464
client.on('guildMemberAdd', (guildMember) => {
  /* Notes:
   * if the guildMemeberRemove deleteVerifiedUser() works properly all the time,
   * we dont have to check to reassign roles to memebers,
   * which would be critical since stored verified users can't start verification again.
  */
  setTimeout(async () => {
    let sp = await spm.getServerPreferences(guildMember.guild.id);
    if (!sp.cmd_channel) return;
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
    try {
      guild!.systemChannel.send(`Hey! First things first, don't forget to use the \`!setup\` command.
      Praetorian only responds to commands in a specific command channel to reduce server spam. This channel will be created automatically by the setup command.
      Also, make sure to check out the \`!help\` command for the documentation and the rest of the configuration commands once \`!setup\` is run.`)
    } catch (err) {
      console.error(`Unable to send message in server's system channel. ${err}`)
    }
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
  msg.content = msg.content.toLowerCase();

  // make sure message is in the right channel
  if (isChannelSetup && !isSetChannelCommand(msg) && msg.content !== `${prefix}setup`) {
    if (msg.channel.id != sp.cmd_channel) return;
  } else {
    if (msg.channel.type != "dm") { // redundant check to please the linter lol
      if (!msg.channel.name.includes("verification") && !isSetChannelCommand(msg) && msg.content !== `${prefix}setup`) return;
    }
  }

  if (msg.content.startsWith(`${prefix}help`)) {
    let embedMessage;
    if (msg!.guild!.member(msg.author)!.hasPermission(['MANAGE_ROLES', 'MANAGE_GUILD'])) {
      embedMessage = fullHelpMessage(prefix);
    } else {
      embedMessage = miniHelpMessage(prefix);
    }
    msg.channel.send(embedMessage);
  }

  if (msg.content.startsWith(`${prefix}verify`)) {
    let issues: EmbedFieldData[] = [];
    if (!isValidVerifyCommand(msg)) {
      issues.push({
        name: "❌ INVALID COMMAND",
        value: "The command was not properly formed. Check help for usage."
      });
    }
    if (msg.content.split(" ")[1] !== undefined) {
      if (!sp.domain.includes(msg.content.split(" ")[1].split("@")[1])) {
        issues.push({
          name: "❌ WRONG EMAIL ID",
          value: `The email must be part of the \`${sp.domain.replace(" ", ", ")}\` domains. Please try again with the right email address [example@${sp.domain.split(" ")[0]}].`
        });
      }
    }
    if (issues.length !== 0) {
      msg.reply(errorMessage(issues));
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

  if (msg.content.startsWith(`${prefix}code`)) {
    let issues: EmbedFieldData[] = [];
    if (!isValidCodeCommand(msg)) {
      issues.push({
        name: "❌ INVALID COMMAND",
        value: "The command was not properly formed. Check help for usage."
      });
    }
    if (!msg!.guild!.me!.hasPermission(['MANAGE_ROLES'])) {
      issues.push({
        name: "❌ MANAGE ROLES PERMISSION",
        value: "The bot needs to have `Manage Roles` permission to execute this command"
      });
    }
    if (msg!.guild!.member(msg.author.id)!.roles.highest.position > msg!.guild!.me!.roles.highest.position) {
      issues.push({
        name: "❌ PRAETORIAN ROLE POSITION",
        value: `Praetorian has lower roles than the command user, and hence can't assign role to the user. 
                Fix this by moving praetorian role to a higher position in the server's roles list`
      });
    }
    if (issues.length !== 0) {
      msg.reply(errorMessage(issues));
      return;
    }

    let status = await validateCode(msg.content.split(" ")[1], msg.author.id.toString(), msg!.guild!.id!.toString());
    if (status in CodeValidationReturn) {
      if (status == CodeValidationReturn.ValidationSuccess) {
        if (!sp.role_id) return;
        if (msg.guild?.roles.cache.has(sp.role_id)) return;
        msg.guild!.member(msg.author.id)!.roles.add(sp.role_id);
        msg.reply(`✅ Successfully verified! Welcome to ${msg.guild!.name}!`);
      } else {
        msg.reply("❌ Entered code is invalid, please try again.");
      }
    } else if (status in SessionCodeReturns) {
      if (status === SessionCodeReturns.NoActiveSession) {
        msg.reply("No active verification request. Use the `verify` command to start one.");
      } else if (status === SessionCodeReturns.LastSessionExpired) {
        msg.reply("Your last request has expired. Use the `verify` command again to try again.");
      }
    }
  }

  if (msg.content.startsWith(`${prefix}setup`)) {
    let issues: EmbedFieldData[] = [];
    if (!msg.guild!.member(msg.author)!.hasPermission(['MANAGE_ROLES', 'MANAGE_GUILD'])) {
      issues.push({
        name: "❌ COMMAND USER PERMISSION",
        value: "Only members with `Manage Server` and `Manager Roles` permissions can use this command."
      });
    }
    if (!msg.guild!.me!.hasPermission('ADMINISTRATOR')) {
      issues.push({
        name: "❌ ADMIN PERMISSION",
        value: "Praetorian needs admin permission to perform this command"
      });
    }
    if (issues.length !== 0) {
      msg.reply(errorMessage(issues));
      return;
    }

    // clear the everyone role
    let roleManager = await msg.guild!.roles.fetch();
    await roleManager.everyone.setPermissions([]).then(() => {
      msg.channel.send(`Modified \`everyone\` role's permissions`)
    });

    // create the verified role and the channel
    if (!roleManager.cache.has(sp.role_id!)) { // safe to assert role_id as not null, since Map.has(null) will always return false
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
          server_id: sp.server_id,
          domain: sp.domain,
          prefix: sp.prefix,
          cmd_channel: sp.cmd_channel,
          role_id: role.id.toString(),
        });
        msg.channel.send(`Created \`Verified\` role`)
      } catch (err) {
        console.error("Couldn't create verified role");
      }
    } else {
      msg.channel.send(errorMessage([{
        name: "ℹ VERIFIED ROLE ALREADY EXISTS",
        value: "Verified role wasn't created as one previously created already exists."
      }]));
    }

    // create the verification channel
    let spUpdated = await spm.getServerPreferences(msg.guild!.id);
    if (msg.guild!.channels.cache.filter((value) => value.name === "verification").size == 0) {
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
            id: spUpdated.role_id!, // can't be null as role_id was *just* created & assigned in the previous step
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
      msg.channel.send(errorMessage([{
        name: "❌ CHANNEL WITH NAME EXISTS",
        value: "A channel named verification already exists. To fix this run this command again after deleting the channel named verification"
      }]));
    };
  }

  if (msg.content.startsWith(`${prefix}configure`)) {
    let issues: EmbedFieldData[] = [];
    if (!isValidConfigureCommand(msg)) {
      issues.push({
        name: "❌ INVALID COMMAND",
        value: "The command was not properly formed. Check help for usage."
      });
    }
    if (!msg.guild!.member(msg.author)!.hasPermission(['MANAGE_ROLES', 'MANAGE_GUILD'])) {
      issues.push({
        name: "❌ COMMAND USER PERMISSION",
        value: "Only members with `Manage Server` and `Manager Roles` permissions can use this command ."
      });
    }
    if (issues.length !== 0) {
      msg.reply(errorMessage(issues));
      return;
    }

    let cmdParts = msg.content.split(" ");
    if (cmdParts[1] === "domain") {
      if (cmdParts[2] == "add") {
        if (sp.domain.includes(cmdParts[3])) {
          msg.reply(errorMessage([{
            name: "❌ DOMAIN ALREADY IN FILTER",
            value: "The provided domain is already part of the filter."
          }]));
          return;
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
      } else if (cmdParts[2] == "remove") {
        if (sp.domain.includes(cmdParts[3])) {
          if (sp.domain.split(" ").length === 1) {
            msg.reply(errorMessage([{
              name: "❌ LAST DOMAIN IN FILTER",
              value: "Can't remove the last domain in the filter."
            }]));
            return;
          }
          else {
            spm.setServerPreferences({
              "server_id": sp.server_id,
              "domain": sp.domain.replace(cmdParts[3], "").trim(),
              "prefix": sp.prefix,
              "cmd_channel": sp.cmd_channel,
              "role_id": sp.role_id
            });
            msg.reply(`Successfully removed \`${cmdParts[3]}\` from the domain filter.`);
          }
        }
      } else if (cmdParts[2] == "get") {
        msg.reply(domainList(sp.domain.split(" ")));
      }
    } else if (cmdParts[1] === "prefix") {
      spm.setServerPreferences({
        "server_id": sp.server_id,
        "domain": sp.domain,
        "prefix": cmdParts[2],
        "cmd_channel": sp.cmd_channel,
        "role_id": sp.role_id
      });
      msg.reply(`Successfully updated command prefix to \`${cmdParts[2]}\``);
    } else if (cmdParts[1] === "setcmdchannel") {
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
          if (sp.role_id) {
            if (msg.guild!.roles.resolve(sp.role_id)) {
              cmdChannel.updateOverwrite(
                msg.guild!.roles.resolve(sp.role_id)!,
                {
                  'VIEW_CHANNEL': null
                }
              );
            }
          } else {
            console.log("Didn't update channel overrides as sp.role_id was null")
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
      if (msg.channel.type != 'dm') { // check to satisfy the linter
        msg.reply(`Successfully updated command channel to \`${msg.channel.name}\``);
      }

    } else if (cmdParts[1] === "autoverifyall") {
      let issues: EmbedFieldData[] = [];
      if (!msg.guild!.member(msg.author)!.hasPermission(['ADMINISTRATOR'])) {
        issues.push({
          name: "❌ COMMAND USER PERMISSION",
          value: "Only members with ADMIN can call this command for security purposes."
        });
      }
      if (!msg.guild!.me!.hasPermission('ADMINISTRATOR')) {
        issues.push({
          name: "❌ ADMIN PERMISSION",
          value: "Praetorian needs admin permission to perform this command"
        });
      }
      if (msg.guild!.roles.highest.position - msg.guild!.me!.roles.highest.position > 2) {
        issues.push({
          name: "❌ PRAETORIAN ROLE POSITION",
          value: "The server role 'Praetorian' is too low for this command to work properly. Move praetorian to a higher position in the role list."
        });
      }
      if (!sp.role_id) {
        issues.push({
          name: "❌ VERIFIED ROLE DOESN'T EXIST",
          value: "The verified role hasn't been set up. Use the setup command to create it."
        });
      }
      if (issues.length !== 0) {
        msg.reply(errorMessage(issues));
        return;
      }

      msg.guild!.members.fetch().then(
        (guildMembers) => {
          guildMembers.forEach((member, key, collection) => {
            if (member.roles.highest.position < msg.guild?.me?.roles.highest.position!) {
              member.roles.add(sp.role_id!); // assured not-null by issues checks.
            }
          });
        }
      ).then(() => {
        msg.react("✔");
        msg.reply("Successfully completed `autoverifyall` command. If anyone was left from being verified, it is due to their higher role compared to the bot.");
      }
      );
    }
  }

});

client.login(token);
