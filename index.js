var Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const conf = require("./conf.js");
const cmdLang  = require("./cmdLang.js");
const MongoClient = require('mongodb').MongoClient;

// Will add a config option for mongoURL variable.
var mongoURL = "mongodb://localhost:27017/discord";
var serverData = {}

function reloadServerData() {
  MongoClient.connect(mongoURL, (err, db)=>{
    if (err) throw err;
    var dbo = db.db("discord");
    dbo.collection("bot_data").find({}).toArray((err, resp)=>{
      if (err) throw err;
      resp.forEach((sw)=>{
        serverData[sw.id] = sw;
      })
      return;
    })
  })
}

reloadServerData();

var dcToken;

if (fs.existsSync("./dcToken.js")) {
  dcToken = require('./dcToken.js');
} else {
  console.log("Put your token inside 'dcTokenExample.js' and rename it to 'dcToken.js'");
  exit();
}


function cmdParser(cmdIn, prefix) {
  return cmdIn.split(/ +/)
    .reduce((acc, arg, ind)=>{
      if (arg.indexOf(prefix) == 0 && ind == 0) {
        acc["cmd"] = arg.replace(prefix, "");
        return acc;
      } else {
        acc["params"].push(arg);
        return acc;
      }
    }, {
      "params": []
    });
}



client.on('ready', () => {
  console.log(`Bot "${client.user.tag}" is ready!`);
  //console.log(client);
});



client.on('message', msg => {
  if (msg.author.bot) return;
  var prx;
  if (msg.guild.id in serverData) {
    if ("prefix" in serverData[msg.guild.id]) {
      prx = serverData[msg.guild.id].prefix;
    } else {
      prx = conf.prefix;
    }
  } else {
    prx = conf.prefix;
  }

  // Will add language selection later.
  var lang = conf.lang;
  if(msg.content.indexOf(prx) !== 0) return;
  var cmdDef = cmdParser(msg.content, prx);
  client.users.get(msg.author.id)
  if (cmdDef) {


    // Profile command.
    if (cmdDef.cmd == "profile" && cmdDef.params.length == 0) {
      var user = client.users.get(msg.author.id)
      var avatarURL = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
      var profile = new Discord.RichEmbed()
        .setColor("#ffd754")
        .setTitle(`${user.username}#${user.discriminator}`)
        .setURL(`${avatarURL}?size=1024`)
        .setThumbnail(avatarURL)
        .addField(cmdLang[conf.lang].profile.id, user.id)
        .addField(cmdLang[conf.lang].profile.join, new Date(user.lastMessage.member.joinedTimestamp)
          .toLocaleDateString(conf.lang, {
            dateStyle: "full", timeStyle: "medium"
          }))
        .setFooter(cmdLang[conf.lang].profile.generated, `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.png`)
        .setTimestamp(new Date())
      msg.reply(profile);
    }


    // Set prefix command.
    if (cmdDef.cmd == "setp") { // Add permission check when changing prefix.
      if (cmdDef.params.length == 1) {
        if (cmdDef.params[0].length <= 2) {
          if (cmdDef.params[0].match(new RegExp(/^([^\w\s\/]|_){1,2}$/, "g"))) {
            MongoClient.connect(mongoURL, (err, db)=>{
              if (err) throw err;
              var dbo = db.db("discord");
              dbo.collection("bot_data").updateOne({id: msg.guild.id}, {$set: {prefix: cmdDef.params[0]}}, { upsert: true })
            })
            reloadServerData();
            msg.reply(cmdLang[conf.lang].setp.set)
          } else {
            msg.reply(cmdLang[conf.lang].setp.perror2)
          }
        } else {
          msg.reply(cmdLang[conf.lang].setp.perror1)
        }
      } else {
        msg.reply(cmdLang[conf.lang].setp.help)
      }
    }




    if (cmdDef.cmd == "setl" && cmdDef.params.length == 1) {

    }
  }
});

// // Make the program clear last presence data after a while.
// setInterval(()=>{
//   for (var presence in presenceLast) {
//     console.log(presenceLast);
//     console.log(new Date() - presenceLast[presence].timestamp);
//     if (new Date() - presenceLast[presence].timestamp > 5000) {
//       delete presenceLast[presence];
//       console.log(`Deleted last presence data for user ${presenceLast[presence].user}.`);
//     }
//   }
// }, 3000)

var presenceLast = {};

// Added presence tracking feature.
client.on("presenceUpdate", (oldPres, newPres)=> {
  if (newPres.user.bot) return;
  // Format:
  // {
  //   user: "user_id",
  //   timestamp: 1578852296892,
  //   presence: Object -> Discord.Presence data
  // }
  var pres = {
    user: newPres.user.id,
    timestamp: new Date(),
    presence: newPres.guild.presences.get(newPres.user.id)
  }
  if (pres.user in presenceLast) {
    if (!pres.presence.equals(presenceLast[pres.user])) {
      insertPresence(pres);
    }
  } else {
    insertPresence(pres);
  }
  presenceLast[newPres.user.id] = pres.presence;
})


// Will move this function into another file to store all specific functions
// in one place later.
function insertPresence(pres) {
  MongoClient.connect(mongoURL, function(err, db) {
    if (err) throw err;
    var dbo = db.db("discord");
    dbo.collection("user_presence_history").insertOne(pres, (err, res)=>{
      if (err) throw err;
      // console.log(`Saved data for user ${upd.user.id}.`);
      db.close();
    });
  });
}


client.login(dcToken.token);
