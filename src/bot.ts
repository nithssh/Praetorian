import { Client, DMChannel, EmbedFieldData, Message, Permissions, TextChannel } from "discord.js";
import dotenv from 'dotenv';
import { ValidateCodeResult, createServerPreferences, deleteVerifiedUser, startVerificationProcess, validateCode, StartVerificationResult } from "./lib/backend";
import { ServerPreferencesCacher } from "./lib/caching";
import { GetSessionCodeResult } from "./lib/database";
import { domainList, errorMessage, fullHelpMessage, introMessage, miniHelpMessage } from "./lib/embeds";
import { isSetChannelCommand, isValidCodeCommand, isValidConfigureCommand, isValidVerifyCommand } from "./lib/utilities";
import { Logger, LogLevel } from './lib/logging'

dotenv.config();

const client = new Client();
const spmgr = new ServerPreferencesCacher();
const logger = new Logger();

// The variables will return undefined if the value is an empty string too.
// Note: we don't check the validity of the variable values.
// hence we catch errors related to using invalid env variable values at reespective scopes.
if (!process.env.BOT_TOKEN || !process.env.EMAIL_ID || !process.env.EMAIL_PWD) {
  logger.log("The .env file has not been setup. Check the README for more info. Exiting application now...", LogLevel.Error, true);
  process.exit(2);
}

client.on("ready", () => {
  logger.log(`Logged in as ${client!.user!.tag}!`, LogLevel.Log, true);
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
      logger.log(`Sent welcome message to (${guildMember.id})`, LogLevel.Info, false, sp);
    }
  }, 1000);
})

client.on('guildMemberRemove', async (guildMember) => {
  deleteVerifiedUser(guildMember.id, guildMember.guild.id);
  logger.log(`Removed user (${guildMember.id}) from server's verified users table`, LogLevel.Info, false, await spmgr.getServerPreferences(guildMember.guild.id))
})

/**
 * guildDelete handler is not needed as the potential problem where kicking the bot
 * out of a setup server, deleting the verified role, and re-adding the bot will
 * make it so that the members that were previously verified can't verify again,
 * is fixed by using the autoverifyall command. It might be too risky to delete the VerifiedUsers
 * info as it might not be possible to ask all the members to re-verify.
 */
client.on('guildCreate', async (guild) => {
  let sp = await spmgr.getServerPreferences(guild.id);
  try {
    createServerPreferences(guild.id.toString());
    if (guild.systemChannel) {
      try {
        guild!.systemChannel.send(introMessage());
      } catch (err) {
        logger.log(`Unable to send message in server's system channel. ${err}`, LogLevel.Error, false, sp)
      }
    } else {
      logger.log("No system channel present in the server to send intro message in.", LogLevel.Info, false, sp)
    }
    logger.log(`Joined new server (${guild.name}). Generated ServerPreferences successfully.`, LogLevel.Info, false, sp);
  } catch (err) {
    logger.log(`Joined new server (${guild.name}). Error generating ServerPreferences.`, LogLevel.Error, false, sp);
  }
});

