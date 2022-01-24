const util = require("util");
const { exec } = require("child_process");
const execProm = util.promisify(exec);
const fs = require("fs");

const post = document.getElementById("scForm");
post.addEventListener("submit", async (event) => {
    event.preventDefault();

    const elements = event.target.elements;
    const keySeed = elements[0].value;
    const vrfKeySeed = elements[1].value;
    const maxPks = elements[2].value;
    const threshold = elements[3].value;
    const provingKeyPath = elements[4].value;
    const verificationKeyPath = elements[5].value;
    const withdrawalEpochLength = elements[6].value;
    const amount = elements[7].value;
    const walletSeed = elements[8].value;
    const blocksBefore = elements[9].value;
    const enableSubmit = elements[10].checked;
    const signingCertificateEnabled = elements[11].checked;
    const automaticForging = elements[12].checked;
    const outputFilePath = elements[13].value;
    const startZendCheck = elements[14].checked;

    const requestBody = {
        keySeed,
        vrfKeySeed,
        maxPks,
        threshold,
        provingKeyPath,
        verificationKeyPath,
    };

    getInitialConfigs(requestBody).then((result) => {
        if (startZendCheck) startZend();
        setTimeout(async () => {
            console.log("just after zend started");
            const { keySeed, proofInfoResult, vrfKeySeed } = result;
            const { verificationKey, genSysConstant, schnorrKeys } =
                proofInfoResult;
            const { vrfPublicKey, vrfSecret } = vrfKeySeed;
            const { secret, publicKey } = keySeed;

            if (blocksBefore !== 0) {
                await generateBlocks(blocksBefore);
            }

            generateSidechain({
                withdrawalEpochLength: parseInt(withdrawalEpochLength),
                toaddress: publicKey,
                amount: parseFloat(amount),
                wCertVk: verificationKey,
                customData: vrfPublicKey,
                constant: genSysConstant,
            }).then(({ stderr, stdout }) => {
                if (stderr) {
                    throw new Error(
                        "An error occurred while generating sidechain: ",
                        stderr
                    );
                }
                const sidechain = JSON.parse(stdout);

                generateBlocks(1).then(({ stderr, stdout }) => {
                    if (stderr) {
                        throw new Error(
                            "An error occurred while generating one block after sidechain creation: ",
                            stderr
                        );
                    }

                    getGenesisInfo(sidechain.scid).then(
                        ({ stderr, stdout }) => {
                            if (stderr) {
                                throw new Error(
                                    "An error occurred while getting genesis info: ",
                                    stderr
                                );
                            }

                            getGenesisInfoFromScTools({
                                info: stdout,
                                secret,
                                vrfSecret,
                            }).then((genesisInfoResult) => {
                                const withdrawalEpochCertificate = {
                                    submitterIsEnabled: enableSubmit,
                                    certificateSigningIsEnabled:
                                        signingCertificateEnabled,
                                    signersPublicKeys: schnorrKeys.map(
                                        (key) => key.schnorrPublicKey
                                    ),
                                    signersThreshold: parseInt(threshold),
                                    signersSecrets: schnorrKeys.map(
                                        (key) => key.schnorrSecret
                                    ),
                                    maxPks: parseInt(maxPks),
                                    provingKeyFilePath: provingKeyPath,
                                    verificationKeyFilePath:
                                        verificationKeyPath,
                                };

                                const fileJson = generateConfigFile({
                                    withdrawalEpochCertificate,
                                    genesis: genesisInfoResult,
                                    wallet: {
                                        seed: walletSeed,
                                        genesisSecrets: [
                                            keySeed.secret,
                                            vrfKeySeed.vrfSecret,
                                        ],
                                    },
                                    forger: { automaticForging },
                                });

                                fileJson.scorex["dataDir"] = "";
                                fileJson.scorex["logDir"] = "";
                                fileJson.scorex["restApi"] = {
                                    bindAddress: "",
                                    "api-key-hash": "",
                                    timeout: "",
                                };
                                fileJson.scorex["network"] = {
                                    nodeName: "",
                                    bindAddress: "",
                                    knownPeers: [],
                                    agentName: "",
                                };
                                fileJson.scorex["websocket"] = {
                                    address: "",
                                    connectionTimeout: "",
                                    reconnectionDelay: "",
                                    reconnectionMaxAttempts: "",
                                    wsServer: true,
                                    wsServerPort: 0,
                                };

                                const parsedConfigFile =
                                    parseJsonToScorexConfigFile(fileJson);

                                fs.writeFile(
                                    outputFilePath,
                                    parsedConfigFile,
                                    (err) => {
                                        if (err) {
                                            return console.err(err);
                                        }
                                        console.log("The file was saved!");
                                    }
                                );
                            });
                        }
                    );
                });
            });
        }, 10000);
    });
});

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

