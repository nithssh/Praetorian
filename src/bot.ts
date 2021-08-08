import { Client, DMChannel, EmbedFieldData, Message, Permissions, TextChannel } from "discord.js";
import dotenv from 'dotenv';
import { ValidateCodeResult, createServerPreferences, deleteVerifiedUser, startVerificationProcess, validateCode, StartVerificationResult } from "./lib/backend";
import { ServerPreferencesCacher } from "./lib/caching";
import { GetSessionCodeResult } from "./lib/database";
import { domainList, errorMessage, fullHelpMessage, introMessage, miniHelpMessage } from "./lib/embeds";
import { isSetChannelCommand, isValidCodeCommand, isValidConfigureCommand, isValidVerifyCommand } from "./lib/utilities";

dotenv.config();
// The variables will return undefined if the value is an empty string too.
// Note: we don't check the validity of the variable values.
// hence we catch errors related to using invalid env variable values at reespective scopes.
if (!process.env.BOT_TOKEN || !process.env.EMAIL_ID || !process.env.EMAIL_PWD) {
  console.error("The .env file has not been setup. Check the README for more info. Exiting application now...");
  process.exit(2);
}

const client = new Client();
const spmgr = new ServerPreferencesCacher();

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
    let sp = await spmgr.getServerPreferences(guildMember.guild.id);
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
      guild!.systemChannel.send(introMessage());
    } catch (err) {
      console.error(`Unable to send message in server's system channel. ${err}`)
    }
  } else {
    console.error("No system channel present in the server to send intro message in.")
  }
  console.log(`Joined new server [${guild.id}: ${guild.name}]. Generated ServerPreferences successfully.`);
});

/*  Commands:
 *    !help -- prints a help message
 *    !verify <email> -- starts verification for the specified email id
 *    !code <code> -- validates the provided code
 *    !setup
 *    !configure <prefix/domain/setcmdchannel> <*newPrefix* / *newDomain* />
 */
client.on("message", async (msg: Message) => {
  if (msg.author.bot) return;
  if (typeof msg.channel == typeof DMChannel) return;
  msg.content = msg.content.toLowerCase();

  // Get the server preferences
  let sp = await spmgr.getServerPreferences(msg!.guild!.id.toString());
  const prefix = sp.prefix;

  /*
   * The message will be evaulated if:-
   *   - it is !setup command
   *   - it is !configure setcmdchannel command
   *   - msg is in sp.cmd_channel (where sp.cmd_channel)
   */
  if (msg.content !== `${prefix}setup`) {
    if (!isSetChannelCommand(msg)) {
      if (await spmgr.isCmdChannelSetup(msg.guild!.id.toString())) {
        if (msg.channel.id !== sp.cmd_channel) {
          return;
        }
      }
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
          value: `The email must be part of the \`${sp.domain.replace(" ", ", ")}\` domains. 
          Please try again with the right email address [example@${sp.domain.split(" ")[0]}].`
        });
      }
    }
    if (issues.length !== 0) {
      msg.reply(errorMessage(issues));
      return;
    }

    let status = await startVerificationProcess(msg.content.split(" ")[1], msg.author.id.toString(), msg!.guild!.id.toString());
    if (status === StartVerificationResult.EmailAlreadyTaken) {
      msg.reply(`This email is already taken [${msg.content.split(" ")[1]}].`);
    } else if (status === StartVerificationResult.SessionAlreadyActive) {
      msg.reply(`Verification code already requested within the last 15 mins. Check your email for the code, or try again later.`);
    } else if (status === StartVerificationResult.SuccessfullyCreated) {
      msg.reply(`Verification email sent to ${msg.content.split(" ")[1]}`);
    } else if (status === StartVerificationResult.SuccessfullyUpdated) {
      msg.reply(`Verification re-requested successfully. Check your email for the code.`);
    } else if (status === StartVerificationResult.ServerMemberAlreadyVerified) {
      msg.reply(`You are already verified in this server.`)
    } else if (status == StartVerificationResult.ActionFailed) {
      msg.reply(`An error occured trying to send the verification email. Please try again later.`);
      process.exit(2); // terminate the program since it is misconfigured and can't work properly
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
    if (status in ValidateCodeResult) {
      if (status == ValidateCodeResult.ValidationSuccess) {
        if (!sp.role_id) return;
        if (!msg.guild!.roles.cache.has(sp.role_id)) return;
        msg.guild!.member(msg.author.id)!.roles.add(sp.role_id);
        msg.reply(`✅ Successfully verified! Welcome to ${msg.guild!.name}!`);
      } else {
        msg.reply("❌ Entered code is invalid, please try again.");
      }
    } else if (status in GetSessionCodeResult) {
      if (status === GetSessionCodeResult.NoActiveSession) {
        msg.reply("No active verification request. Use the `verify` command to start one.");
      } else if (status === GetSessionCodeResult.LastSessionExpired) {
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
        await spmgr.setServerPreferences({
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
    let spUpdated = await spmgr.getServerPreferences(msg.guild!.id);
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
      await spmgr.setServerPreferences({
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
          spmgr.setServerPreferences({
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
            spmgr.setServerPreferences({
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
      spmgr.setServerPreferences({
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
      spmgr.setServerPreferences({
        "server_id": sp.server_id,
        "domain": sp.domain,
        "prefix": sp.prefix,
        "cmd_channel": msg.channel.id.toString(),
        "role_id": sp.role_id
      });
      if (msg.channel.type != 'dm') { // check to satisfy the linter. This is checked at the start of the onMessage callback.
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
          value: "The verified role hasn't been set up. Use the \`setup\` command to create it."
        });
      }
      if (issues.length !== 0) {
        msg.reply(errorMessage(issues));
        return;
      }

      let guildMembers = await msg.guild!.members.fetch();
      guildMembers.forEach((member, key, collection) => {
        if (member.roles.highest.position < msg.guild!.me!.roles.highest.position!) {
          member.roles.add(sp.role_id!); // assured not-null by issues checks.
        } else {
          msg.reply(errorMessage([{
            name: "❌ PRAETORIAN ROLE POSITION",
            value: `Praetorian has lower roles than ${member.displayName}, and hence can't assign role to them.`
          }]));
        }
      });
      msg.react("✅");
      msg.reply("Successfully completed `autoverifyall` command.");
    }
  }

});

try {
  client.login(process.env.BOT_TOKEN);
} catch (err) {
  console.error("Invalid BOT_TOKEN env variable. Please check it before relaunching the bot.", err);
  process.exit(2);
}
