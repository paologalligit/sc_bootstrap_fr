const util = require("util");
const { exec } = require("child_process");
const execProm = util.promisify(exec);
const fs = require("fs");

const post = document.getElementById("scForm");
post.addEventListener("submit", (event) => {
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

    const requestBody = {
        keySeed,
        vrfKeySeed,
        maxPks,
        threshold,
        provingKeyPath,
        verificationKeyPath,
    };

    getInitialConfigs(requestBody).then((result) => {
        // startZend();
        const { keySeed, proofInfoResult, vrfKeySeed } = result;
        const { verificationKey, genSysConstant, schnorrKeys } =
            proofInfoResult;
        const { vrfPublicKey, vrfSecret } = vrfKeySeed;
        const { secret, publicKey } = keySeed;

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

                getGenesisInfo(sidechain.scid).then(({ stderr, stdout }) => {
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
                            submitterIsEnabled: false, //todo: insert in ui
                            certificateSigningIsEnabled: false, //todo: insert in ui
                            signersPublicKeys: schnorrKeys.map(
                                (key) => key.schnorrPublicKey
                            ),
                            signersThreshold: parseInt(threshold),
                            signersSecrets: schnorrKeys.map(
                                (key) => key.schnorrSecret
                            ),
                            maxPks: parseInt(maxPks),
                            provingKeyFilePath:
                                provingKeyPath + "/snark_proving_key",
                            verificationKeyFilePath:
                                verificationKeyPath + "/snark_verification_key",
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
                            forger: { automaticForging: false },
                        });

                        const parsedConfigFile =
                            parseJsonToScorexConfigFile(fileJson);

                        console.log("the file to save is: ", parsedConfigFile);
                        fs.writeFile(
                            "/tmp/test.conf",
                            parsedConfigFile,
                            (err) => {
                                if (err) {
                                    return console.err(err);
                                }
                                console.log("The file was saved!");
                            }
                        );
                    });
                });
            });
        });
    });
});

