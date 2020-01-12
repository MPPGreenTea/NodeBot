/**
 * NodeBot BETA v1.27.19
 * Coded by Buko Pandan
 * 
 * This is the body of NodeBot where most data is received from the server and
 * where most data is sent in return. This script relies on settings which can
 * be found in the Data folder.
 */
(function (exports) {
	exports(function (node, opt) {
		const bot = {};
		
		/*/ Bot variables - Do not rename /*/
		bot.developer = false;
		bot.version = "";
		bot.channel = "";
		
		bot.client = require(__dirname + "/Client.js");
		bot.buffer = [];
		
		bot.commands = [];
		bot.prefix = "";
		
		bot.stamp = -1;
		bot.ping = 0;
		
		bot.ping_intv = -1;
		
		bot.start = Date.now();
		
		if (typeof opt == "object") {
			if (typeof opt.channel == "string") bot.channel = opt.channel;
			if (typeof opt.version == "string") bot.version = opt.version;
			if (typeof opt.developer == "boolean") bot.developer = opt.developer;
		}
		/*/ Bot variables - Do not rename /*/
		
		/*/ Bot client - Do not modify! /*/
		bot.client = new bot.client("ws://www.multiplayerpiano.com:8080");
		
		bot.client.on("t", function (message) {
			bot.ping = Date.now() - bot.stamp;
		});
		
		bot.client.status = {};
		bot.client.status.packets_received = 0;
		bot.client.status.packets_sent = 0;
		bot.client.status.packets_to_send = 0;
		
		bot.client.on("Packet", function (message) {
			bot.client.status.packets_received += message;
		});
		
		bot.client.on("Packet Sent", function (message) {
			bot.client.status.packets_sent += message;
		});
		
		node.print("NodeBot is connecting to " + bot.client.uri + " [Channel: " + bot.channel + "]");
		
		bot.client.setChannel(bot.channel);
		bot.client.start();
		
		bot.client.ws.addEventListener("open", function () {
			node.print("Server connection established in " + (Date.now() - bot.start) + "ms");
			
			bot.ping_intv = setInterval(function () {
				if (bot.client.isConnected()) {
					bot.stamp = Date.now();
					bot.client.sendArray([{ m: "t", e: Date.now() }]);
				}
			}, 2000);
		});
		bot.client.ws.addEventListener("close", function () {
			node.print("NodeBot has been disconnected from the server");
		});
		/*/ Bot client - Do not modify! /*/
		
		/*/ Bot utilities - Do not erase /*/
		/* Setting manager */
		bot.settings = {};
		bot.settings.data = {};
		bot.settings.get = function (id) {
			return bot.settings.data[id];
		};
		bot.settings.set = function (id, val) {
			bot.settings.data[id] = val;
			bot.settings.save();
		};
		bot.settings.save = function () {
			node.filesystem.writeFileSync(__dirname + "/../Data/Settings.txt", JSON.stringify(bot.settings.data), "utf8");
		};
		bot.settings.load = function () {
			bot.settings.data = JSON.parse(node.filesystem.readFileSync(__dirname + "/../Data/Settings.txt", "utf8"));
		};
		
		bot.settings.load();
		
		/* Chat buffer */
		bot.buffer_intv = setInterval(function () {
			if (bot.buffer.length > bot.settings.get("buffer_max")) {
				bot.buffer.push(node.load("buffer_max").replace("-", bot.settings.get("bufer_max")));
				bot.buffer = bot.buffer.slice(0, bot.settings.get("buffer_max"));
			}
			
			if (bot.buffer.length < 1) return;
			let message = bot.buffer.shift();
			
			bot.client.status.packets_to_send = bot.buffer.length - 1;
			if (message.length > 510) {
				let left = message.substring(0, 510) + "…";
				let right = "…" + message.substring(510);
				
				bot.buffer.unshift(right);
				bot.client.sendArray([{ m: "a", message: left }]);
				return;
			}
			
			bot.client.sendArray([{ m: "a", message: message }]);
		}, bot.settings.get("buffer_intv"));
		bot.message = function (msg) {
			bot.buffer.push(msg);
		};
		
		/* Level manager */
		bot.permissions = {};
		bot.permissions.admins = bot.settings.get("admins");
		bot.permissions.bans = bot.settings.get("bans");
		bot.permissions.get_level = function (id) {
			if (bot.permissions.admins.indexOf(id) != -1)
				return 2;
			if (bot.permissions.bans.indexOf(id) != -1)
				return 0;
			return 1;
		};
		bot.permissions.save = function () {
			bot.settings.set("admins", bot.permissions.admins);
			bot.settings.set("bans", bot.permissions.bans);
		};
		
		/* Command register */
		bot.prefix = bot.settings.get("prefix");
		bot.register_command = function (name, description, level, usage, argument_option, argument_amt, callback) {
			bot.commands.push({ name, description, level, usage, argument_option, argument_amt, callback });
		};
		bot.run_command = function (name, args, user) {
			if (bot.permissions.get_level(user._id) == 0) return;
			let command;
			for (let i = 0; i < bot.commands.length; i++) {
				if (bot.commands[i].name == name && bot.settings.get("command_case") == "true") {
					command = bot.commands[i];
				} else {
					if (bot.settings.get("command_case") == "false" && bot.commands[i].name.toLowerCase() == name.toLowerCase()) {
						command = bot.commands[i];
					}
				}
			}
			if (command == undefined) {
				bot.message("Unknown command. Type " + bot.prefix + "help for a list of commands.");
				return;
			}
			if (bot.permissions.get_level(user._id) < command.level) {
				bot.message("You need to be level " + command.level + " to access this command. [Your level: " + bot.permissions.get_level(user._id) +  "]");
				return;
			}
			if (command.argument_option && args.length != argument_amt) {
				bot.messages("The command requires " + command.argument_amt + " paramaters");
				return;
			}
			try {
				command.callback(args, user);
			} catch (e) {
				bot.message("An error has occurred while running this command. Check the bot's terminal to view the error.");
				node.print(e);
			}
		};
		bot.process_chat = function (message, user) {
			if (message.slice(0, bot.prefix.length) != bot.prefix)
				return;
			bot.run_command(message.split(" ")[0].substring(bot.prefix.length), message.split(" ").slice(1), user);
		};
		
		bot.client.on("a", function (message) {
			bot.process_chat(message.a, message.p);
			node.print(new Date().toString().split(" ")[4] + ": #" + message.p._id + " [" + message.p.name + "]: " + message.a);
		});
		
		bot.readline = require("readline");
		bot.interface = bot.readline.createInterface({
		  input: process.stdin,
		  output: process.stdout
		});

		bot.interface.on("line", function (line) {
			bot.message(line);
		});
		
		bot.getPlayerById = function (id) {
			return Object.keys(bot.client.ppl).filter(id => bot.client.ppl[id]._id == id)[0];
		};
		bot.getPlayerByName = function (name) {
			return Object.keys(bot.client.ppl).filter(id => bot.client.ppl[id].name == name)[0];
		};
		bot.getPlayerByNameC = function (name) {
			return Object.keys(bot.client.ppl).filter(id => bot.client.ppl[id].name.toLowerCase() == name.toLowerCase())[0];
		};
		bot.getPlayersByName = function (name) {
			return Object.keys(bot.client.ppl).filter(id => bot.client.ppl[id].name.indexOf(name) >= 0);
		};
		bot.getPlayersByNameC = function (name) {
			return Object.keys(bot.client.ppl).filter(id => bot.client.ppl[id].name.toLowerCase().indexOf(name.toLowerCase()) >= 0);
		};
		/*/ Bot utilities - Do not erase /*/
		
		/*/ Bot commands /*/
		/* Level 1 commands */
		bot.register_command("help", "Shows the list of commands you can access", 1, "help <command name>", false, 1, function (args, user) {
			if (args.length > 0) {
				let command;
				for (let i = 0; i < command_list.legnth; i++) {
					if (bot.commands[i].name == args[0] && bot.settings.get("command_case") == "true") {
						command = bot.commands[i];
					} else {
						if (bot.settings.get("command_case") == "false" && bot.commands[i].name.toLowerCase() == args[0].toLowerCase()) {
							command = bot.commands[i];
						}
					}
				}
				if (command == undefined) {
					bot.message("Unknown command");
					return;
				}
				bot.message(command.name + ": [Description: " + command.description + "] [Usage: " + command.usage + "]");
				return;
			}
			
			var level = bot.permissions.get_level(user._id);
			var command_list = bot.commands.filter(function (command) {
				return level >= command.level;
			}).sort(function (a, b) {
				return b.level - a.level;
			});
			
			var output = "Commands you can access [Your level: " + level + "]: ";
			for (let i = 0; i < command_list.length; i++) {
				output += (i != 0 ? ", " : "") + command_list[i].name + " [" + command_list[i].level + "]";
			}
			
			bot.message(output);
		});
		bot.register_command("about", "Shows the bot's information", 1, "about", false, 1, function (args, user) {
			bot.message("NodeBot v" + bot.version + ": Programmed on 11/27/19 by Buko Pandan. It is the organized and neater version of Utility Bot which was created on 8/6/2018");
		});
		
		/* Level 2 commands*/
		bot.register_command("script", "Runs a script", 2, "script <script>", false, 2, function (args, user) {
			try {
				bot.message("Output: " + JSON.parse(eval(args.join(" "))));
			} catch (e) {
				bot.message("Error: " + e.toString());
			}
		});
		bot.register_command("save", "Saves the settings", 2, "save", false, 2, function (args, user) {
			bot.permissions.save();
			bot.settings.save();
			bot.message("Settings have been saved");
		});
		bot.register_command("load", "Loads the settings", 2, "load", false, 2, function (args, user) {
			bot.settings.load();
			bot.message("Settings have been loaded");
		});
		bot.register_command("stop", "Terminates the bot", 2, "stop", false, 2, function (args, user) {
			bot.settings.save();
			bot.message("Bot is closing...");
			process.exit(0);
		});
		bot.register_command("ban", "Saves the settings", 2, "save", true, 1, function (args, user) {
			let target = bot.getPlayerById(args[0]);
			if (typeof target == "undefined") {
				bot.message("Could not find user");
				return;
			}
			let level = bot.permissions.get_level(target._id);
			if (level == 0) {
				bot.message("The user is already banned!");
				return;
			}
			if (level == 2) {
				bot.permissions.admins.splice(bot.permissions.admins.indexOf(target._id), 1);
			}
			bot.permissions.bans.push(target._id);
			bot.settings.save();
			bot.message("Banned " + target._id);
			bot.settings.save();
		});
		bot.register_command("unban", "Saves the settings", 2, "save", true, 1, function (args, user) {
			let target = bot.getPlayerById(args[0]);
			if (typeof target == "undefined") {
				bot.message("Could not find user");
				return;
			}
			let level = bot.permissions.get_level(target._id);
			if (level != 0) {
				bot.message("The user isn't banned!");
				return;
			}
			bot.permissions.bans.splice(bot.permissions.bans.indexOf(target._id), 1);
			bot.settings.save();
			bot.message("Unbanned " + target._id);
			bot.settings.save();
		});
		/*/ Bot commands /*/
	});
})(function (package) {
	module.exports = package; 
});