define(function (require, exports) {
    "use strict";

    var DomPrinter = function () {
        this.valueNodeExpected = [];
        this.text = "";
        this.indent = 0;
    };
    
    var PairModule = require("./Pair");

    (function () {
        this.printModule = function (pair) {
            this.text = "";
            this.indent = 0;
            this.valueNodeExpected.push(false);
            this.printPair(pair);
            this.valueNodeExpected.pop();
            return this.text;
        };
        this.printPair = function(pair) {
            this.printNodeStart(pair);

            if (pair.value != null) {
                this.text += PairModule.delimiterToString(pair.delimiter);
                this.text += " ";
                this.text += this.quoteTypeToChar(pair.valueQuotesType);
                this.printValue(pair);
                this.text += this.quoteTypeToChar(pair.valueQuotesType);
            }
            else if (pair.block != null) {
                this.text += ":\n";
                this.indent++;
                for (var item of pair.block) {
                    this.valueNodeExpected.push(false);
                    this.printPair(item);
                    this.valueNodeExpected.pop();
                }
            }
            else if (pair.objectValue != null) {
                this.text += ":= ";
                this.valueNodeExpected.push(true);
                this.printPair(pair.objectValue);
                this.valueNodeExpected.pop();
            }
            if (pair.block != null) {
                this.indent--;
            }
            else {
                this.text += "\n";
            }
        };
        this.printNodeStart = function(pair) {
            if (this.valueNodeExpected[this.valueNodeExpected.length-1]) {
                this.text += "\t";
                this.text += " ";
                this.text += this.quoteTypeToChar(pair.nameQuotesType);
                this.text += pair.name;
                this.text += this.quoteTypeToChar(pair.nameQuotesType);
            }
            else {
                this.text += pair.nameInterval ? ("0" + pair.nameInterval.begin.line).slice(-2) : "00";
                this.text += ":";
                this.text += pair.nameInterval ? ("0" + pair.nameInterval.begin.column).slice(-2) : "00";
                for (var i = 0; i < this.indent; i++) {
                    this.text += "\t";
                }
                this.text += "\t";
                this.text += " ";
                this.text += this.quoteTypeToChar(pair.nameQuotesType);
                this.text += pair.name;
                console.log(pair.name);
                //return;
                this.text += this.quoteTypeToChar(pair.nameQuotesType);
            }
            
        };
        this.quoteTypeToChar = function(quoteType) {
            switch (quoteType) {
                case 2:
                    return '"';
                case 1:
                    return '\'';
                default:
                    return '`';

            }
        };
        this.printValue = function(pair) {
            this.text += pair.value.replace("\r\n", "\n").replace("\n", "\\n").replace("\t", "\\t");
        };
    }).call(DomPrinter.prototype);
    exports.DomPrinter = DomPrinter;
});