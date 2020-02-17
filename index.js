const Discord = require('discord.js');
const client = new Discord.Client();

const fs = require('fs');
const conf = require("./conf.js");
const cmdLang  = require("./cmdLang.js");
const path = require('path');
const CronJob = require('cron').CronJob;
const url = require('url');

var DC_TOKEN;
var SQLITE_FILE;
var REPO;
var USE_GIT = false;
var simpleGit;

fs.mkdirSync(path.parse(conf.sqlite).dir, {recursive: true});

if (process.env.BOT_GIT_USER && process.env.BOT_GIT_PASSWORD && process.env.BOT_GIT_REPO) {
  if (!(url.parse(process.env.BOT_GIT_REPO).host)) {
    console.log("Set `BOT_GIT_REPO` environment variable with `HTTPS` url, not `SSH`.");
    return process.exit(0);
  }

  simpleGit = require('simple-git')(path.parse(conf.sqlite).dir);

  let REPO_ORIGINAL = url.parse(process.env.BOT_GIT_REPO);
  const REPO_URL = `${REPO_ORIGINAL.protocol}//${process.env.BOT_GIT_USER}:${process.env.BOT_GIT_PASSWORD}@${REPO_ORIGINAL.host + REPO_ORIGINAL.path}`
  delete REPO_ORIGINAL;

  REPO = path.parse(url.parse(REPO_URL).path).name;

  SQLITE_FILE = `${path.parse(conf.sqlite).dir}/${REPO}/${path.parse(conf.sqlite).base}`;

  USE_GIT = true;

  if (!(fs.existsSync(path.parse(SQLITE_FILE).dir))) {
    simpleGit.clone(REPO_URL);
  } else {
    simpleGit.cwd(path.parse(SQLITE_FILE).dir)
  }

} else {
  SQLITE_FILE = conf.sqlite;
}


function saveData() {
  simpleGit.add(path.parse(SQLITE_FILE).base);
  simpleGit.commit("Added data into file.");
  simpleGit.push("origin", "master")
}

fs.mkdirSync(path.parse(SQLITE_FILE).dir, {recursive: true});


if (process.env.DC_TOKEN) {
  DC_TOKEN = process.env.DC_TOKEN;
} else {
  console.log("Set `DC_TOKEN` environment variable with you token.");
  return process.exit(0);
}

const sqlite3 = require('sqlite3').verbose();

var db = new sqlite3.Database(SQLITE_FILE, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) throw err;
  console.log(`Connected to sqlite database at "${SQLITE_FILE}"`);
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
var dataState = false;
function rData({dc_id, initData} = {dc_id: null, initData: false}) {
  if (initData) {
    db.all(`
      SELECT * FROM servers;
      `, (err, data)=>{
        if (data) {
          data.forEach(server => {
            serverData[server.dc_id] = server
          })
          console.log(serverData);
        }
      })
  } else {
    if (dc_id) {
      db.get(`
        SELECT * FROM servers WHERE dc_id = $dc_id;
        `, {$dc_id: dc_id}, (err, data)=>{
          serverData[data.dc_id] = data
          dataState = true;
        })
    } else {
      db.all(`
        SELECT * FROM servers;
        `, (err, data)=>{
          if (data) {
            data.forEach(server => {
              serverData[server.dc_id] = server
            })
            dataState = true;
          }
        })
    }
  }
}

var updateJob = new CronJob("0 0 * * * *", ()=>{
  if (dataState) {
    saveData();
    dataState = false;
  }
}, null, true);

rData({initData: true});

// reloadServerData();

function parseCmd(cmdIn, prefix) {
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

  if(msg.content.indexOf(prx) !== 0) return;

  var command = parseCmd(msg.content, prx);

  if (command) {

    // Profile command.
    if (command.cmd == "profile" && command.params.length == 0) {
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


    // Set command.
    if (command.cmd == "set") {
      if (!(msg.member.hasPermission(Discord.Permissions.MANAGE_CHANNELS))) {
        msg.reply(cmdLang.set.permission);
        return;
      }
      if (command.params.length == 0) {
        msg.reply(cmdLang[lang].set.help)
        return
      }
      if (command.params[0] == "prefix") {
        if (command.params.length == 1) {
          msg.reply(cmdLang[lang].set.prefix.help)
          return;
        }
        if (command.params[1].length > 2) {
          msg.reply(cmdLang[lang].set.prefix.help)
          return;
        }
        if (command.params[1].match(new RegExp(/^([^\w\s\/]|_){1,2}$/, "g"))) {
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
            `, {$dc_id: msg.guild.id, $prefix: command.params[1]}, (err)=>{
            if (err) throw err;
            rData({dc_id: msg.guild.id});
          })
          msg.reply(cmdLang[lang].set.prefix.set)
        } else {
          msg.reply(cmdLang[lang].set.prefix.help)
        }
      } else if (command.params[0] == "language") {
        if (command.params.length == 1) {
          msg.reply(cmdLang[lang].set.language.help)
          return;
        }
        if (command.params[1].toUpperCase() in cmdLang) {
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
            `, {$dc_id: msg.guild.id, $lang: command.params[1].toUpperCase()}, (err)=>{
            if (err) throw err;
            rData({dc_id: msg.guild.id});
            msg.reply(cmdLang[lang].set.language.set)
          })
        } else {
          msg.reply(cmdLang[lang].set.language.help)
        }
      }
    }
  }
});

process.on("SIGINT", ()=>{
  process.exit();
});
process.on("SIGTERM", ()=>{
  process.exit();
});

process.on("exit", ()=>{
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Close the database connection.');
  });
  saveData();
})

client.login(DC_TOKEN);