// Check README for commands
// Maybe commands to blacklist specific email ids?
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
   *   - msg is in sp.cmd_channel (or cmd_channel is not setup)
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

  // check for basic permissions
  if (!msg.guild!.me?.permissions.has('SEND_MESSAGES')) {
    logger.log(`Aborting command as server didn't provide SEND_MESSAGE permission`, LogLevel.Info, false, sp);
    return;
  }
  if (!msg.guild!.me?.permissions.has('EMBED_LINKS')) {
    logger.log(`Aborting command as server didn't provide EMBED_LINKS permission`, LogLevel.Info, false, sp);
    return;
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
      logger.log(`Rejeced invalid verify command from (${msg.author.id}).`, LogLevel.Info, false, sp);
      return;
    }
    logger.log(`Started evaluating verify command from (${msg.author.id}).`, LogLevel.Info, false, sp);
    let status = await startVerificationProcess(msg.content.split(" ")[1], msg.author.id.toString(), msg!.guild!.id.toString());
    if (status === StartVerificationResult.EmailAlreadyTaken) {
      msg.reply(`This email is already taken [${msg.content.split(" ")[1]}].`);
    } else if (status === StartVerificationResult.SessionAlreadyActive) {
      msg.reply(`Verification code already requested within the last 15 mins. Check your email for the code, or try again later.`);
      logger.log(`(${msg.author.id}) already has an active session, email not sent.`, LogLevel.Info, false, sp);
    } else if (status === StartVerificationResult.SuccessfullyCreated) {
      msg.reply(`Verification email sent to ${msg.content.split(" ")[1]}`);
      logger.log(`Verification email sent to (${msg.author.id}).`, LogLevel.Info, false, sp);
    } else if (status === StartVerificationResult.SuccessfullyUpdated) {
      msg.reply(`Verification re-requested successfully. Check your email for the code.`);
      logger.log(`Verification email re-sent to (${msg.author.id}).`, LogLevel.Info, false, sp);
    } else if (status === StartVerificationResult.ServerMemberAlreadyVerified) {
      msg.reply(`You are already verified in this server.`)
    } else if (status == StartVerificationResult.ActionFailed) {
      msg.reply(`An error occured trying to send the verification email. Please try again later.`);
      logger.log(`An error occured trying to send the verification email to (${msg.author.id}). ActionFailed, not InvalidEmailerLogin.`, LogLevel.Error, false, sp);
    } else if (status == StartVerificationResult.InvalidEmailerLogin) {
      msg.reply(`An error occured trying to send the verification email. Please try again later.`)
      logger.log(`Error occured trying to send email. Terminating program...`, LogLevel.Error, true, sp);
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
    if (!msg!.guild!.roles.cache.has(sp.role_id!) || !sp.role_id) { // safe to assert not-null since Map.has(null) is always false
      issues.push({
        name: "❌ VERIFIED ROLE DOESN'T EXIST",
        value: "The bot hasn't set up the Verified role that needs to be assigned. An Admin needs to call the !setup command."
      });
    }
    if (msg!.guild!.member(msg.author.id)!.roles.highest.position > msg!.guild!.me!.roles.highest.position) {
      issues.push({
        name: "❌ PRAETORIAN ROLE POSITION",
        value: `Praetorian has lower roles than the command user, and hence can't assign role to the user. 
                Fix this by moving praetorian role to a higher position in the server's roles list`
      });
    }
    if (msg!.guild!.roles.cache.get(sp.role_id!)?.position! > msg!.guild!.me!.roles.highest.position) {
      issues.push({
        name: "❌ VERIFIED ROLE POSITION",
        value: `The Verified role is higher up in the list than the bot's highest role. Fix this my lowering the Verified role to be under the Praetorian role.`
      });
    }
    if (issues.length !== 0) {
      msg.reply(errorMessage(issues));
      logger.log(`Rejeced invalid code command from (${msg.author.id}).`, LogLevel.Info, false, sp);
      return;
    }

    let status = await validateCode(msg.content.split(" ")[1], msg.author.id.toString(), msg!.guild!.id!.toString());
    if (status in ValidateCodeResult) {
      if (status == ValidateCodeResult.ValidationSuccess) {
        if (!sp.role_id) return;
        if (!msg.guild!.roles.cache.has(sp.role_id)) return;
        msg.guild!.member(msg.author.id)!.roles.add(sp.role_id);
        msg.reply(`✅ Successfully verified! Welcome to ${msg.guild!.name}!`);
        logger.log(`Successfully verified (${msg.author.id}).`, LogLevel.Info, false, sp);
      } else {
        msg.reply("❌ Entered code is invalid, please try again.");
        logger.log(`Rejected code from (${msg.author.id}).`, LogLevel.Info, false, sp);
      }
    } else if (status in GetSessionCodeResult) {
      if (status === GetSessionCodeResult.NoActiveSession) {
        msg.reply("No active verification request. Use the `verify` command to start one.");
      } else if (status === GetSessionCodeResult.LastSessionExpired) {
        msg.reply("Your last request has expired. Use the `verify` command again to try again.");
        logger.log(`Verification session expired for (${msg.author.id}).`, LogLevel.Info, false, sp);
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
      logger.log(`Rejeced invalid setup command from (${msg.author.id}).`, LogLevel.Info, false, sp);
      return;
    }

    // clear the everyone role
    let roleManager = await msg.guild!.roles.fetch();
    await roleManager.everyone.setPermissions([]).then(() => {
      msg.channel.send(`Modified \`everyone\` role's permissions`)
      logger.log(`Modified @everyone role's permissions`, LogLevel.Info, false, sp);
    });

    // create the verified role
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
        logger.log(`Created Verified role`, LogLevel.Info, false, sp);
      } catch (err) {
        logger.log("Couldn't create verified role", LogLevel.Error, false, sp);
      }
    } else {
      msg.channel.send(errorMessage([{
        name: "ℹ VERIFIED ROLE ALREADY EXISTS",
        value: "Verified role wasn't created as one previously created already exists."
      }]));
      logger.log("Verified role wasn't created as one previously created already exists", LogLevel.Info, false, sp);
    }

    // create the verification channel
    let spUpdated = await spmgr.getServerPreferences(msg.guild!.id);
    if (!msg.guild!.channels.cache.has(sp.cmd_channel!)) { // safe to assert cmd_channel as not null, since Map.has(null) will always return false
      let createdChannel = await msg.guild!.channels.create('Verification', {
        topic: "",
        nsfw: false,
        position: 1,
        permissionOverwrites: [
          {
            id: roleManager.everyone,
            allow: new Permissions(['VIEW_CHANNEL', 'SEND_MESSAGES'])
          },
          (await msg.guild!.roles.fetch()).cache.has(spUpdated.role_id!)
            ? {
              id: spUpdated.role_id!,
              deny: new Permissions(['VIEW_CHANNEL'])
            }
            : { id: roleManager.everyone } // do nothing if the role wasnt created in the previous step due to *some* error
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
      logger.log("Created and Updated #verification channel", LogLevel.Info, false, sp);
    } else {
      msg.channel.send(errorMessage([{
        name: "❌ PREVIOUSLY CREATED CHANNEL EXISTS",
        value: "A verification channel previously created by Praetorian still exists. To fix this run this command again after deleting that channel"
      }]));
      logger.log("PREVIOUSLY CREATED CHANNEL EXISTS", LogLevel.Warning, false, sp);
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
      logger.log(`Rejeced invalid configure command from (${msg.author.id}).`, LogLevel.Info, false, sp);
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
            logger.log("Didn't update part of the channel overrides as sp.role_id was null", LogLevel.Warning, false, sp);
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
        logger.log(`Rejeced invalid autoverifyall command from (${msg.author.id}).`, LogLevel.Info, false, sp);
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
      // msg.react("✅");
      msg.reply("Successfully completed `autoverifyall` command.");
      logger.log(`Successfully completed autoverifyall command (${msg.author.id}).`, LogLevel.Info, false, sp);
    }
  }

});

try {
  client.login(process.env.BOT_TOKEN);
} catch (err) {
  logger.log("Invalid BOT_TOKEN env variable. Please check it before relaunching the bot.", LogLevel.Error, true);
  process.exit(2);
}