const getInitialConfigs = async (requestBody) => {
    const result = await fetch("http://localhost:8080/generate-config", {
        method: "POST", // *GET, POST, PUT, DELETE, etc.
        mode: "cors", // no-cors, *cors, same-origin
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
        },
        redirect: "follow",
        referrerPolicy: "no-referrer",
        body: JSON.stringify(requestBody),
    });

    const parsedResult = await result.json();

    return parsedResult;
};

const getGenesisInfoFromScTools = async (requestBody) => {
    const result = await fetch("http://localhost:8080/genesis-info", {
        method: "POST", // *GET, POST, PUT, DELETE, etc.
        mode: "cors", // no-cors, *cors, same-origin
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
        },
        redirect: "follow",
        referrerPolicy: "no-referrer",
        body: JSON.stringify(requestBody),
    });

    const parsedResult = await result.json();

    return parsedResult;
};

const generateConfigFile = (input) => {
    const { withdrawalEpochCertificate, genesis, forger, wallet } = input;
    const resultFile = {
        scorex: {
            withdrawalEpochCertificate,
            wallet,
            forger,
            genesis,
        },
    };

    return resultFile;
};

const parseJsonToScorexConfigFile = (input) => {
    const inputString = JSON.stringify(input);
    const fileWithoutDoubleQuotes = inputString.replace(/"([^"]+)":/g, "$1:");
    const fileWithoutCommas = fileWithoutDoubleQuotes.replace(/,/g, "\n");
    const fileWithReturnAtCloseCurlyBraket = fileWithoutCommas.replace(
        /}/g,
        "\n}\n"
    );
    const fileWithReturnAtBeginningofOpenCurlyBraket =
        fileWithReturnAtCloseCurlyBraket.replace(/{/g, "{\n");
    const fileWithoutColonsBeforeOpenBraket =
        fileWithReturnAtBeginningofOpenCurlyBraket.replace(/:{/g, " {");

    const fileWithColonsReplacedWithEquals =
        fileWithoutColonsBeforeOpenBraket.replace(/:/g, " = ");

    const fileWithoutFirstAndLastCurlyBrakets = fileWithColonsReplacedWithEquals
        .replace("{", "")
        .replace(/\n}\n$/g, "");

    const fileIndented = indentCorrectlyFile(
        fileWithoutFirstAndLastCurlyBrakets
    );

    return fileIndented.trimStart().trimEnd();
};

const indentCorrectlyFile = (string) => {
    let indentTabs = 0;
    let isListElement = false;

    const stringArray = string.split("\n");
    const stringArrayWithIndent = stringArray.map((row) => {
        let newRow;
        if (row.indexOf("{") >= 0) {
            newRow = applyTabs(row, indentTabs);
            indentTabs++;
        } else if (row.indexOf("}") >= 0) {
            indentTabs--;
            newRow = applyTabs(row, indentTabs);
        } else {
            newRow = applyTabs(row, indentTabs);
        }

        if (row.indexOf("[") >= 0) isListElement = true;
        if (row.indexOf("]") >= 0) isListElement = false;

        if (isListElement) newRow = newRow.concat(",");

        return newRow;
    });

    return stringArrayWithIndent.join("\n");
};

const applyTabs = (string, numTabs) => {
    let tabs = "";
    for (let i = 0; i < numTabs; i++) {
        tabs += "\t";
    }
    return tabs.concat(string);
};
