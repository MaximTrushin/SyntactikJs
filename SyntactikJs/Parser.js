define(function (require, exports, module) {
    "use strict";

    var pairModule = require("./Pair");
    var Pair = pairModule.Pair;
    var DelimiterEnum = pairModule.DelimiterEnum;

    var Parser = function (input) {
        this.input = input;
        this.errorListeners = [];
        this.wsaStack = [];
        this.pairStack = [];
        this.lineState = null;
        this.indentSymbol = 0;
        this.indentMultiplicity = 0;
    };

    (function () {
        this.parseModule = function () {
            this.resetState();

        };

        this.resetState = function () {
            this.input.reset();
            this.wsaStack = [];
            this.pairStack = [];
            var p = new Pair();
            p.name = "Module";
            p.delimiter = DelimiterEnum.C;
            this.pairStack.push(
                {
                    pair: p,
                    begin: -1,
                    end: -1,
                    indent: -1
                }
            );
            p.createBlock();

            this.indentMultiplicity = 0;
            this.lineState = new LineParsingState();

        };

    }).call(Parser.prototype);

    var ParserStateEnum = {
        Indent : 1, //New line started. Indent is checked to calculate the current pair.
        PairDelimiter : 2,
        Name : 4,
        Delimiter : 8,
        Value : 16,
        IndentMLS : 32 //Indent for multiline string
    };

    var LineParsingState = function () {
        return {
            indent: 0,
            indentBegin: 0,
            indentEnd: 0,
            inline: false,
            state: ParserStateEnum.Indent,
            chainingStarted: false,
            chainStart: null,
            reset: Reset
        };


        function Reset() {
            if (this.state !== ParserStateEnum.IndentMLS) this.state = ParserStateEnum.Indent;
            this.chainingStarted = false;
            this.chainStart = null;
            this.inline = false;
        }
    };

    exports.Parser = Parser;
});