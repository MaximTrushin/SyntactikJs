'use strict';

require("amd-loader");

var InputStream = require("./InputStream").InputStream;
var input = new InputStream("el1 =   'text1' ");

var Parser = require("./Parser").Parser;
var parser = new Parser(input);
parser.errorListeners.push(function() {
    console.log("\u001b[31m" + arguments[0] + "\u001b[0m");
});
var pair = parser.parseModule();
console.log("\u001b[32m" + "OK" + "\u001b[0m");

