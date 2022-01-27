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

export {
    generateConfigFile
}