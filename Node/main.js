/**
 * NodeBot BETA v1.27.19
 * Coded by Buko Pandan
 *
 * This is the main class of the bot that handles most of the libraries
 * and scripts that are loaded. It also works with command line and handles
 * the arguments.
 */
(function (process_args) {
	const node = {};
	node.print = console.log;
	node.version = "1.27.19";
	
	node.filesystem = require("fs");
	node.strings = {};
	
	node.strings.load = function (id) {
		return JSON.parse(node.strings.read("Strings.txt"))[id];
	};
	node.strings.store = function (id, dat) {
		let data = JSON.parse(node.filesystem.readFileSync(__dirname + (custom || "/../Strings.txt"), "utf8"));
		data[id] = dat;
		node.strings.write("Strings.txt", data);
	};
	
	node.strings.read = function (file) {
		return node.filesystem.readFileSync(__dirname + "/../Data/" + file, "utf8");
	};
	
	node.strings.write = function (file, data) {
		node.filesystem.writeFileSync(__dirname + "/../Data/" + file, JSON.stringify(data), "utf8");
	};
	
	node.bot = require(__dirname + "/bot.js");
	
	if (process_args.length < 1) {
		node.print(node.strings.load("help_message"));
		process.exit(-1);
	}
	
	let command = false;
	let channel = "lobby";
	let developer = false;
	for (let i = 0; i < process_args.length; i++) {
		if (command == true) {
			if (process_args[i] != "-c" && process_args[i] != "-d" && process_args[i] != "-s") {
				channel = process_args[i];
				command = false;
				continue;
			}
		} if (process_args[i] == "-c") {
			command = true;
		} else if (process_args[i] == "-d") {
			if (command == true) {
				node.print(node.strings.load("missing_args"));
				process.exit(-1);
			}
			developer = true;
			command = false;
		} else if (process_args[i] == "-s") {
			if (command == true) {
				node.print(node.strings.load("missing_args"));
				process.exit(-1);
			}
			try {
				node.bot(node, {
					channel,
					developer,
					version: node.version
				});
			} catch (e) {
				node.print("An exception has occurred while running NodeBot!");
				node.print(e);
				process.exit(-1);
			}
		} else {
			node.print(node.strings.load("unexpected_args"));
			process.exit(-1);
		}
	}
})(process.argv.slice(2));