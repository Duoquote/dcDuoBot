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

const sqlite3 = require('sqlite3').verbose();

var db = new sqlite3.Database(conf.sqlite, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) throw err;
  console.log(`Connected to the sqlite database at "${conf.sqlite}"`);
});

// Create main database tables.
db.run(`
  CREATE TABLE IF NOT EXISTS servers(
  	'id'	INTEGER PRIMARY KEY AUTOINCREMENT,
  	'dc_id'	TEXT UNIQUE NOT NULL,
  	'lang'	TEXT,
  	'prefix'	TEXT
  );
  `, (err)=>{
    if (err) throw err;
  })

var serverData = {}
function rData(dc_id = null) {
  if (dc_id) {
    db.get(`
      SELECT * FROM servers WHERE dc_id = $dc_id;
      `, {$dc_id: dc_id}, (err, data)=>{
        serverData[data.dc_id] = data
      })
  } else {
    db.all(`
      SELECT * FROM servers;
      `, (err, data)=>{
        data.forEach(server => {
          serverData[server.dc_id] = server
        })
        console.log(serverData);
      })
  }
}

rData();




// const MongoClient = require('mongodb').MongoClient;

// // I used this function to compare two objects, was good, may reference later for
// // other purposes. Needs some fix though, Arrays are not included in comparison.
// function recurseObj(obj, ind=null) {
//   var data = [];
//   for (var k in obj) {
//     if (k == "validate") {
//       continue;
//     }
//     if (typeof obj[k] == "object") {
//       recurseObj(obj[k], (ind) ? (`${ind}.${k}`):(k)).forEach((e)=>{
//         data.push(e)
//       })
//     } else {
//       data.push(`${(ind) ? (ind+"."+k):k}:${obj[k]}`)
//     }
//   }
//   return data;
// }
//
// Discord.Presence.prototype.validate = function(comp) {
//   obj = [
//     recurseObj(this),
//     recurseObj(comp)
//   ]
//   if (obj[0].length != obj[1].length) {
//     return false;
//   } else {
//     for (var i = 0; i < obj[0].length; i++) {
//       if (obj[0][i] != obj[1][i]) {
//         return false;
//       }
//     }
//     return true;
//   }
// }


// // Abandoned using mongodb for now, will use sqlite to store in file.


// // Will add a config option for mongoURL variable.
// var mongoURL = "mongodb://localhost:27017/discord";

// function rServerData(callback=null) {
//
// }

// function reloadServerData(callback=null) {
//   MongoClient.connect(mongoURL, (err, db)=>{
//     if (err) throw err;
//     var dbo = db.db("discord");
//     dbo.collection("bot_data").find({}).toArray((err, resp)=>{
//       if (err) throw err;
//       resp.forEach((sw)=>{
//         serverData[sw.id] = sw;
//       })
//       db.close(false, ()=>{
//         if (typeof callback == "function") {
//           callback();
//         }
//       });
//     })
//   })
// }


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

// reloadServerData();

client.on('ready', () => {
  console.log(`Bot "${client.user.tag}" is ready!`);
  // console.log(client.guilds.get("393057072079568907").presences);
  //console.log(client);
});



