define(function (require, exports, module) {
    "use strict";

    var Pair = function (name) {
        this.name = name;
        this.value = "";
        this.block = null;
        this.objectValue = null;
        this.delimiter = DelimiterEnum.None;
        this.nameQuotesType = 0;
        this.valueQuotesType = 0;

    };

    (function () {
            this.createBlock = function () {
                this.block = [];
                this.value = null;
                this.objectValue = null;

            };   
            
    }).call(Pair.prototype);

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