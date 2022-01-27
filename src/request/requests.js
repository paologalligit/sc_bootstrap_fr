const fs = require("fs");
const { parseJsonToScorexConfigFile } = require('../usecase/formatting')
const {
    startZend,
    generateSidechain,
    getGenesisInfo,
    generateBlocks
} = require('../usecase/mainchain')
const {
    getInitialConfigs,
    getGenesisInfoFromScTools
} = require('../usecase/sdkToolRequest')
const {
    generateConfigFile
} = require('../usecase/configFile')

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

    const initialConfigResponse = await getInitialConfigs(requestBody);

    if (startZendCheck) startZend();
    setTimeout(async () => {
        console.log("just after zend started");
        const { keySeed, proofInfoResult, vrfKeySeed } = initialConfigResponse;
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

            generateBlocks(1).then(({ stderr }) => {
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