client.on('message', msg => {
  if (msg.author.bot) return;
  var prx;
  var lang;
  if (msg.guild.id in serverData) {
    if (serverData[msg.guild.id].prefix) {
      prx = serverData[msg.guild.id].prefix;
    } else {
      prx = conf.prefix;
    }
    if (serverData[msg.guild.id].lang) {
      lang = serverData[msg.guild.id].lang;
    } else {
      lang = conf.lang;
    }
  } else {
    prx = conf.prefix;
    lang = conf.lang;
  }

  // Will add language selection later.
  if(msg.content.indexOf(prx) !== 0) return;
  var cmdDef = cmdParser(msg.content, prx);

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
        .addField(cmdLang[lang].profile.id, user.id)
        .addField(cmdLang[lang].profile.join, new Date(user.lastMessage.member.joinedTimestamp)
          .toLocaleDateString(lang, {
            dateStyle: "full", timeStyle: "medium"
          }))
        .setFooter(cmdLang[lang].profile.generated, `https://cdn.discordapp.com/avatars/${client.user.id}/${client.user.avatar}.png`)
        .setTimestamp(new Date())
      msg.reply(profile);
    }


    // Set prefix command.
    if (cmdDef.cmd == "setp") { // Add permission check when changing prefix.
      if (cmdDef.params.length == 1) {
        if (cmdDef.params[0].length <= 2) {
          if (cmdDef.params[0].match(new RegExp(/^([^\w\s\/]|_){1,2}$/, "g"))) {
            db.run(`
              INSERT INTO servers(
                dc_id,
                prefix
              ) VALUES (
                $dc_id,
                $prefix
              )
              ON CONFLICT(dc_id) DO UPDATE SET
                prefix = $prefix
              WHERE dc_id = $dc_id;
              `, {$dc_id: msg.guild.id, $prefix: cmdDef.params[0]}, (err)=>{
              if (err) throw err;
              rData(msg.guild.id);
            })
            // MongoClient.connect(mongoURL, (err, db)=>{
            //   if (err) throw err;
            //   var dbo = db.db("discord");
            //   dbo.collection("bot_data").updateOne({id: msg.guild.id}, {$set: {prefix: cmdDef.params[0]}}, { upsert: true })
            //   db.close();
            //   reloadServerData()
            // })
            msg.reply(cmdLang[lang].setp.set)
          } else {
            msg.reply(cmdLang[lang].setp.perror2)
          }
        } else {
          msg.reply(cmdLang[lang].setp.perror1)
        }
      } else {
        msg.reply(cmdLang[lang].setp.help)
      }
    }

    if (cmdDef.cmd == "setl") {
      if (cmdDef.params.length == 1) {
        if (cmdDef.params[0].toUpperCase() in cmdLang) {
          db.run(`
            INSERT INTO servers(
              dc_id,
              lang
            ) VALUES (
              $dc_id,
              $lang
            )
            ON CONFLICT(dc_id) DO UPDATE SET
              lang = $lang
            WHERE dc_id = $dc_id;
            `, {$dc_id: msg.guild.id, $lang: cmdDef.params[0]}, (err)=>{
            if (err) throw err;
            rData(msg.guild.id);
          })
          // MongoClient.connect(mongoURL, (err, db)=>{
          //   if (err) throw err;
          //   var dbo = db.db("discord");
          //   dbo.collection("bot_data").updateOne({id: msg.guild.id}, {$set: {lang: cmdDef.params[0].toUpperCase()}}, {upsert: true});
          //   db.close(false, ()=>{
          //     reloadServerData(()=>{
          //       msg.reply(cmdLang[cmdDef.params[0].toUpperCase()].setl.success)
          //     })
          //   });
          // })
        } else {
          msg.reply(cmdLang[lang].setl.notavail)
        }
      } else {
        msg.reply(cmdLang[lang].setl.help)
      }
    }
  }
});

process.on("exit", ()=>{
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Close the database connection.');
  });
})

client.login(dcToken.token);

////////////////////////////////////////////////////////////////////////////////
// // Presence tracking feature turned out to be SOOO buggy, so I am going to
// // abandon it, at least for now.
//
//
//
// var presenceLast = [{}, {}];
//
// // Added presence tracking feature.
// client.on("presenceUpdate", (oldPres, newPres)=> {
//   if (newPres.user.bot) return;
//   // Format:
//   // {
//   //   user: "user_id",
//   //   timestamp: 1578852296892,
//   //   presence: Object -> Discord.Presence data
//   // }
//   var pres = {
//     user: newPres.user.id,
//     timestamp: new Date(),
//     presence: newPres.guild.presences.get(newPres.user.id)
//   }
//   console.log(pres.presence);
//   console.log(oldPres.frozenPresence);
//   console.log("-------------------------------------------------------------");
//   if (pres.user in presenceLast[0]) {
//     if (JSON.stringify(pres.presence) != JSON.stringify(presenceLast[0][pres.user])) {
//       insertPresence(pres);
//     }
//     if (pres.user in presenceLast[1]) {
//       if (JSON.stringify(oldPres.frozenPresence) != JSON.stringify(presenceLast[1][pres.user])) {
//         pres.presence = oldPres.frozenPresence;
//         insertPresence(pres);
//       }
//     }
//     presenceLast[1][pres.user] = presenceLast[0][pres.user];
//   } else {
//     insertPresence(pres);
//   }
//   presenceLast[0][pres.user] = newPres.guild.presences.get(newPres.user.id);
//
// })
//
//
// // Will move this function into another file to store all specific functions
// // in one place later.
// function insertPresence(pres) {
//   MongoClient.connect(mongoURL, function(err, db) {
//     if (err) throw err;
//     var dbo = db.db("discord");
//     dbo.collection("user_presence_history").insertOne(pres, (err, res)=>{
//       if (err) throw err;
//       // console.log(`Saved data for user ${upd.user.id}.`);
//       db.close();
//     });
//   });
// }
