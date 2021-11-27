"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RChainComponent = exports.RChain = void 0;
const rchain_1 = require("./providers/rchain");
const core_1 = require("@loopback/core");
var RChain;
(function (RChain) {
    RChain.RPUBLISHING = core_1.BindingKey.create('rchain.rpublishing');
})(RChain = exports.RChain || (exports.RChain = {}));
class RChainComponent {
    constructor() {
        this.providers = {
            [RChain.RPUBLISHING
                .key]: rchain_1.RChainProvider,
        };
    }
}
exports.RChainComponent = RChainComponent;
//# sourceMappingURL=component.js.map