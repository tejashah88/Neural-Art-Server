var colors = require("colors");
var spawn = require("child_process").spawn;
var fs = require("fs");
var S = require("string");

//pre-initialization
var print = function(obj) {
	process.stdout.write(obj);
};

var println = function(obj) {
	console.log(obj);
};

var debug = function(obj) {
	print((obj + "").blue);
}

var printDone = function() {
	println("done!".green);
}

var printError = function() {
	println("error!".red);
}

var exit = function(code) {
	process.exit(code);
}

debug("Initializing Firebase...");
var firebase = require("firebase");
firebase.initializeApp({
	databaseURL: "https:\/\/neural-art-87142.firebaseio.com",
});

var db = firebase.database();
var cmdRef = db.ref("cmd");
var progressRef = db.ref("progress");
var errorRef = db.ref("error");
printDone();

debug("Initializing Google Cloud Storage...");
var bucket = require("google-cloud")({
	projectId: "neural-art-87142",
	keyFilename: "gcloud-keyfile.json"
}).storage().bucket("neural-art-87142.appspot.com");
printDone();

var error = function(msg, report) {
	println(msg.red);
	if (arguments.length > 1 && report === true) {
		errorRef.set(msg);
	}
};

var progress = function(value) {
	progressRef.set(value);
};

var runNeuralStyle = function(cmd, args) {
	debug("cmd: " + cmd + "\n");
	debug("args: " + args + "\n");
	var child = spawn(cmd, args);
	
	child.stdout.on("data", (data) => {
		//output processed here
		var newProgress = parseFloat(data);
		if (newProgress) {
			print("Progress: " + newProgress + "    \r");
			progress(newProgress);
		} else {
			print("stdout: " + data);
		}
	});
	
	child.stderr.on("data", (data) => {
		//errput processed here
		console.log("stderr: " + data);
	});
	
	child.on("close", (code) => {
		console.log("code: " + code);

		//TODO: fix callback hell
		bucket.upload("result.png", (err, file, apiRes) => {
			if (err) {
				printError();
				error("Error uploading file: " + err);
			} else {
				fs.unlinkSync("content.jpg");
				fs.unlinkSync("result.png");
				println("Ready for more!".green);
			}
		});
	});
}

cmdRef.on("value", (snapshot) => {
	debug("Received fresh data!\n");
	var shellCmd = snapshot.val() + " -output_image result.png";
	var cmdParts = shellCmd.split(" ");
	var cmd = cmdParts[0];
	var args = cmdParts.slice(1, cmdParts.length);
	
	debug("Downloading content image...");
	bucket.file("content.jpg").download({
		destination: "content.jpg"
	},(err) => {
		if (err) {
			printError();
			error("Error downloading file: " + err);
		} else {
			printDone();
			runNeuralStyle(cmd, args);
		}
	});
}, (err) => {
	error("Firebase error: " + err);
});

println("Neural Art server is ready!".green);
