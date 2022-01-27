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

export {
    getInitialConfigs,
    getGenesisInfoFromScTools
}