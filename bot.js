const Discord = require("discord.js");

const { startVerificationProcess, validateCode, createServerPreferences } = require("./lib/backend");
const { isValidCodeCommand, isValidVerifyCommand, isValidConfigureCommand, isSetChannelCommand } = require("./lib/utilities");
const { ServerPreferencesCache } = require("./lib/caching");
const serverPref = new ServerPreferencesCache();
const token = require("./token");

const client = new Discord.Client();

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('guildCreate', (guild) => {
  createServerPreferences(guild.id.toString());
  console.log(`Joined new server [${guild.id}: ${guild.name}]. Generated ServerPreferences successfully.`);
});

/*  Commands:
 *      !help -- prints a help message
 *      !verify <email> -- starts verification for the specified email id
 *      !code <code> -- validates the provided code
 */
client.on("message", (msg) => {
  if (msg.author.bot) return;

  // Get the server preferences
  serverPref.getServerPreferences(msg.guild.id.toString(), (sp) => {
    const prefix = sp.prefix;
    serverPref.isCmdChannelSetup(msg.guild.id.toString(), (isChannelSetup) => {
      // make sure message is in the right channel
      if (isChannelSetup && !isSetChannelCommand(msg)) {
        if (msg.channel.id != sp.cmd_channel) return;
      } else {
        if (
          !msg.channel.name.toLowerCase().includes("verification") &&
          !isSetChannelCommand(msg)
        ) return;
      }

      // Can't call this without the roles being setup. Combine both into single command?
      if (msg.content.toLowerCase().startsWith(`${prefix}setup`)) {
        throw Error("NotImplemented");
      }

      if (msg.content.toLowerCase().startsWith("!help")) {
        img = `https://thumbs-prod.si-cdn.com/xmx0u6dT5Mdqq_yuy1WrKVVE9AA=/800x600/filters:no_upscale()/
https://public-media.si-cdn.com/filer/82/41/82412cad-4780-4072-8f62-7fb13becb363/barcode.jpg`
        let embedMessage = new Discord.MessageEmbed()
          .setTitle("Praetorean")
          .setColor('#0099ff')
          .setAuthor('Help Message', img)
          .setDescription('!')
          .addFields(
            { name: '!verify', value: 'starts verification for the specified email id' },
            { name: '!code', value: 'validates the provided code' },
            { name: '!domain', value: 'sets your domain name' }
          )
          .setThumbnail(img)
          .setFooter('Version 0.8.0', img)

        msg.channel.send(embedMessage);
      }
      if (msg.content.toLowerCase().startsWith(`${prefix}verify`)) {
        if (!isValidVerifyCommand(msg)) {
          msg.reply("Invalid command. Must be !verify <*email*>, where *email* is a valid email address.");
          return;
        }
        if (msg.content.split(" ")[1].split("@")[1].toLowerCase() !== sp.domain) {
          msg.reply(`The email must be part of the \`${sp.domain}\` domain. Please try again with the right email address [example@${sp.domain}].`);
          return;
        }

        startVerificationProcess(msg.content.split(" ")[1], msg.author.id.toString(), msg.guild.id.toString(), (status) => {
          if (status === "EmailAlreadyTaken") {
            msg.reply(`This email is already taken [${msg.content.split(" ")[1]}].`);
          } else if (status === "SessionAlreadyActive") {
            msg.reply(`Verification code already requested within the last 15 mins. Check your email for the code, or try again later.`);
          } else if (status === "SuccessfullyCreated") {
            msg.reply(`Verification email sent to ${msg.content.split(" ")[1]}`);
          } else if (status === "SuccessfullyUpdated") {
            msg.reply(`Verification re-requested successfully. Check your email for the code.`);
          } else if (status === "ServerMemberAlreadyVerified") {
            msg.reply(`you are already verified in this server.`)
          }
        });
      }

      if (msg.content.toLowerCase().startsWith(`${prefix}code`)) {
        if (!isValidCodeCommand(msg)) {
          msg.reply("Invalid command. Must be !code <*code*>, where *code* is a 6-digit number.");
          return;
        }
        validateCode(msg.content.split(" ")[1], msg.author.id.toString(), msg.guild.id.toString(), (isSuccess) => {
          if (isSuccess === true) {
            msg.guild.roles.fetch()
              .then((roles) => {
                return roles.cache.find(r => r.name.toLowerCase() == "verified");
              })
              .then((role) => msg.guild.member(msg.author.id).roles.add(role));
            msg.reply(`Successfully verified! Welcome to ${msg.guild.name}!`);
          } else if (isSuccess === 'NoActiveSession') {
            msg.reply("No active verification request. Use the `!verify <email>` command to start one.");
          } else if (isSuccess === 'LastSessionExpired') {
            msg.reply("Your last request has expired. Use the `!verify <email>` command again to try again.");
          } else {
            msg.reply("Entered code is invalid, please try again.");
          }
        });
      }

      if (msg.content.toLowerCase().startsWith(`${prefix}configure`)) {
        if (!isValidConfigureCommand(msg)) {
          msg.reply("Invalid command. Check help for usage.")
          return;
        }
        let cmdParts = msg.content.split(" ");
        if (cmdParts[1].toLowerCase() === "domain") {
          serverPref.setServerPreferences({
            "server_id": sp.server_id,
            "domain": cmdParts[2],
            "prefix": sp.prefix,
            "cmd_channel": sp.cmd_channel
          });
          msg.reply(`Successfully updated domain filter to \`${cmdParts[2]}\``);
        } else if (cmdParts[1].toLowerCase() === "prefix") {
          serverPref.setServerPreferences({
            "server_id": sp.server_id,
            "domain": sp.domain,
            "prefix": cmdParts[2],
            "cmd_channel": sp.cmd_channel
          });
          msg.reply(`Successfully updated command prefix to \`${cmdParts[2]}\``);
        } else if (cmdParts[1].toLowerCase() === "setcmdchannel") {
          serverPref.setServerPreferences({
            "server_id": sp.server_id,
            "domain": sp.domain,
            "prefix": sp.prefix,
            "cmd_channel": msg.channel.id.toString()
          });
          msg.reply(`Successfully updated command channel to \`${msg.channel.name}\``);
        }
      }
    });
  });
});

client.login(token);
