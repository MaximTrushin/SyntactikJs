define(function (require, exports) {
    "use strict";

    var DelimiterEnum = {
        None: 0,
        E: 1,
        EE: 2,
        C: 3,
        CC: 4,
        CCC: 5,
        EC: 6,
        ECC: 7,
        CE: 8
    };

    var Pair = function (name) {
        this.name = name;
        this.value = "";
        this.block = null;
        this.objectValue = null;
        this.delimiter = DelimiterEnum.None;
        this.nameQuotesType = 0; // 0 - no qoutes, 1 - single, 2 - double
        this.valueQuotesType = 0; // 0 - no qoutes, 1 - single, 2 - double
        this.blockIndent = -1;
        this.nameInterval = {
            begin: {
                index: -1,
                line: 0,
                column: 0
            },
            end: {
                index: -1,
                line: 0,
                column: 0
            }
        };
        this.valueInterval = {
            begin: {
                index: -1,
                line: 0,
                column: 0
            },
            end: {
                index: -1,
                line: 0,
                column: 0
            }
        };
    };

    (function () {
            this.createBlock = function () {
                this.block = [];
                this.value = null;
                this.objectValue = null;

            };   
            
    }).call(Pair.prototype);


    function delimiterToString(delimiter) {
        switch (delimiter) {
            case DelimiterEnum.C:
                return ":";
            case DelimiterEnum.CC:
                return "::";
            case DelimiterEnum.CCC:
                return ":::";
            case DelimiterEnum.E:
                return "=";
            case DelimiterEnum.EC:
                return "=:";
            case DelimiterEnum.ECC:
                return "=::";
            case DelimiterEnum.EE:
                return "==";
            case DelimiterEnum.CE:
                return ":=";
        }
        return "";
    }

    exports.Pair = Pair;
    exports.DelimiterEnum = DelimiterEnum;
    exports.delimiterToString = delimiterToString;
});