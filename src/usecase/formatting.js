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

export {
    parseJsonToScorexConfigFile,
    indentCorrectlyFile,
    applyTabs
}