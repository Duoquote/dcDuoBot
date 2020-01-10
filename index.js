const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const conf = require("./conf.js");
const cmdLang  = require("./cmdLang.js");
var dcToken;
if (fs.existsSync("./dcToken.js")) {
  dcToken = require('./dcToken.js');
} else {
  console.log("Put your token inside 'dcTokenExample.js' and rename it to 'dcToken.js'");
  exit();
}



function cmdParser(cmdIn, prefix) {
  prefix = prefix.replace(new RegExp("([\\W])", "g"), "\\$1");
  if (cmdIn.match(new RegExp(`^${prefix}(?!\\s).*$`))) {
    return cmdIn.split(/\s/)
      .reduce((acc, arg, ind)=>{
        if (arg.match(`^${prefix}.*$`) && ind == 0) {
          acc["cmd"] = arg.replace(new RegExp(prefix), "");
          return acc;
        } else {
          acc["params"].push(arg);
          return acc;
        }
      }, {
        "params": []
      });
  } else {
    return false;
  }
}

client.on('ready', () => {
  console.log(`Logged in as "${client.user.tag}"`);
});

client.on('message', msg => {
  var command = ["profile", "profil"];
  var prx = conf.prefix;
  var cmdDef = cmdParser(msg.content, prx);
  client.users.get(msg.author.id)
  if (cmdDef) {
    if (command.includes(cmdDef.cmd) && cmdDef.params.length == 0) {
      var user = client.users.get(msg.author.id)
      var avatarURL = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
      var profile = new Discord.RichEmbed()
        .setColor("#ffd754")
        .setTitle(`${user.username}#${user.discriminator}`)
        .setURL(`${avatarURL}?size=1024`)
        .setThumbnail(avatarURL)
        .addField(cmdLang[conf.lang].profile.join, new Date(user.lastMessage.member.joinedTimestamp)
          .toLocaleDateString(conf.lang, {
            dateStyle: "full", timeStyle: "medium"
          }))
        .setFooter(cmdLang[conf.lang].profile.generated)
        .setTimestamp(new Date())
      msg.reply(profile);
    }
  }
});

client.login(dcToken.token);