const startZend = async () => {
    await exec("zend -regtest -websocket");
    console.log("zend started...");
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
        console.log("Error: ", result);
        return;
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

const mockJson = {
    scorex: {
        withdrawalEpochCertificate: {
            submitterIsEnabled: false,
            certificateSigningIsEnabled: false,
            signersPublicKeys: [
                "c805deb4305977142b1695d081722cd29754744e88f620230e399d253474283c80",
                "74d27d60a7f5e6048a4a7bd4f4aeead4065bc576f85d0ad401be59ea299e7c0700",
                "2be69a2bec2c0a6001b9e945e878360e9cab8b9da833e8c671bd3c32f7218b3780",
                "ea9ce3c62eb17e9f88ac08bbe193e6cdd3b07135d0e144d2c658e7e56ed3e83780",
                "b374152f3cbad0d2e84f6bc78c248bbc8abbb911098e63ff7ad57a2397787c2080",
                "8d745d3f4ab0e447ca3ac9a919c5ceea76f9fbcaed78ff9300f4cabdd8baa50000",
                "684f50d273c70f6ad6f04ecb3add5952aea7b5b8bf0541e5aba57525cb9b402480",
            ],
            signersThreshold: 5,
            signersSecrets: [
                "040000002078b108b7354cad3f9e1ab5abf2c1b5396aa67208b6c81f63030747666b57971cc805deb4305977142b1695d081722cd29754744e88f620230e399d253474283c80",
                "0400000020b609dc998015de2b87377a50f98d3ecc5c206f2bef81d6cd902c56b6b9ee3d2c74d27d60a7f5e6048a4a7bd4f4aeead4065bc576f85d0ad401be59ea299e7c0700",
                "04000000204cb6d3f98ae8ad2eb6f312eb20cc8014fa71563b88c507d825e5dc71c25d15312be69a2bec2c0a6001b9e945e878360e9cab8b9da833e8c671bd3c32f7218b3780",
                "0400000020682842b2a25669959bdc99289750c8979a3bd262b3cc640bec171daa76b8b722ea9ce3c62eb17e9f88ac08bbe193e6cdd3b07135d0e144d2c658e7e56ed3e83780",
                "0400000020594c728c0ba6dfa8fdea04f6a6bc1af1bfcb65e8d841bcf2bc2ed168ab26b62bb374152f3cbad0d2e84f6bc78c248bbc8abbb911098e63ff7ad57a2397787c2080",
                "0400000020d2183c532e4a6b293b98486139285e35734f782af73ba1cd0ccd0e5491abd9228d745d3f4ab0e447ca3ac9a919c5ceea76f9fbcaed78ff9300f4cabdd8baa50000",
                "0400000020f8b581d770eb1ad68a93304c4f10df6cf1e17afdefec9fc92d89b5a2a79c2c33684f50d273c70f6ad6f04ecb3add5952aea7b5b8bf0541e5aba57525cb9b402480",
            ],
            maxPks: 7,
            provingKeyFilePath:
                "/tmp/sidechainapp/snark_proving_key/snark_proving_key",
            verificationKeyFilePath:
                "/tmp/sidechainapp/snark_verification_key/snark_verification_key",
        },
        wallet: {
            seed: "seed1",
            genesisSecrets: [
                "00e47b450a58ba3f9ba4a36ec20b7f7c1875f911ab937fc76ef326cd5407f86185eb753c360bdb4af2deb2cf9d5ba94d3526fe3d7d20112ad42754268d4f3333b1",
                "0300000020974d72afd18966b812b64e910052b5594ce51aa662d1918d6b5308d04156ed22b1ca76358de5172acd0489a3fe3f84ba75d1afe7e47c54a1a58da0c4365f903b80",
            ],
        },
        forger: {
            automaticForging: false,
        },
        genesis: {
            scId: "273fa0369b151243358fe7e1aee179343ca7590f7ed6b9625c4bc65e75bf8d4f",
            scGenesisBlockHex:
                "010000000000000000000000000000000000000000000000000000000000000000f2d8eb9e0c8e0140eb753c360bdb4af2deb2cf9d5ba94d3526fe3d7d20112ad42754268d4f3333b142b1ca76358de5172acd0489a3fe3f84ba75d1afe7e47c54a1a58da0c4365f903b808084af5f080000000076ef68891100e46ad2b3e743c5aae0812159ab527299498b937a6688ef285e2d80a57ad5cdcdfba900b80f0e1d5b1971a912de4b690c45678eee1196f8d564b01ec385083ada4a7919a90b9dfe4471d907ccd2c5d7a3e9c3c56cc5fb4f8ce83732000000000000000000000000000000000000000000000000000000000000000092a67b472d882560c22868ffec939f288417c0a55a5fac3986877416005fd0a90000000000000000000000000000000000000000000000000000000000000000008001f0d4f2bcf4d1eb58d606a3603fa746ef133ba47f8c4407e8bdf918be8d73d2419186904b46b1ffca05d0708a2ae207379da7d00a9e6380c18d18416baefd3d0d0002f8190bb934e601a9653f199edf49c2c22ccc4c16c5cda7303382a6d64071216ec4049a100100000408028a1001e803000000e1f50500000000b133334f8d265427d42a11207d3dfe26354da95b9dcfb2def24adb0b363c75eb21b1ca76358de5172acd0489a3fe3f84ba75d1afe7e47c54a1a58da0c4365f903b8001204c33d70cfab2ddde9cb66b23a46be96935cb880d65b9684397b520851459b81efd5903021e850000000000000400000000000000228500000000000018340200000000000c0000000000000002342b3c96c723fc7532b8ddc7ee5c4ad08c71d103d58af765e26a5d7e564bd72a00b651f6aa1a05ca4a9048029d70810060f7b856867c49fa0c2d4e83ba3d6c412b80000240cd4cd0b1a5a30e4598fbbc94320b21d003b159a1413bbc1bc1d97e5e867f1f8097bf48bbfbc89d724797286087a43eb77179c7d1a3b89b3a58e100a2ee80db3e00000230bfe275be0c483d6b813e1151302e27cdcd9d5a20deccf98b1ddd0acb973a1280ff5792175da601f379b9e5581586ef54333a2f8c4550e25ca9bf1598da6463300000020891249bb9d0de2f1832ce6f7ed063b4030cfb19d602461d2165e6bd2cffd306002fc25eb375296df200bac980a7329d0551884bf0ad35cb38fd0c6b39b13b5034800002524d27bfd9e1d7672aa8c0e9edf8408a14af55a83b80fb6136c814d749784a2900599b575989381735ea3b3bcc1d14c359866a4c186fa6ce7f4c36f86bd994c62d000002d6e03029080365aa5d591fcfe2dda947be2797100cb10cc750b8630ed2977721802e57710813c9dde52fe87c1c71e3e5becd59acfc3937db22b8c0fb915d30702a80000233bdd48870f7a2f10194d71d3794d14203d5203331a93d808d16dd1d2925ba3980b3b2ad25ccf37ace16a028852356e9dfa2fbe945e57a240100971c2a1e9d5e0d000002c9054e44322384b2246d20a18ae0b869bd66584953c89ebf54969654c3758a35801db8ebefce3daf9348a50ff09031b2332283a3532e2b33b8423b9dec3875cb0880000273f1ffa9aac216fbd7cb74d6a3c05403d4abf51bea4e79468870132f42210c09002f357719630359c7b26bdf886a3c19a15008a6a8fbb78e6f3d0a4dbb4e28a922800002dcc1a1145dfdcda4f438f9326525c135b6bf828fd334006931111d4e099f721c00b414bf5120a9e5453d5b75138b845474c471f5665efa7ba2e5269a0cc5f5f31b800002a64010360671d6ea38f53a80be8956c22e3106b36aad38ac709706e2bb25d6020050cf4c29bebd067575608db1313e0ec8ebd1e3346b57d6bc3ac78b235823fb0b800002ca34971566dc69fc0d504d748e9dbe8cae5233e77165ec15125dd5a82766ce15008130b564dae3127e857548ee5626be602d77c3b94580d745babdeb9a1a53133400000000000000000000000000000000000000000000da9c2a741379dec87a01c8fc6ca9ae5b17ee2c50d04557e8af4cc43203d421650000000090090c000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000e5898923c5501dbecd48456555cf9225aa44bf3a4e84bc20ec069b4a4dcf972a00000000000000000100000000000000139b3ecbc5a42fb4f3e4ae8cb3f263dc68c4c24e514b44262baf847e0635b22d00000000000000000100000000000000cf4c9401843fc0e2b017d334787fc7cf38a6b1f04d3fa6abd12ba18cc7a9e8170000000000000000010000000000000075ebe544ca04c7aed3c225003514b6a85c07cdea695d42fa7e78d25d2bb62e380000000000000000010000000000000012cf31c4504a3e4135a8a1ef06973ed061e9cc659813ebded719c9f1ca20943a000000000000000001000000000000001cef6ce7dfc27c10d8e2b1612340fcc67dfe2909649c34b6d94379c678235520000000000000000001000000000000009722c66b0e766e57ce97cb7ab82ad27cbad4294061c5b3ddb76331307c90602300000000000000000100000000000000c1f94c50887bb99f6eed3cb27adcac769b8b6cebf24ae6e3199e996c1b534e0b000000000000000001000000000000009ef35bc5fecf5ec5ebee699fb9674c6ac47cae618b76e60f32bdfc4c3fe3073800000000000000000100000000000000cae22c26168c9275bfa5ad7aa496e94450367a19be9a142e2c6a8d3f5afaaf26000000000000000001000000000000003c411e863e54f7a1897b899027feed299445573ad779bda4c4c038b76f749909000000000000000000000002e2020300000095b84417a6aa3b3a6a44146abcea328c8a64356b0daf00c02da1eb7ae35abc04a3f68c0a594a1da3604ca40f593430fb4cf1a2e9643b1b2ef8f2f88720c359b0e3328da53a800857eb477f11ba23b65749f7951677e499b75fbe71ee5b57712f3976ed61f50e0f20410004d0ffa82cbc780806cbe8a89ba557ad02f13ff6d41bc6b4d3c3cb6300002401667c3e3adea399fb38f7e89da3bdc581ab074b635e836b29d9074a47d2b8c57ed2058400",
            powData:
                "0f76ed61f50e0f207875ed61f50e0f201f75ed61f50e0f20c874ed61f50e0f208968ed61f50e0f20a767ed61f50e0f203b67ed61f60e0f206a66ed61f60e0f20d265ed61f60e0f202e64ed61f60e0f200364ed61f60e0f20b463ed61f60e0f201163ed61f60e0f20ee62ed61f60e0f20f057ed61f60e0f204e57ed61f60e0f20dd56ed61f60e0f208756ed61f60e0f203056ed61f60e0f20df55ed61f60e0f20d842ed61f60e0f203642ed61f60e0f20c541ed61f60e0f206f41ed61f70e0f201841ed61f70e0f20c740ed61f70e0f20803fed61f70e0f203b3eed61f70e0f20",
            mcBlockHeight: 449,
            mcNetwork: "regtest",
            withdrawalEpochLength: 1000,
            initialCumulativeCommTreeHash:
                "d540b33652ed75d2c3915ab3e32dcb7ed888583bec640c62fc5392a22a895b1f",
        },
    },
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
        else if (row.indexOf("]") >= 0) isListElement = false;

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

console.log(parseJsonToScorexConfigFile(mockJson));
