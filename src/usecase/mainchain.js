const util = require("util");
const { exec } = require("child_process");
const execProm = util.promisify(exec);

const startZend = () => {
    exec("zend -regtest -websocket", () => {
        console.log("zend started...");
    });
};

const generateSidechain = async (scParams) => {
    return await executeZenCliCommand(
        `zen-cli -regtest sc_create '${JSON.stringify(scParams)}'`
    );
};

const getGenesisInfo = async (sidechainId) => {
    return await executeZenCliCommand(
        `zen-cli -regtest getscgenesisinfo '${sidechainId}'`
    );
};

const generateBlocks = async (blockNum) => {
    return await executeZenCliCommand(
        `zen-cli -regtest generate '${parseInt(blockNum)}'`
    );
};

const executeZenCliCommand = async (command) => {
    let result;

    try {
        result = await execProm(command);
    } catch (ex) {
        result = ex;
    }

    if (Error[Symbol.hasInstance](result)) {
        throw new Error("Error: ", result);
    }

    return result;
};

export {
    startZend,
    generateSidechain,
    getGenesisInfo,
    generateBlocks
}