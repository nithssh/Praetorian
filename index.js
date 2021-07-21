const token = require("./token");
const Discord = require("discord.js");
const { startVerificationProcess, validateCode } = require("./lib/backend");
const client = new Discord.Client();

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

/*  Commands:
 *      !verify <email> -- starts verification for the specified email id
 *      !code <code> -- validates the provided code
 */
client.on("message", (msg) => {
  if (msg.author.bot) return; // don't process bot messages

  if (msg.content.toLowerCase().startsWith("!verify")) {
    // TODO validate user input first
    startVerificationProcess(msg.content.split(" ")[1], msg.author.id); 
    msg.channel.send(`Started Verifying ${msg.author}`);
  }

  if (msg.content.toLowerCase().startsWith("!code")) {
    // TODO need input validation
    validateCode(msg.content.split(" ")[1], msg.author.id, (isSuccess) => {
      if (isSuccess === true) {
        let roleID = msg.guild.roles.cache.find(r => r.name === "Verified");
        msg.guild.member(msg.author.id).roles.add(roleID); // give role
        msg.reply("Successfully verified! Welcome to <Server X>");
      } else if (isSuccess === 'NoActiveSession') {
        msg.reply("No active verification request. Use the `!verify <email>` command to start one.");
      }  else if (isSuccess === 'LastSessionExpired') {
        msg.reply("Your last request has expired. Use the `!verify <email>` command again to try again.")
      } else {
        msg.reply("Entered code is invalid, please try again.");
      }
    });
  }
});

client.login(token);
