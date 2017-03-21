'use strict';

require("amd-loader");

var InputStream = require("./InputStream").InputStream;
var input = new InputStream("el1");

var Parser = require("./Parser").Parser;
var parser = new Parser(input);
parser.parseModule();

